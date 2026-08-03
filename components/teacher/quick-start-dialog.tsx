"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Users, AlertCircle } from "lucide-react";
import { createAttendanceSession, type CreateSessionData, type SessionType, type UniqueSession } from "@/lib/api/attendance-session";
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { useRouter } from "next/navigation";

interface QuickStartDialogProps {
  session: UniqueSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated?: () => void;
}

export default function QuickStartDialog({ session, open, onOpenChange, onSessionCreated }: QuickStartDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(1);
  const [startHour, setStartHour] = useState<number>(new Date().getHours());
  const [sessionType, setSessionType] = useState<SessionType>("regular");

  // Reset to current hour when dialog opens
  useEffect(() => {
    if (open) {
      setStartHour(new Date().getHours());
      setDuration(1);
      setSessionType("regular");
      setError(null);
    }
  }, [open]);

  if (!session) return null;

  const handleStartClass = async () => {
    setError(null);
    setLoading(true);
    try {
      // Create start time at the selected hour with 0 minutes and seconds
      const now = new Date();
      let startTime = setHours(now, startHour);
      startTime = setMinutes(startTime, 0);
      startTime = setSeconds(startTime, 0);
      startTime = setMilliseconds(startTime, 0);

      // Calculate end time based on duration
      const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

      const sessionData: CreateSessionData = {
        batch: session.batch._id,
        subject: session.subject._id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours_taken: duration,
        session_type: sessionType,
      };

      const newSession = await createAttendanceSession(sessionData);
      
      onOpenChange(false);
      onSessionCreated?.();
      
      // Navigate to the session page
      router.push(`/dashboard/attendance/session/${newSession._id}`);
    } catch (err) {
      console.error("Failed to start class:", err);
      setError(err instanceof Error ? err.message : "Failed to start class");
    } finally {
      setLoading(false);
    }
  };

  const getStartTimePreview = () => {
    const now = new Date();
    let startTime = setHours(now, startHour);
    startTime = setMinutes(startTime, 0);
    startTime = setSeconds(startTime, 0);
    return startTime;
  };

  const getEndTimePreview = () => {
    const startTime = getStartTimePreview();
    return new Date(startTime.getTime() + duration * 60 * 60 * 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Class</DialogTitle>
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

          {/* Class Info + Schedule Preview */}
          <div className="bg-muted rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-top gap-1.5 min-w-0">
                <BookOpen className="h-4 w-4 text-primary mt-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold line-clamp-2 break-words">{session.subject.name}</p>
                  <p className="text-xs text-muted-foreground">{session.subject.subject_code}</p>
                  
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{session.batch.name} </span>
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

          {/* Duration Selection */}
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

          {/* Start Time Selection */}
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
              <Button
                type="button"
                variant={sessionType === "regular" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setSessionType("regular")}
              >
                Regular
              </Button>
              <Button
                type="button"
                variant={sessionType === "extra" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setSessionType("extra")}
              >
                Extra
              </Button>
              <Button
                type="button"
                variant={sessionType === "practical" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setSessionType("practical")}
              >
                Practical
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleStartClass} disabled={loading}>
              {loading ? "Starting..." : "Start Class"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
