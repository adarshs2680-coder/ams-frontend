"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, GraduationCap, Loader2 } from "lucide-react";
import { advanceBatchSemesters, convertBatchesToAlumni, ALUMNI_SEM, type Batch } from "@/lib/api/batch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const MAX_SEM = 8;
const MIN_SEM = 1;
const SEM_OPTIONS = Array.from({ length: MAX_SEM }, (_, i) => String(i + 1));

interface AdvanceSemesterDialogProps {
  batches: Batch[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const semLabel = (sem: string) => (sem === ALUMNI_SEM ? "Alumni" : sem);

export function AdvanceSemesterDialog({ batches, open, onOpenChange, onSuccess }: AdvanceSemesterDialogProps) {
  const [mode, setMode] = useState<"advance" | "set" | "alumni">("advance");
  const [targetSem, setTargetSem] = useState<string>("1");
  const [isLoading, setIsLoading] = useState(false);

  const uniformSem = useMemo(() => {
    const sems = new Set(batches.map((b) => b.sem));
    return sems.size === 1 ? batches[0]?.sem : null;
  }, [batches]);

  const atMaxSem = uniformSem === String(MAX_SEM);

  // Batches at the final semester can't be advanced any further — default
  // straight to the alumni conversion when that's the only sensible option.
  useEffect(() => {
    if (!open) return;
    setMode(atMaxSem ? "alumni" : "advance");
  }, [open, atMaxSem]);

  const preview = useMemo(() => {
    return batches.map((b) => {
      const current = Number.parseInt(b.sem, 10);
      const next =
        mode === "set"
          ? targetSem
          : mode === "alumni"
            ? ALUMNI_SEM
            : String(Math.min(Math.max(Number.isFinite(current) ? current : MIN_SEM, MIN_SEM) + 1, MAX_SEM));
      return { ...b, nextSem: next, changed: next !== b.sem };
    });
  }, [batches, mode, targetSem]);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      const batchIds = batches.map((b) => b._id);
      if (mode === "alumni") {
        await convertBatchesToAlumni(batchIds);
        toast.success(`${batchIds.length} batch${batchIds.length === 1 ? "" : "es"} converted to alumni.`);
      } else {
        await advanceBatchSemesters(batchIds, mode === "set" ? Number(targetSem) : undefined);
        toast.success(`Semester updated for ${batchIds.length} batch${batchIds.length === 1 ? "" : "es"}.`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update semester");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "alumni" ? "Convert to Alumni" : "Advance Semester"}</DialogTitle>
          <DialogDescription>
            {batches.length} batch{batches.length === 1 ? "" : "es"} selected.{" "}
            {atMaxSem
              ? "Advance these batches to alumni, or manually set a different semester."
              : uniformSem === null &&
                "Advance these batches to the next semester."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {uniformSem !== null && (
            <div className="flex gap-2">
              {!atMaxSem && (
                <Button
                  type="button"
                  variant={mode === "advance" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setMode("advance")}
                >
                  Advance by 1
                </Button>
              )}
              <Button
                type="button"
                variant={mode === "set" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setMode("set");
                  setTargetSem(uniformSem === ALUMNI_SEM ? "1" : uniformSem);
                }}
              >
                Manually set
              </Button>
              {atMaxSem && (
                <Button
                  type="button"
                  variant={mode === "alumni" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setMode("alumni")}
                >
                  <GraduationCap className="h-4 w-4" />
                  Convert to Alumni
                </Button>
              )}
            </div>
          )}

          {mode === "set" && uniformSem !== null && (
            <Select value={targetSem} onValueChange={setTargetSem}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEM_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    Semester {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {mode === "alumni" && (
            <p className="text-sm text-muted-foreground">
              This converts students of these batches to Alumni. <b>It&apos;s a one-way change.</b>
            </p>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
            {preview.map((b) => (
              <div key={b._id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm">
                <span className="truncate font-medium">{b.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline">{semLabel(b.sem)}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant={b.changed ? "default" : "secondary"}>{semLabel(b.nextSem)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={mode === "alumni" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
