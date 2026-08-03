"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, Users, BookOpen, Hand, FileSpreadsheet, Check, X, Share2 } from "lucide-react";
import { format } from "date-fns";
import { getAttendanceSessionById, type AttendanceSession, type EmbeddedAttendanceRecord } from "@/lib/api/attendance-session";
import { toast } from "sonner";
import { listUsers } from "@/lib/api/user";
import { createBulkAttendanceRecords, updateBulkAttendanceRecords, type AttendanceStatus } from "@/lib/api/attendance-record";
import type { User } from "@/lib/types/UserTypes";
import CsvAttendanceDialog from "@/components/teacher/csv-attendance-dialog";
import { ShareAttendanceDialog } from "../../share-attendance-dialog";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default function SessionAttendanceMethodsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, EmbeddedAttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState<Map<string, 'present' | 'absent'>>(new Map());
  const [markMode, setMarkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const attendanceSummary = useMemo(() => {
    let present = 0;
    let absent = 0;

    students.forEach((student) => {
      const status = attendanceStatus.get(student._id!);
      if (status === "present") present += 1;
      if (status === "absent") absent += 1;
    });

    const unmarked = Math.max(0, students.length - present - absent);
    return { present, absent, unmarked };
  }, [students, attendanceStatus]);


  const markStudent = (studentId: string, status: 'present' | 'absent') => {
    setAttendanceStatus((prev) => {
      setSaveSuccess(false);
      const next = new Map(prev);
      next.set(studentId, status);
      return next;
    });
  };

  const beginMarking = () => {
    setMarkMode(true);
    setSaveSuccess(false);
  };

  const refreshAttendanceList = useCallback(async () => {
    try {
      const sessionData = await getAttendanceSessionById(sessionId);
      setSession(sessionData);
      const recordsMap = new Map<string, EmbeddedAttendanceRecord>();
      const statusMap = new Map<string, 'present' | 'absent'>();
      
      (sessionData.records ?? []).forEach((record: any) => {
        const studentId = typeof record.student === 'string'
          ? record.student
          : record.student._id;
        recordsMap.set(studentId, record);
        statusMap.set(studentId, record.status === 'present' ? 'present' : 'absent');
      });

      setAttendanceRecords(recordsMap);
      setAttendanceStatus(statusMap);
    } catch (error) {
      console.error("Failed to refresh attendance:", error);
    }
  }, [sessionId]);

  const submitAttendance = async () => {
    if (!session || students.length === 0) return;

    setSaving(true);
    try {
      const createRecords: Array<{ student: string; status: AttendanceStatus }> = [];
      const updateRecordsList: Array<{ recordId: string; status: AttendanceStatus }> = [];

      students.forEach((student) => {
        const status = attendanceStatus.get(student._id!) ?? "absent";
        const existingRecord = attendanceRecords.get(student._id!);

        if (existingRecord) {
          updateRecordsList.push({ recordId: existingRecord._id, status });
        } else {
          createRecords.push({ student: student._id!, status });
        }
      });

      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      if (createRecords.length > 0) {
        try {
          const result = await createBulkAttendanceRecords({
            session: session._id,
            records: createRecords,
          });
          createdCount = (result.created ?? []).length;
          errorCount = (result.errors ?? []).length;
        } catch (error) {
          console.error("Failed to create attendance records:", error);
          errorCount += createRecords.length;
        }
      }

      if (updateRecordsList.length > 0) {
        const result = await updateBulkAttendanceRecords({
          session: session._id,
          updates: updateRecordsList,
        });
        updatedCount = (result.updated ?? []).length;
        errorCount += (result.errors ?? []).length;
      }

      setSaveSuccess(true);
      if (errorCount > 0) {
        toast.error(`Saved ${createdCount + updatedCount} records (${createdCount} new, ${updatedCount} updated) with ${errorCount} errors`);
      } else {
        toast.success(`Attendance successfully marked!`, {
          className: "w-fit pr-2"
        });
      }
      await refreshAttendanceList();
      setMarkMode(false);
    } catch (error) {
      console.error("Failed to save attendance:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const loadAttendanceRecords = (sessionData: AttendanceSession) => {
    const recordsMap = new Map<string, EmbeddedAttendanceRecord>();
    const statusMap = new Map<string, 'present' | 'absent'>();
    (sessionData.records ?? []).forEach((record: any) => {
      const studentId = typeof record.student === 'string'
        ? record.student
        : record.student._id;
      recordsMap.set(studentId, record);
      statusMap.set(studentId, record.status === 'present' ? 'present' : 'absent');
    });
    setAttendanceRecords(recordsMap);
    setAttendanceStatus(statusMap);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const sessionData = await getAttendanceSessionById(sessionId);
        setSession(sessionData);
        const sessionBatchId = typeof sessionData.batch === 'string' 
          ? sessionData.batch 
          : sessionData.batch?._id;

        let batchStudents: User[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const usersResponse = await listUsers({ role: 'student', batch: sessionBatchId, limit: 100, page });
          batchStudents = [...batchStudents, ...usersResponse.users];
          totalPages = usersResponse.pagination?.totalPages || 1;
          page++;
        } while (page <= totalPages);

        // Sort students in ascending order by candidate code, with a fallback to name
        batchStudents.sort((a, b) => {
          const profileA = (a.profile as any) || {};
          const profileB = (b.profile as any) || {};
          const codeA = String(profileA.candidate_code || '').trim();
          const codeB = String(profileB.candidate_code || '').trim();

          if (codeA && !codeB) return -1;
          if (!codeA && codeB) return 1;

          if (codeA && codeB) {
            const codeComparison = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            if (codeComparison !== 0) return codeComparison;
          }
          return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
        });
        setStudents(batchStudents);

        const recordsMap = new Map<string, EmbeddedAttendanceRecord>();
        const statusMap = new Map<string, 'present' | 'absent'>();
        (sessionData.records ?? []).forEach((record: any) => {
          const studentId = typeof record.student === 'string'
            ? record.student
            : record.student._id;
          recordsMap.set(studentId, record);
          statusMap.set(studentId, record.status === 'present' ? 'present' : 'absent');
        });
        setAttendanceRecords(recordsMap);
        setAttendanceStatus(statusMap);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  // Auto-refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      refreshAttendanceList();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshAttendanceList]);


  if (loading) {
    return (
      <div className="min-h-screen p-4 pb-24 sm:pb-20 md:p-8 space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen p-4 pb-24 sm:pb-20 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/attendance")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Attendance
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSessionTypeBadge = (type: string) => {
    const variants = {
      regular: "default",
      extra: "secondary",
      practical: "outline",
    } as const;
    return variants[type as keyof typeof variants] || "default";
  };

  return (
    <div className="min-h-screen p-4 pb-24 sm:pb-20 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/attendance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Choose Attendance Method</h1>
            <p className="text-muted-foreground">Select how you want to mark attendance for this session</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} className="shrink-0 hidden md:flex">
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button variant="outline" size="icon" onClick={() => setShareDialogOpen(true)} className="shrink-0 md:hidden">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* toasts are shown via Sonner Toaster mounted in dashboard layout */}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-3">
              <div>
                <CardTitle className="text-xl md:text-2xl">{session.subject.name}</CardTitle>
                <p className="text-muted-foreground mt-1">{session.subject.code}</p>
              </div>
              <Badge variant={getSessionTypeBadge(session.session_type)} className="w-fit">
                {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Batch</p>
                <p className="text-sm text-muted-foreground">{session.batch?.name ?? "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Date</p>
                <p className="text-sm text-muted-foreground">{format(new Date(session.start_time), "MMM dd, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Time</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(session.start_time), "hh:mm a")} - {format(new Date(session.end_time), "hh:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">{session.hours_taken} {session.hours_taken === 1 ? "hour" : "hours"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/dashboard/attendance/session/${sessionId}/swipe`} className="block">
          <Card className="border-2 cursor-pointer hover:shadow-lg transition-shadow h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Hand className="h-5 w-5 text-primary" />
                <CardTitle>Swipe Cards</CardTitle>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <button onClick={() => setCsvDialogOpen(true)} className="block text-left">
          <Card className="border-2 cursor-pointer hover:shadow-lg transition-shadow h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle>CSV</CardTitle>
              </div>
            </CardHeader>
          </Card>
        </button>
      </div>

      {/* Student Attendance List */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-4" />
                Student Attendance List
              </CardTitle>
              <p className="text-sm font-medium ">Total: {students.length}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border bg-green-50 dark:bg-green-950/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-400">{attendanceSummary.present}</p>
              </div>
              <div className="rounded-md border bg-red-50 dark:bg-red-950/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-lg font-semibold text-red-700 dark:text-red-400">{attendanceSummary.absent}</p>
              </div>
              <div className="rounded-md border bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">Unmarked</p>
                <p className="text-lg font-semibold">{attendanceSummary.unmarked}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Marking mode</p>
                <p className="text-sm text-muted-foreground">
                  {markMode ? "Tick students below, then submit once." : "Enable marking to show tick and cross buttons."}
                </p>
              </div>
              {!markMode ? (
                <Button onClick={beginMarking} disabled={students.length === 0} className="sm:min-w-40">
                  Mark Attendance
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setMarkMode(false)} disabled={saving} className="sm:min-w-40">
                  Marking Enabled
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No students found in this batch.</p>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const studentId = student._id;
                const status = attendanceStatus.get(studentId!) || 'default';
                const isPresent = status === 'present';

                const p = (student.profile as any) ?? {};
                const candidateCode = p.candidate_code?.trim() ?? '';
                const lastThreeDigits = candidateCode.slice(-3).replace(/^0+/, '') || 'N/A';

                return (
                  <div
                    key={studentId}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 font-semibold transition-colors ${status === 'present'
                            ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700'
                            : status === 'absent'
                              ? 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700'
                              : 'bg-primary/10 border-primary text-primary'
                          }`}
                      >
                        <span className="text-xs">{lastThreeDigits}</span>
                      </div>
                      <p className="font-medium text-sm">{student.name}</p>
                    </div>
                    {markMode && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant={isPresent ? "default" : "outline"}
                          onClick={() => markStudent(studentId!, 'present')}
                          className="h-10 w-10 p-0"
                          title="Mark Present"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={!isPresent && attendanceStatus.get(studentId!) === 'absent' ? "destructive" : "outline"}
                          onClick={() => markStudent(studentId!, 'absent')}
                          className="h-10 w-10 p-0"
                          title="Mark Absent"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop Submit Button */}
          {markMode && (
            <div className="mt-6 hidden flex-col gap-2 sm:flex sm:flex-row sm:justify-end">
              <Button onClick={submitAttendance} disabled={saving || students.length === 0}>
                {saving ? "Saving..." : "Submit Attendance"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {session && (
        <CsvAttendanceDialog
          open={csvDialogOpen}
          onOpenChange={setCsvDialogOpen}
          session={session}
          students={students}
          existingRecords={attendanceRecords}
          onSuccess={refreshAttendanceList}
        />
      )}

      <ShareAttendanceDialog 
        session={shareDialogOpen ? session : null} 
        onClose={() => setShareDialogOpen(false)} 
      />

      {/* Mobile Submit Button */}
      {markMode && (
        <div className="fixed bottom-15 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur-sm sm:hidden">
          <div className="container mx-auto flex max-w-5xl items-center justify-center p-4">
            <Button onClick={submitAttendance} disabled={saving || students.length === 0} className="w-full">
              {saving ? "Saving..." : "Submit"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
