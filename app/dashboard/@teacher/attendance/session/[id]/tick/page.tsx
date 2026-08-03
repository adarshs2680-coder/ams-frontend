"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock, Users, BookOpen, Check, X } from "lucide-react";
import { format } from "date-fns";
import { getAttendanceSessionById, type AttendanceSession, type EmbeddedAttendanceRecord } from "@/lib/api/attendance-session";
import { createBulkAttendanceRecords, updateAttendanceRecordById, type AttendanceStatus } from "@/lib/api/attendance-record";
import { listUsers, type User } from "@/lib/api/user";
import { toast } from "sonner";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default function TickAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [markedStatuses, setMarkedStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [existingRecords, setExistingRecords] = useState<Map<string, EmbeddedAttendanceRecord>>(new Map());
  const [markMode, setMarkMode] = useState(false);

  const loadBatchStudents = useCallback(async (batchId: string) => {
    setLoadingStudents(true);
    try {
      const batchStudents: User[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await listUsers({ role: "student", batch: batchId, page, limit: 100 });
        totalPages = response.pagination?.totalPages || 1;
        batchStudents.push(...response.users);
        page++;
      } while (page <= totalPages);

      // Sort students in ascending order by name
      batchStudents.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setStudents(batchStudents);
    } catch (error) {
      console.error("Failed to load students:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAttendanceSessionById(sessionId);
      setSession(data);
      await loadBatchStudents(data.batch._id);

      // Load existing attendance records from the already-fetched session
      const recordsMap = new Map<string, EmbeddedAttendanceRecord>();
      const statusMap: Record<string, AttendanceStatus> = {};

      (data.records ?? []).forEach((record) => {
        recordsMap.set(record.student._id, record);
        statusMap[record.student._id] = record.status;
      });

      setExistingRecords(recordsMap);
      setMarkedStatuses(statusMap);
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setLoading(false);
    }
  }, [loadBatchStudents, sessionId]);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [loadSession, sessionId]);

  const markStudent = (studentId: string, status: AttendanceStatus) => {
    setMarkedStatuses((prev) => {
      setSaveSuccess(false);
      return { ...prev, [studentId]: status };
    });
  };

  const beginMarking = () => {
    setMarkMode(true);
    setSaveSuccess(false);
  };

  const submitAttendance = async () => {
    if (!session || students.length === 0) return;

    const createRecords: Array<{ student: string; status: AttendanceStatus }> = [];
    const updateRecordsList: Array<{ recordId: string; status: AttendanceStatus }> = [];

    students.forEach((student) => {
      const status = markedStatuses[student._id!] ?? "absent";
      const existingRecord = existingRecords.get(student._id!);

      if (existingRecord) {
        updateRecordsList.push({ recordId: existingRecord._id, status });
      } else {
        createRecords.push({ student: student._id!, status });
      }
    });

    setSaving(true);
    try {
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Execute creates
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

      // Execute updates in parallel
      if (updateRecordsList.length > 0) {
        const updatePromises = updateRecordsList.map(({ recordId, status }) =>
          updateAttendanceRecordById(recordId, { status })
        );
        const results = await Promise.allSettled(updatePromises);
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            updatedCount++;
          } else {
            console.error('Failed to update record:', result.reason);
            errorCount++;
          }
        });
      }

      setSaveSuccess(true);
      if (errorCount > 0) {
        toast.error("Failed to save attendance. Please try again.");
      } else {
        toast.success("Attendance marked successfully.");
      }
    } catch (error) {
      console.error("Failed to save attendance:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(markedStatuses).filter((status) => status === "present").length;
  const absentCount = Object.values(markedStatuses).filter((status) => status === "absent").length;
  const unmarkedCount = Math.max(students.length - Object.keys(markedStatuses).length, 0);

  if (loading) {
    return (
      <div className="min-h-screen p-4 pb-24 sm:pb-20 md:p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/attendance/session/${sessionId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Tick Attendance</h1>
          <p className="text-muted-foreground">Mark students by ticking present or absent in a list</p>
        </div>
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
        <CardContent className="overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Batch</p>
                <p className="text-sm text-muted-foreground">{session.batch.name}</p>
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Tick List</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Unmarked students will be saved as absent.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-3">
              <div>
                <p className="text-xs text-muted-foreground">Present</p>
                <p className="text-xl font-bold">{presentCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absent</p>
                <p className="text-xl font-bold">{absentCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unmarked</p>
                <p className="text-xl font-bold">{unmarkedCount}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Marking mode</p>
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

          {loadingStudents ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No students found for this batch.</div>
          ) : (
            <div className="space-y-3 overflow-visible">
              {students.map((student) => {
                const status = markedStatuses[student._id!];
                const p = (student.profile as any) ?? {};
                const candidateCode = p.candidate_code?.trim() ?? '';
                const lastThreeDigits = candidateCode.slice(-3).replace(/^0+/, '') || 'N/A';
                
                return (
                  <div
                    key={student._id!}
                    className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary">
                        <span className="text-xs font-semibold text-primary">{lastThreeDigits}</span>
                      </div>
                      <p className="font-semibold">{student.name}</p>
                    </div>
                    {markMode && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={status === "absent" ? "destructive" : "outline"}
                          onClick={() => markStudent(student._id!, "absent")}
                          className="h-10 px-3 sm:px-4"
                        >
                          <X className="mr-2 h-4 w-4" />
                          X
                        </Button>
                        <Button
                          type="button"
                          variant={status === "present" ? "default" : "outline"}
                          onClick={() => markStudent(student._id!, "present")}
                          className="h-10 px-3 sm:px-4"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          ✓
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
            {/* Fixed Submit Button */}
      {markMode && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto flex max-w-5xl items-center justify-end p-4">
            <Button onClick={submitAttendance} disabled={saving || students.length === 0} className="w-full sm:w-auto">
              {saving ? "Saving..." : "Submit Attendance"}
            </Button>
          </div>
        </div>
      )}
          {saveSuccess && (
            <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              Attendance has been saved successfully.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
