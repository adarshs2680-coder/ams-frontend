"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, Plus, AlertCircle } from "lucide-react";
import { createAttendanceSession, type CreateSessionData, type SessionType } from "@/lib/api/attendance-session";
import { listBatches, type Batch } from "@/lib/api/batch";
import { listSubjects, type Subject } from "@/lib/api/subject";
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface CreateClassDialogProps {
  onClassCreated?: () => void;
}

export default function CreateClassDialog({ onClassCreated }: CreateClassDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [duration, setDuration] = useState<number>(1);
  const [startHour, setStartHour] = useState<number>(new Date().getHours());
  const [sessionType, setSessionType] = useState<SessionType>("regular");
  const { user } = useAuth();
  const teacherDept = (user?.profile as any)?.department;

  useEffect(() => {
    if (open) {
      loadData();
      setStartHour(new Date().getHours());
      setDuration(1);
      setSessionType("regular");
      setBatchId("");
      setSubjectId("");
      setError(null);
    }
  }, [open]);

  const isValidDept = ["CSE", "ECE", "IT", "GEN"].includes(teacherDept);
  const isGeneralDept = teacherDept === "GEN";

  const loadData = async () => {
    setLoadingData(true);
    try {
      const filterDept = (isValidDept && !isGeneralDept) ? teacherDept : undefined;
      const batchesData = await listBatches({ limit: 100, department: filterDept });
      setBatches(batchesData.batches);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const selectedBatch = batches.find((b) => b._id === batchId);
  const selectedSubject = subjects.find((s) => s._id === subjectId);

  useEffect(() => {
    setSubjectId("");
    if (!batchId) {
      setSubjects([]);
      return;
    }

    const loadSubjectsForBatch = async () => {
      setLoadingSubjects(true);
      try {
        const selectedBatch = batches.find((b) => b._id === batchId);
        if (selectedBatch) {
          const dept = isGeneralDept ? "GEN" : selectedBatch.department;
          const subjectsData = await listSubjects({
            limit: 100,
            department: dept,
            sem: selectedBatch.sem,
            scheme: selectedBatch.scheme,
          });
          setSubjects(subjectsData.subjects);
        }
      } catch (error) {
        console.error("Failed to load subjects:", error);
      } finally {
        setLoadingSubjects(false);
      }
    };

    loadSubjectsForBatch();
  }, [batchId, batches, isGeneralDept]);

  const getStartTimePreview = () => {
    let t = setHours(new Date(), startHour);
    t = setMinutes(t, 0);
    t = setSeconds(t, 0);
    t = setMilliseconds(t, 0);
    return t;
  };

  const getEndTimePreview = () =>
    new Date(getStartTimePreview().getTime() + duration * 60 * 60 * 1000);

  const handleSubmit = async () => {
    if (!batchId || !subjectId) return;
    setError(null);
    setLoading(true);
    try {
      const startTime = getStartTimePreview();
      const endTime = getEndTimePreview();

      const sessionData: CreateSessionData = {
        batch: batchId,
        subject: subjectId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours_taken: duration,
        session_type: sessionType,
      };

      const newSession = await createAttendanceSession(sessionData);
      setOpen(false);
      onClassCreated?.();
      router.push(`/dashboard/attendance/session/${newSession._id}`);
    } catch (err) {
      console.error("Failed to create class:", err);
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full md:w-auto">
          <Plus className="mr-2 h-5 w-5" />
          Create New Class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Class</DialogTitle>
          <DialogDescription>
            Configure and start a new attendance session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Schedule Preview */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-top gap-1.5 min-w-0">
                <BookOpen className="h-4 w-4 text-primary mt-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold line-clamp-2 wrap-break-word">
                    {selectedSubject ? selectedSubject.name : <span className="text-muted-foreground font-normal">No subject selected</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSubject ? selectedSubject.subject_code : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {selectedBatch ? `${selectedBatch.name}` : "No batch selected"}
                </span>
              </div>
            </div>
            <div className="border-t pt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Start</p>
                <p className="font-medium">{format(getStartTimePreview(), "hh:mm a")}</p>
                <p className="text-xs text-muted-foreground">{format(getStartTimePreview(), "MMM dd, yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">End</p>
                <p className="font-medium">{format(getEndTimePreview(), "hh:mm a")}</p>
                <p className="text-xs text-muted-foreground">{format(getEndTimePreview(), "MMM dd, yyyy")}</p>
              </div>
            </div>
          </div>

          {/* Batch & Subject */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId} disabled={loadingData}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingData ? "Loading..." : "Select batch"} />
                </SelectTrigger>
                <SelectContent >
                  {batches.map((batch) => (
                    <SelectItem key={batch._id} value={batch._id}>
                      {batch.name} 
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>

              <Select value={subjectId} onValueChange={setSubjectId} disabled={loadingData || loadingSubjects || !batchId}>
                <SelectTrigger className="min-w-0 max-w-full">
                  <SelectValue
                    className="truncate block"
                    placeholder={
                      loadingData
                        ? "Loading..."
                        : !batchId
                        ? "Select batch first"
                        : loadingSubjects
                        ? "Loading subjects..."
                        : "Select subject"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="w-full max-w-[95vw]">
                  <div className="pb-2">
                    {subjects.map((subject) => (
                      <SelectItem key={subject._id} value={subject._id}>
                        <span className="block w-full truncate">
                          {subject.name} ({subject.subject_code})
                        </span>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              {[1, 2, 3].map((hrs) => (
                <Button
                  key={hrs}
                  type="button"
                  variant={duration === hrs ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setDuration(hrs)}
                >
                  {hrs} {hrs === 1 ? "hour" : "hours"}
                </Button>
              ))}
            </div>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {format(setHours(new Date(), i), "hh:00 a")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Session Type */}
          <div className="space-y-2">
            <Label>Session Type</Label>
            <div className="flex gap-2">
              {(["regular", "extra", "practical"] as SessionType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={sessionType === type ? "default" : "outline"}
                  className="flex-1 capitalize"
                  onClick={() => setSessionType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || loadingData || !batchId || !subjectId}>
              {loading ? "Creating..." : "Start Class"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
