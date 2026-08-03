"use client";

import { useState, useEffect, useCallback } from "react";
import { Subject, listSubjects, listSchemes } from "@/lib/api/subject";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronRight, Eye, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AddSubjectDialog } from "./add-subject-dialog";
import { SubjectDialog } from "./subject-dialog";
import { DeleteSubjectDialog } from "./delete-subject-dialog";
import { BulkUploadSubjectDialog } from "./bulk-upload-subject-dialog";

const SEMESTERS = Array.from({ length: 8 }, (_, i) => i + 1);
const FETCH_LIMIT = 100;

export function SubjectManagement() {
  const [schemes, setSchemes] = useState<string[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<string>("");
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [schemesError, setSchemesError] = useState<string | null>(null);

  const [openSems, setOpenSems] = useState<Set<number>>(new Set());
  const [subjectsBySem, setSubjectsBySem] = useState<Record<number, Subject[]>>({});
  const [loadingSems, setLoadingSems] = useState<Set<number>>(new Set());
  const [semErrors, setSemErrors] = useState<Record<number, string>>({});

  // Dialog states
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addSubjectDialogOpen, setAddSubjectDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setSchemesLoading(true);
        setSchemesError(null);
        const result = await listSchemes();
        setSchemes(result);
        if (result.length > 0) setSelectedScheme(result[0]);
      } catch (err) {
        setSchemesError(err instanceof Error ? err.message : "Failed to fetch schemes");
      } finally {
        setSchemesLoading(false);
      }
    })();
  }, []);

  // Scheme changed — every semester's cached data belongs to the old scheme.
  useEffect(() => {
    setOpenSems(new Set());
    setSubjectsBySem({});
    setSemErrors({});
  }, [selectedScheme]);

  const loadSem = useCallback(
    async (sem: number, force = false) => {
      if (!selectedScheme) return;
      if (!force && subjectsBySem[sem] !== undefined) return;

      setLoadingSems((prev) => new Set(prev).add(sem));
      setSemErrors((prev) => {
        const next = { ...prev };
        delete next[sem];
        return next;
      });

      try {
        const data = await listSubjects({ scheme: selectedScheme, sem: String(sem), limit: FETCH_LIMIT });
        setSubjectsBySem((prev) => ({ ...prev, [sem]: data.subjects }));
      } catch (err) {
        setSemErrors((prev) => ({
          ...prev,
          [sem]: err instanceof Error ? err.message : "Failed to fetch subjects",
        }));
      } finally {
        setLoadingSems((prev) => {
          const next = new Set(prev);
          next.delete(sem);
          return next;
        });
      }
    },
    [selectedScheme, subjectsBySem]
  );

  const toggleSem = (sem: number) => {
    setOpenSems((prev) => {
      const next = new Set(prev);
      if (next.has(sem)) {
        next.delete(sem);
      } else {
        next.add(sem);
        loadSem(sem);
      }
      return next;
    });
  };

  const refreshOpenSems = useCallback(() => {
    for (const sem of openSems) loadSem(sem, true);
  }, [openSems, loadSem]);

  const handleView = (subject: Subject) => {
    setSelectedSubject(subject);
    setDialogMode("view");
    setSubjectDialogOpen(true);
  };

  const handleEdit = (subject: Subject) => {
    setSelectedSubject(subject);
    setDialogMode("edit");
    setSubjectDialogOpen(true);
  };

  const handleDelete = (subject: Subject) => {
    setSelectedSubject(subject);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = async () => {
    refreshOpenSems();
    setSelectedSubject(null);
  };

  const handleAddSuccess = async () => {
    refreshOpenSems();
  };

  const handleUpdateSuccess = async () => {
    refreshOpenSems();
  };

  const getTypeBadgeColor = (type: string) => {
    return type === "Theory"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Subject Management</CardTitle>
              <CardDescription>Manage course subjects, grouped by scheme and semester</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddSubjectDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Subject
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {schemesError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{schemesError}</AlertDescription>
            </Alert>
          )}

          {schemesLoading ? (
            <Skeleton className="h-9 w-full max-w-md" />
          ) : schemes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No subjects available yet — add one to get started.
            </div>
          ) : (
            <>
              <ToggleGroup
                type="single"
                variant="outline"
                value={selectedScheme}
                onValueChange={(value) => value && setSelectedScheme(value)}
                className="mb-4 flex-wrap justify-start"
              >
                {schemes.map((scheme) => (
                  <ToggleGroupItem key={scheme} value={scheme} className="px-4">
                    {scheme}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="space-y-3">
                {SEMESTERS.map((sem) => {
                  const isOpen = openSems.has(sem);
                  const isLoading = loadingSems.has(sem);
                  const subjects = subjectsBySem[sem];
                  const error = semErrors[sem];

                  return (
                    <Collapsible key={sem} open={isOpen} onOpenChange={() => toggleSem(sem)}>
                      <div className="rounded-md border">
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2.5 bg-muted/30 text-left"
                          >
                            <ChevronRight
                              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                            />
                            <span className="font-semibold">Semester {sem}</span>
                            {subjects && <Badge variant="secondary">{subjects.length}</Badge>}
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          {isLoading ? (
                            <div className="space-y-2 p-3">
                              {[...Array(2)].map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                              ))}
                            </div>
                          ) : error ? (
                            <Alert variant="destructive" className="m-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          ) : !subjects || subjects.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              No subjects in this semester yet.
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Subject Code</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Marks</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {subjects.map((subject) => (
                                  <TableRow key={subject._id}>
                                    <TableCell className="font-medium">{subject.subject_code}</TableCell>
                                    <TableCell>{subject.name}</TableCell>
                                    <TableCell>{subject.department || "—"}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={getTypeBadgeColor(subject.type)}>
                                        {subject.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="text-sm">
                                        <div>Total: {subject.total_marks}</div>
                                        <div className="text-muted-foreground">Pass: {subject.pass_mark}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleView(subject)}
                                          title="View details"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEdit(subject)}
                                          title="Edit subject"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDelete(subject)}
                                          title="Delete subject"
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddSubjectDialog
        open={addSubjectDialogOpen}
        onOpenChange={setAddSubjectDialogOpen}
        onSuccess={handleAddSuccess}
      />

      <SubjectDialog
        subject={selectedSubject}
        open={subjectDialogOpen}
        onOpenChange={setSubjectDialogOpen}
        mode={dialogMode}
        onSuccess={handleUpdateSuccess}
      />

      <DeleteSubjectDialog
        subject={selectedSubject}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />

      <BulkUploadSubjectDialog
        open={bulkUploadDialogOpen}
        onOpenChange={setBulkUploadDialogOpen}
        onSuccess={handleAddSuccess}
      />
    </>
  );
}
