"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { listUsers, deleteUserById } from "@/lib/api/user";
import { User, UserRole, PaginationInfo } from "@/lib/types/UserTypes";
import { Batch, listBatches } from "@/lib/api/batch";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Eye, Pencil, Trash2, Search, UserPlus, Upload, Download, Loader2, ChevronRight, ChevronDown, Folder, Users, LayoutList } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserDialog } from "./user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import { AddUserDialog } from "./add-user-dialog";
import { BulkUploadDialog, TEMPLATE_HEADERS, downloadTextFile } from "./bulk-upload-dialog";

const DEFAULT_ITEMS_PER_PAGE = 10;

type TabValue = "student" | "parent" | "staff";
type SortOption = "name-asc" | "name-desc" | "created-desc" | "created-asc";

const ROLE_TABS: { value: TabValue; label: string; roles: UserRole[] }[] = [
  { value: "student", label: "Students", roles: ["student"] },
  { value: "parent",  label: "Parents",  roles: ["parent"]  },
  { value: "staff",   label: "Staffs",   roles: ["teacher", "admin", "hod", "principal", "staff"] },
];

export default function UsersPage() {
  const [users, setUsers]               = useState<User[]>([]);
  const [pagination, setPagination]     = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [currentPage, setCurrentPage]   = useState(1);
  const [selectedTab, setSelectedTab]   = useState<TabValue>("student");
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [sortOption, setSortOption]     = useState<SortOption>("name-asc");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string | "all">("all");
  const [expandedYears, setExpandedYears] = useState<number[]>([]);

  const [selectedUser, setSelectedUser]         = useState<User | null>(null);
  const [userDialogOpen, setUserDialogOpen]     = useState(false);
  const [dialogMode, setDialogMode]             = useState<"view" | "edit">("view");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addUserDialogOpen, setAddUserDialogOpen]     = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  useEffect(() => {
    const fetchAllBatches = async () => {
      try {
        const data = await listBatches({ limit: 100 });
        setBatches(data.batches);
      } catch (err) {
        console.error("Failed to fetch batches", err);
      }
    };
    fetchAllBatches();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set(batches.map(b => b.adm_year).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  }, [batches]);

  const availableDepartments = useMemo(() => {
    if (selectedYear === "all") return [];
    const depts = new Set(batches.filter(b => b.adm_year === selectedYear).map(b => b.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [batches, selectedYear]);

  useEffect(() => {
    if (selectedYear === "all") {
      if (selectedDepartment !== "all") setSelectedDepartment("all");
      return;
    }
    if (availableDepartments.length > 0 && (selectedDepartment === "all" || !availableDepartments.includes(selectedDepartment as any))) {
      setSelectedDepartment(availableDepartments[0]);
    } else if (availableDepartments.length === 0 && selectedDepartment !== "all") {
      setSelectedDepartment("all");
    }
  }, [selectedYear, availableDepartments, selectedDepartment]);

  const selectedBatchId = useMemo(() => {
    if (selectedYear === "all" || selectedDepartment === "all") return undefined;
    const batch = batches.find(b => b.adm_year === selectedYear && b.department === selectedDepartment);
    return batch?._id;
  }, [selectedYear, selectedDepartment, batches]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const currentTabConfig = ROLE_TABS.find((tab) => tab.value === selectedTab);
      if (!currentTabConfig) return;

      if (selectedTab === "staff") {
        const allStaffUsers: User[] = [];
        for (const role of currentTabConfig.roles) {
          try {
            const data = await listUsers({ role, page: 1, limit: 100, search: activeSearch || undefined });
            allStaffUsers.push(...data.users);
          } catch (err) { console.error(err); }
        }
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex   = startIndex + itemsPerPage;
        setUsers(allStaffUsers.slice(startIndex, endIndex));
        setPagination({
          currentPage,
          totalPages:    Math.ceil(allStaffUsers.length / itemsPerPage),
          totalUsers:    allStaffUsers.length,
          limit:         itemsPerPage,
          hasNextPage:   endIndex < allStaffUsers.length,
          hasPreviousPage: currentPage > 1,
        });
      } else {
        const payload: any = {
          role:   currentTabConfig.roles[0],
          page:   currentPage,
          limit:  itemsPerPage,
          search: activeSearch || undefined,
        };
        if (selectedTab === "student" && selectedBatchId) payload.batch = selectedBatchId;
        const data = await listUsers(payload);
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTab, currentPage, activeSearch, itemsPerPage, selectedBatchId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const sortedUsers = useMemo(() => {
    const cloned = [...users];
    switch (sortOption) {
      case "name-desc": return cloned.sort((a, b) => b.name.localeCompare(a.name));
      case "created-desc": return cloned.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case "created-asc": return cloned.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case "name-asc":
      default: return cloned.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [users, sortOption]);

  const handleDelete = async (userId: string) => {
    try {
      await deleteUserById(userId);
      await fetchUsers();
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (err) { setError("Failed to delete user"); }
  };

  /** Fetches every user matching the currently active filters (tab/batch/search), across all pages. */
  const fetchAllUsersForExport = useCallback(async (): Promise<User[]> => {
    const currentTabConfig = ROLE_TABS.find((tab) => tab.value === selectedTab);
    if (!currentTabConfig) return [];

    const allExportUsers: User[] = [];
    for (const role of currentTabConfig.roles) {
      let page = 1;
      const limit = 100;
      while (true) {
        const payload: any = { role, page, limit, search: activeSearch || undefined };
        if (selectedTab === "student" && selectedBatchId) payload.batch = selectedBatchId;
        const data = await listUsers(payload);
        allExportUsers.push(...data.users);
        if (data.users.length === 0 || page >= data.pagination.totalPages) break;
        page++;
      }
    }
    return allExportUsers;
  }, [selectedTab, activeSearch, selectedBatchId]);

  // Export uses the same template as bulk-upload, minus "Generate Mails"
  // (existing users don't need a mail-generation instruction).
  const EXPORT_HEADERS = TEMPLATE_HEADERS.filter((h) => h !== "Generate Mails");

  const formatDateOnly = (value?: string): string => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
  };

  const batchIdById = useMemo(() => new Map(batches.map((b) => [b._id, b.id])), [batches]);

  const buildExportRow = (user: User): string[] => {
    const p = (user.profile ?? {}) as any;
    const batch = p.batch;
    const batchValue = batch
      ? typeof batch === "string"
        ? batchIdById.get(batch) ?? ""
        : batch.id || batchIdById.get(batch._id) || ""
      : "";

    return [
      user.first_name ?? "",
      user.last_name ?? "",
      user.role,
      user.email ?? "",
      "",
      p.adm_number ?? "",
      p.adm_year != null ? String(p.adm_year) : "",
      p.candidate_code ?? "",
      p.department ?? "",
      formatDateOnly(p.date_of_birth),
      batchValue,
    ];
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const exportUsers = await fetchAllUsersForExport();
      const csv = Papa.unparse({
        fields: [...EXPORT_HEADERS],
        data: exportUsers.map(buildExportRow),
      });

      const scopeLabel =
        selectedTab === "student" && selectedBatchId
          ? (batches.find((b) => b._id === selectedBatchId)?.name || "batch").replace(/\s+/g, "-")
          : selectedTab;

      downloadTextFile(`ams-users-${scopeLabel}-${Date.now()}.csv`, csv + "\n");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export users");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setActiveSearch(searchQuery);
      setCurrentPage(1);
    }
  };

  const startItem = pagination ? (pagination.currentPage - 1) * pagination.limit + 1 : 0;
  const endItem   = pagination ? Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers) : 0;

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive", principal: "destructive", hod: "secondary", teacher: "secondary", student: "default", parent: "outline", staff: "outline",
    };
    return variants[role] || "default";
  };

  return (
    <>
      <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="mb-10">
              <CardTitle className="text-3xl font-bold tracking-tight">User Management</CardTitle>
              <CardDescription>View, edit, and manage all users in the system</CardDescription>
            </div>
            <div className="flex w-full md:w-auto flex-col md:flex-row gap-2">
              <Button variant="outline" onClick={handleExportCsv} disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setBulkUploadDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
              <Button onClick={() => setAddUserDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Add New User</Button>
            </div>
          </div>

          <CardContent className="space-y-4">
            <Tabs value={selectedTab} onValueChange={(v) => { setSelectedTab(v as TabValue); setCurrentPage(1); setSearchQuery(""); setActiveSearch(""); }} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                {ROLE_TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or candidate code... (Press Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="pl-9"
              />
            </div>

            <div className={selectedTab === "student" ? "flex flex-col lg:flex-row rounded-lg border shadow-sm overflow-hidden bg-card" : ""}>
              {selectedTab === "student" && (
                <aside className="w-full lg:w-64 xl:w-72 shrink-0 border-b lg:border-b-0 lg:border-r bg-muted/10 p-4 space-y-4">
                  <h3 className="text-sm font-semibold px-2 tracking-tight text-muted-foreground uppercase">Directory</h3>
                  <Button variant={selectedYear === "all" ? "secondary" : "ghost"} className="w-full justify-start font-medium" onClick={() => { setSelectedYear("all"); setSelectedDepartment("all"); setCurrentPage(1); }}>
                    <Users className="mr-2 h-4 w-4" /> All Students
                  </Button>
                  <div className="space-y-1">
                    {availableYears.map(year => {
                      const isExpanded = expandedYears.includes(year);
                      const uniqueDepts = Array.from(new Set(batches.filter(b => b.adm_year === year).map(b => b.department))).sort();
                      return (
                        <div key={year} className="space-y-1">
                          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground" onClick={() => toggleYear(year)}>
                            {isExpanded ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronRight className="mr-1.5 h-4 w-4" />}
                            <Folder className="mr-2 h-4 w-4" /> {year} Batch
                          </Button>
                          {isExpanded && (
                            <div className="ml-4 pl-3 border-l border-border/50 flex flex-col gap-1 my-1">
                              {uniqueDepts.map((dept, idx) => (
                                <Button key={idx} variant={selectedYear === year && selectedDepartment === dept ? "secondary" : "ghost"} className="w-full justify-start h-8 px-2 text-sm" onClick={() => { setSelectedYear(year); setSelectedDepartment(dept); setCurrentPage(1); }}>
                                  <LayoutList className="mr-2 h-3.5 w-3.5 opacity-70" /> {dept}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}

              <div className="flex-1 min-w-0 flex flex-col bg-card">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <div className={selectedTab === "student" ? "overflow-x-auto" : "rounded-md border shadow-sm bg-card overflow-x-auto"}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden md:table-cell">Role</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {selectedTab === "student" ? "Candidate Code / Adm No." : selectedTab === "staff" ? "Designation" : "Relation"}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">Info</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-48" /></TableCell><TableCell><Skeleton className="h-4 w-20" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell><TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      )) : users.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-112 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>No users found</p></TableCell></TableRow>
                      ) : sortedUsers.map((user) => {
                        const p = (user.profile ?? {}) as any;
                        return (
                          <TableRow key={user._id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-[10px] text-muted-foreground md:hidden">{p.candidate_code || p.adm_number}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-50 truncate">{user.email}</TableCell>
                            <TableCell className="hidden md:table-cell"><Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge></TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {selectedTab === "student" ? (
                                <div className="flex flex-col">
                                  <span className="font-medium">{p.candidate_code || "—"}</span>
                                  {p.adm_number && <span className="text-[10px] text-muted-foreground opacity-70">Adm: {p.adm_number}</span>}
                                </div>
                              ) : selectedTab === "staff" ? p.designation : p.relation}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{p.department || user.phone || "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDialogMode("view"); setUserDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDialogMode("edit"); setUserDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {pagination && (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
                    <p className="text-xs text-muted-foreground">Showing {startItem}–{endItem} of {pagination.totalUsers} users</p>
                    <div className="flex items-center gap-2">
                      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                        <SelectTrigger className="w-40 text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="name-asc">Name (A-Z)</SelectItem><SelectItem value="name-desc">Name (Z-A)</SelectItem><SelectItem value="created-desc">Newest</SelectItem></SelectContent>
                      </Select>
                      <Pagination className="w-auto ml-auto">
                        <PaginationContent>
                          <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p-1))} className={!pagination.hasPreviousPage ? "opacity-30 pointer-events-none" : "cursor-pointer"} /></PaginationItem>
                          <PaginationItem><PaginationNext onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p+1))} className={!pagination.hasNextPage ? "opacity-30 pointer-events-none" : "cursor-pointer"} /></PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </div>
      {selectedUser && (
        <>
          <UserDialog user={selectedUser} open={userDialogOpen} onOpenChange={setUserDialogOpen} initialMode={dialogMode} onSuccess={fetchUsers} />
          <DeleteUserDialog user={selectedUser} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={() => handleDelete(selectedUser._id)} />
        </>
      )}
      <AddUserDialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen} onSuccess={fetchUsers} />
      <BulkUploadDialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen} onSuccess={fetchUsers} />
    </>
  );
}