"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Batch, listBatches, isAlumniSem } from "@/lib/api/batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronRight, Eye, Pencil, Trash2, Search, Plus, Upload, ArrowUpCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AddBatchDialog } from "./add-batch-dialog";
import { BatchDialog } from "./batch-dialog";
import { DeleteBatchDialog } from "./delete-batch-dialog";
import { BulkUploadBatchDialog } from "./bulk-upload-batch-dialog";
import { AdvanceSemesterDialog } from "./advance-semester-dialog";

const FETCH_LIMIT = 100;

const getDepartmentBadgeColor = (department: string) => {
  switch (department) {
    case "CSE": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "ECE": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "IT": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default: return "";
  }
};

interface YearGroupProps {
  year: number;
  batches: Batch[];
  defaultOpen: boolean;
  selectable: boolean;
  showSem: boolean;
  editable: boolean;
  selectedIds: Set<string>;
  onToggleBatch: (id: string) => void;
  onToggleYear?: (batches: Batch[]) => void;
  onView: (batch: Batch) => void;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
}

function BatchYearGroup({
  year,
  batches,
  defaultOpen,
  selectable,
  showSem,
  editable,
  selectedIds,
  onToggleBatch,
  onToggleYear,
  onView,
  onEdit,
  onDelete,
}: YearGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const allSelected = selectable && batches.every((b) => selectedIds.has(b._id));
  const someSelected = selectable && !allSelected && batches.some((b) => selectedIds.has(b._id));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-md border">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
          {selectable && (
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={() => onToggleYear?.(batches)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select all batches in ${year}`}
            />
          )}
          <CollapsibleTrigger asChild>
            <button type="button" className="flex flex-1 items-center gap-2 py-1 text-left">
              <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
              <span className="font-semibold">{year}</span>
              <Badge variant="secondary">{batches.length}</Badge>
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && <TableHead className="w-10" />}
                <TableHead>Batch Name</TableHead>
                {showSem && <TableHead>Semester</TableHead>}
                <TableHead>Scheme</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Batch Strength</TableHead>
                <TableHead>Staff Advisor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch._id}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(batch._id)}
                        onCheckedChange={() => onToggleBatch(batch._id)}
                        aria-label={`Select ${batch.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{batch.name}</TableCell>
                  {showSem && <TableCell>{batch.sem}</TableCell>}
                  <TableCell className="text-muted-foreground">{batch.scheme}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getDepartmentBadgeColor(batch.department)}>
                      {batch.department}
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.studentCount ?? "—"}</TableCell>
                  <TableCell>
                    {batch.staff_advisor ? (
                      <div>
                        <div className="font-medium">
                          {batch.staff_advisor.first_name} {batch.staff_advisor.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{batch.staff_advisor.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No advisor</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onView(batch)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {editable && (
                        <Button variant="ghost" size="icon" onClick={() => onEdit(batch)} title="Edit batch">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(batch)}
                        title="Delete batch"
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function BatchManagement() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addBatchDialogOpen, setAddBatchDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await listBatches({ limit: FETCH_LIMIT });
      setBatches(data.batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch batches");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleView = (batch: Batch) => {
    setSelectedBatch(batch);
    setDialogMode("view");
    setBatchDialogOpen(true);
  };

  const handleEdit = (batch: Batch) => {
    setSelectedBatch(batch);
    setDialogMode("edit");
    setBatchDialogOpen(true);
  };

  const handleDelete = (batch: Batch) => {
    setSelectedBatch(batch);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = async () => {
    await fetchBatches();
    setSelectedBatch(null);
  };

  const handleAddSuccess = async () => {
    await fetchBatches();
  };

  const handleUpdateSuccess = async () => {
    await fetchBatches();
  };

  const handleAdvanceSuccess = async () => {
    setSelectedIds(new Set());
    await fetchBatches();
  };

  const filteredBatches = batches.filter((batch) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    const advisor = batch.staff_advisor;
    return (
      batch?.name.toLowerCase().includes(query) ||
      batch.department.toLowerCase().includes(query) ||
      batch.adm_year.toString().includes(query) ||
      batch.sem?.toLowerCase().includes(query) ||
      batch.scheme?.toLowerCase().includes(query) ||
      advisor?.first_name?.toLowerCase().includes(query) ||
      advisor?.last_name?.toLowerCase().includes(query)
    );
  });

  const activeBatches = useMemo(() => filteredBatches.filter((b) => !isAlumniSem(b.sem)), [filteredBatches]);
  const alumniBatches = useMemo(() => filteredBatches.filter((b) => isAlumniSem(b.sem)), [filteredBatches]);

  const groupByYear = (list: Batch[]) => {
    const groups = new Map<number, Batch[]>();
    for (const batch of list) {
      const bucket = groups.get(batch.adm_year) ?? [];
      bucket.push(batch);
      groups.set(batch.adm_year, bucket);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  };

  const yearGroups = useMemo(() => groupByYear(activeBatches), [activeBatches]);
  const alumniYearGroups = useMemo(() => groupByYear(alumniBatches), [alumniBatches]);

  const toggleBatchSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleYearSelection = (yearBatches: Batch[]) => {
    const allSelected = yearBatches.every((b) => selectedIds.has(b._id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const b of yearBatches) {
        if (allSelected) next.delete(b._id);
        else next.add(b._id);
      }
      return next;
    });
  };

  const selectedBatches = batches.filter((b) => selectedIds.has(b._id));

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Batch Management</CardTitle>
              <CardDescription>Manage student batches and their staff advisors</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full md:w-62.5"
                />
              </div>
              <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddBatchDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Batch
              </Button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 mt-2">
              <span className="text-sm font-medium">
                {selectedIds.size} batch{selectedIds.size === 1 ? "" : "es"} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                <Button size="sm" onClick={() => setAdvanceDialogOpen(true)} className="gap-2">
                  <ArrowUpCircle className="h-4 w-4" />
                  Advance Semester
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : yearGroups.length === 0 && alumniYearGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No batches found matching your search" : "No batches available"}
            </div>
          ) : (
            <>
              {yearGroups.length > 0 && (
                <div className="space-y-3">
                  {yearGroups.map(([year, yearBatches], index) => (
                    <BatchYearGroup
                      key={year}
                      year={year}
                      batches={yearBatches}
                      defaultOpen={index === 0}
                      selectable
                      showSem
                      editable
                      selectedIds={selectedIds}
                      onToggleBatch={toggleBatchSelection}
                      onToggleYear={toggleYearSelection}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}

              {alumniYearGroups.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">Alumni</h3>
                    <Badge variant="secondary">{alumniBatches.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {alumniYearGroups.map(([year, yearBatches]) => (
                      <BatchYearGroup
                        key={year}
                        year={year}
                        batches={yearBatches}
                        defaultOpen={false}
                        selectable={false}
                        showSem={false}
                        editable={false}
                        selectedIds={selectedIds}
                        onToggleBatch={toggleBatchSelection}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddBatchDialog
        open={addBatchDialogOpen}
        onOpenChange={setAddBatchDialogOpen}
        onSuccess={handleAddSuccess}
      />

      <BatchDialog
        batch={selectedBatch}
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        mode={dialogMode}
        onSuccess={handleUpdateSuccess}
      />

      <DeleteBatchDialog
        batch={selectedBatch}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleDeleteSuccess}
      />

      <BulkUploadBatchDialog
        open={bulkUploadDialogOpen}
        onOpenChange={setBulkUploadDialogOpen}
        onSuccess={handleAddSuccess}
      />

      <AdvanceSemesterDialog
        batches={selectedBatches}
        open={advanceDialogOpen}
        onOpenChange={setAdvanceDialogOpen}
        onSuccess={handleAdvanceSuccess}
      />
    </>
  );
}
