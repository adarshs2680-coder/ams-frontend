"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Users,
  GraduationCap,
  Building,
  Flame,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Megaphone,
  Cpu,
  ChevronDown,
  Check
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { listBatches, type Batch } from "@/lib/api/batch";
import {
  createNotification,
  deleteNotification,
  getStoredReadIds,
  listMyNotifications,
  markNotificationRead,
  type NotificationRecord
} from "@/lib/api/notification";
import { useAuth } from "@/lib/auth-context";
import { FLAGS } from "@/lib/flags";

type UiNotification = {
  id: string;
  title: string;
  message: string;
  priorityLevel: string;
  notificationType: string;
  targetGroup?: string;
  createdAt?: string;
};

const PRIORITY_UI_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

const TYPE_UI_OPTIONS = [
  { value: "general", label: "General" },
  { value: "alert", label: "Alert" },
  { value: "academic", label: "Academic" },
  { value: "system", label: "System" }
];


const TARGET_USER_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
  { value: "hod", label: "HOD" },
  { value: "principal", label: "Principal" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" }
];

const mapPriorityToApi = (value: string) => {
  switch (value) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
    case "urgent":
      return "High";
    default:
      return "Low";
  }
};

const mapTypeToApi = (value: string) => {
  switch (value) {
    case "general":
      return "announcement";
    case "alert":
      return "info";
    case "academic":
      return "results";
    case "system":
      return "info";
    default:
      return "announcement";
  }
};

const mapTypeToUi = (value: string) => {
  switch (value) {
    case "announcement":
      return "general";
    case "results":
      return "academic";
    case "info":
    default:
      return "alert";
  }
};

const normalizeNotification = (notification: NotificationRecord, index: number): UiNotification => {
  const id = notification._id || notification.id || `notification-${index}`;
  const notificationType = notification.Notificationtype || notification.notificationType || "announcement";
  const priorityLevel = notification.priorityLevel || "Low";
  const createdAt = notification.createdAt || notification.created_at;

  return {
    id,
    title: notification.title || "Untitled",
    message: notification.message || "",
    priorityLevel,
    notificationType,
    targetGroup: notification.targetGroup,
    createdAt
  };
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case "High":
      return <Badge className="bg-red-500/10 text-red-700">High</Badge>;
    case "Medium":
      return <Badge className="bg-amber-500/10 text-amber-700">Medium</Badge>;
    case "Low":
    default:
      return <Badge className="bg-emerald-500/10 text-emerald-700">Low</Badge>;
  }
};

const getTypeBadge = (typeValue: string) => {
  const label = TYPE_UI_OPTIONS.find((option) => option.value === mapTypeToUi(typeValue))?.label || "Alert";
  return <Badge className="bg-blue-500/10 text-blue-700">{label}</Badge>;
};

const getNotificationCreatedTime = (createdAt?: string, id?: string) => {
  if (createdAt) {
    const createdTime = new Date(createdAt).getTime();
    if (!Number.isNaN(createdTime)) return createdTime;
  }

  if (id && /^[a-f\d]{24}$/i.test(id)) {
    return parseInt(id.slice(0, 8), 16) * 1000;
  }

  return 0;
};

const getPriorityRank = (priorityLevel: string) => {
  switch (priorityLevel.toLowerCase()) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
};

export default function NotificationsPage() {
  const { user, config } = useAuth();
  const notificationsEnabled = Boolean(config[FLAGS.NOTIFICATIONS]);
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const availableDepartments = useMemo(() => {
    const fromBatches = batches.map((b) => b.department).filter(Boolean);
    const defaults = ["CSE", "ECE", "IT", "EEE", "ME", "CE"];
    return Array.from(new Set([...fromBatches, ...defaults]));
  }, [batches]);

  const availableYears = useMemo(() => {
    const fromBatches = batches.map((b) => String(b.adm_year)).filter(Boolean);
    const defaults = ["2026", "2025", "2024", "2023"];
    const combined = Array.from(new Set([...fromBatches, ...defaults]));
    return combined.sort((a, b) => b.localeCompare(a));
  }, [batches]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNotification, setActiveNotification] = useState<UiNotification | null>(null);
  const [notificationToDelete, setNotificationToDelete] = useState<UiNotification | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canCreateNotification = user?.role === "teacher";
  const [formState, setFormState] = useState({
    targetGroup: "batch",
    targetID: "",
    targetUsers: ["student"] as string[],
    title: "",
    message: "",
    priorityLevel: "medium",
    notificationType: "general"
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listMyNotifications();
      const normalized = response.map((notification, index) => normalizeNotification(notification, index));
      setNotifications(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;
    fetchNotifications();
  }, [fetchNotifications, notificationsEnabled]);

  useEffect(() => {
    if (!user?._id) return;
    setReadIds(getStoredReadIds(user._id));
  }, [user?._id]);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!canCreateNotification) return;
      try {
        setBatchesLoading(true);
        setBatchesError(null);
        const response = await listBatches({ limit: 100 });
        setBatches(response.batches || []);
      } catch (err) {
        setBatchesError(err instanceof Error ? err.message : "Failed to load batches");
      } finally {
        setBatchesLoading(false);
      }
    };

    fetchBatches();
  }, [canCreateNotification]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const priorityDiff = getPriorityRank(b.priorityLevel) - getPriorityRank(a.priorityLevel);
      if (priorityDiff !== 0) return priorityDiff;
      const aTime = getNotificationCreatedTime(a.createdAt, a.id);
      const bTime = getNotificationCreatedTime(b.createdAt, b.id);
      return bTime - aTime;
    });
  }, [notifications]);

  useEffect(() => {
    if (!notificationsEnabled) {
      window.location.replace("/dashboard");
    }
  }, [notificationsEnabled]);

  if (!notificationsEnabled) {
    return null;
  }

  const handleRetry = () => {
    fetchNotifications();
  };

  const handleMarkRead = (id: string) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    markNotificationRead(id, user?._id);
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map((notification) => notification.id);
    allIds.forEach((id) => markNotificationRead(id, user?._id));
    setReadIds((prev) => Array.from(new Set([...prev, ...allIds])));
  };

  const hasUnread = notifications.some((notification) => !readIds.includes(notification.id));

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotificationToDelete(null);
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notification");
    }
  };

  const parseTargetUsers = (value: string[]) => value.filter(Boolean);


  const handleCreateNotification = async () => {
    setFormError(null);
    setSuccessMessage(null);

    if (!formState.title.trim() || !formState.message.trim()) {
      setFormError("Title and message are required.");
      return;
    }

    const targetUsers = parseTargetUsers(formState.targetUsers);
    if (targetUsers.length === 0) {
      setFormError("Target users are required.");
      return;
    }

    if (!formState.targetID.trim()) {
      setFormError("Target ID is required for batch notifications.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createNotification({
        targetGroup: formState.targetGroup,
        targetID: formState.targetID.trim() || undefined,
        targetUsers,
        title: formState.title.trim(),
        message: formState.message.trim(),
        priorityLevel: mapPriorityToApi(formState.priorityLevel),
        notificationType: mapTypeToApi(formState.notificationType)
      });

      setSuccessMessage("Notification created successfully.");
      setFormState({
        targetGroup: "batch",
        targetID: "",
        targetUsers: ["student"],
        title: "",
        message: "",
        priorityLevel: "medium",
        notificationType: "general"
      });
      await fetchNotifications();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create notification");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="container mx-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-2">
          {canCreateNotification && (
            <Button size="sm" onClick={() => setIsCreateOpen((s) => !s)}>
              {isCreateOpen ? "Close" : "Create"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} disabled={!hasUnread}>
            Mark all read
          </Button>
        </div>
      </div>

      {canCreateNotification && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden gap-0 rounded-xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/40">
              <DialogTitle className="text-lg font-semibold tracking-tight">Create Notification</DialogTitle>
              <DialogDescription className="sr-only">Post a notification for students, staff, or parents</DialogDescription>
            </div>

                  <div className="p-6 space-y-4">
                    {formError && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Selector Pills Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Target Users Dropdown */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>
                              {formState.targetUsers.length === 0
                                ? "Select Target"
                                : formState.targetUsers.length === 3
                                ? "All Users"
                                : formState.targetUsers.map((u) => u.charAt(0).toUpperCase() + u.slice(1)).join(", ")}
                            </span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 z-150">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Target Recipients</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {['student','staff','parent'].map((role) => {
                            const isChecked = formState.targetUsers.includes(role);
                            return (
                              <DropdownMenuCheckboxItem
                                key={role}
                                checked={isChecked}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={(checked) => {
                                  setFormState((prev) => {
                                    const current = new Set(prev.targetUsers);
                                    if (checked) current.add(role);
                                    else current.delete(role);
                                    return { ...prev, targetUsers: Array.from(current) };
                                  });
                                }}
                                className="text-xs capitalize cursor-pointer"
                              >
                                {role}
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* 2. Target Group Dropdown */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            <Building className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="capitalize">Group: {formState.targetGroup}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 z-150">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Target Group</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {[
                            { value: "college", label: "College" },
                            { value: "year", label: "Year" },
                            { value: "batch", label: "Batch" },
                            { value: "department", label: "Department" }
                          ].map((item) => (
                            <DropdownMenuItem
                              key={item.value}
                              onSelect={() => setFormState((prev) => ({ ...prev, targetGroup: item.value, targetID: "" }))}
                              className="text-xs flex items-center justify-between cursor-pointer"
                            >
                              <span>{item.label}</span>
                              {formState.targetGroup === item.value && <Check className="w-3.5 h-3.5 text-primary ml-2 shrink-0" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* 3. Dynamic Target ID Dropdown depending on targetGroup */}
                      {formState.targetGroup === "batch" && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[140px]">
                                {batchesLoading
                                  ? "Loading..."
                                  : batches.find((b) => b._id === formState.targetID || b.id === formState.targetID || b.name === formState.targetID)?.name || "Select Batch"}
                              </span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 max-h-60 overflow-y-auto z-150">
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Select Batch</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {batches.map((batch) => {
                              const val = batch._id || batch.id || batch.name;
                              return (
                                <DropdownMenuItem
                                  key={batch._id}
                                  onSelect={() => setFormState((prev) => ({ ...prev, targetID: val }))}
                                  className="text-xs flex items-center justify-between cursor-pointer"
                                >
                                  <span className="truncate">{batch.name}{batch.id ? ` (${batch.id})` : ""}</span>
                                  {formState.targetID === val && <Check className="w-3.5 h-3.5 text-primary ml-2 shrink-0" />}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {formState.targetGroup === "year" && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>
                                {formState.targetID ? `Year: ${formState.targetID}` : "Select Year"}
                              </span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto z-150">
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Select Year</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableYears.map((yr) => (
                              <DropdownMenuItem
                                key={yr}
                                onSelect={() => setFormState((prev) => ({ ...prev, targetID: yr }))}
                                className="text-xs flex items-center justify-between cursor-pointer"
                              >
                                <span>Year {yr}</span>
                                {formState.targetID === yr && <Check className="w-3.5 h-3.5 text-primary ml-2 shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {formState.targetGroup === "department" && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            >
                              <Building className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>
                                {formState.targetID
                                  ? `Dept: ${formState.targetID}`
                                  : "Select Department"}
                              </span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto z-150">
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Select Department</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableDepartments.map((dept) => (
                              <DropdownMenuItem
                                key={dept}
                                onSelect={() => setFormState((prev) => ({ ...prev, targetID: dept }))}
                                className="text-xs flex items-center justify-between cursor-pointer"
                              >
                                <span>{dept}</span>
                                {formState.targetID === dept && <Check className="w-3.5 h-3.5 text-primary ml-2 shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Center Stage: Title & Message Area */}
                    <div className="space-y-3 pt-3 border-t border-border/40">
                      <Input
                        value={formState.title}
                        onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Title (e.g. Midterm Exam Schedule)"
                        className="text-base font-semibold border border-border/60 bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring px-4 py-3 h-11 rounded-lg placeholder:text-muted-foreground/50 shadow-xs"
                      />
                      <Textarea
                        value={formState.message}
                        onChange={(event) => setFormState((prev) => ({ ...prev, message: event.target.value }))}
                        placeholder="Share notification body details..."
                        rows={6}
                        className="min-h-40 resize-none border border-border/60 bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring p-4 rounded-lg text-sm leading-relaxed placeholder:text-muted-foreground/40 shadow-xs"
                      />
                    </div>

                  </div>

                  {/* Bottom Toolbar: Priority Level & Notification Type as Icon Pills with Labels */}
                  <div className="flex items-center justify-between px-6 py-3.5 bg-muted/20 border-t border-border/50">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Level Selector */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            {formState.priorityLevel === "high" ? (
                              <>
                                <Flame className="w-4 h-4 text-red-500" />
                                <span>High Priority</span>
                              </>
                            ) : formState.priorityLevel === "medium" ? (
                              <>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>Medium Priority</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span>Low Priority</span>
                              </>
                            )}
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 z-150">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Priority Level</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setFormState((prev) => ({ ...prev, priorityLevel: "low" }))} className="text-xs flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              <span>Low</span>
                            </div>
                            {formState.priorityLevel === "low" && <Check className="w-3.5 h-3.5 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setFormState((prev) => ({ ...prev, priorityLevel: "medium" }))} className="text-xs flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              <span>Medium</span>
                            </div>
                            {formState.priorityLevel === "medium" && <Check className="w-3.5 h-3.5 text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setFormState((prev) => ({ ...prev, priorityLevel: "high" }))} className="text-xs flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Flame className="w-4 h-4 text-red-500" />
                              <span>High</span>
                            </div>
                            {formState.priorityLevel === "high" && <Check className="w-3.5 h-3.5 text-primary" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Notification Type Selector */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            {formState.notificationType === "alert" ? (
                              <>
                                <AlertOctagon className="w-4 h-4 text-amber-500" />
                                <span>Alert</span>
                              </>
                            ) : formState.notificationType === "academic" ? (
                              <>
                                <GraduationCap className="w-4 h-4 text-indigo-500" />
                                <span>Academic</span>
                              </>
                            ) : formState.notificationType === "system" ? (
                              <>
                                <Cpu className="w-4 h-4 text-purple-500" />
                                <span>System</span>
                              </>
                            ) : (
                              <>
                                <Megaphone className="w-4 h-4 text-blue-500" />
                                <span>General</span>
                              </>
                            )}
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44 z-150">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Notification Type</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {[
                            { value: "general", label: "General", icon: <Megaphone className="w-4 h-4 text-blue-500" /> },
                            { value: "alert", label: "Alert", icon: <AlertOctagon className="w-4 h-4 text-amber-500" /> },
                            { value: "academic", label: "Academic", icon: <GraduationCap className="w-4 h-4 text-indigo-500" /> },
                            { value: "system", label: "System", icon: <Cpu className="w-4 h-4 text-purple-500" /> }
                          ].map((item) => (
                            <DropdownMenuItem
                              key={item.value}
                              onSelect={() => setFormState((prev) => ({ ...prev, notificationType: item.value }))}
                              className="text-xs flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                {item.icon}
                                <span>{item.label}</span>
                              </div>
                              {formState.notificationType === item.value && <Check className="w-3.5 h-3.5 text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleCreateNotification}
                        disabled={isSubmitting}
                        className="rounded-full px-6 font-medium text-xs shadow-xs"
                      >
                        {isSubmitting ? "Posting..." : "Post"}
                      </Button>
                    </div>
                  </div>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Inbox
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          ) : sortedNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedNotifications.map((notification) => {
                const isRead = readIds.includes(notification.id);
                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveNotification(notification)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveNotification(notification);
                      }
                    }}
                    className={`rounded-lg border p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isRead ? "border-border bg-muted/20" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate" title={notification.title}>
                            {notification.title}
                          </h3>
                          {getPriorityBadge(notification.priorityLevel)}
                          {getTypeBadge(notification.notificationType)}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1" title={notification.message}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={isRead ? "text-emerald-600" : "text-amber-600"}>
                            {isRead ? "Read" : "Unread"}
                          </span>
                          {notification.targetGroup && (
                            <>
                              <span>•</span>
                              <span>Group: {notification.targetGroup}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-end">
                        {!isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-center md:w-auto"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleMarkRead(notification.id);
                            }}
                          >
                            Mark as Read
                          </Button>
                        )}
                        {canCreateNotification && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-center text-destructive md:w-auto"
                            onClick={(event) => {
                              event.stopPropagation();
                              setNotificationToDelete(notification);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {notificationToDelete && (
        <Dialog open={!!notificationToDelete} onOpenChange={(open) => !open && setNotificationToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you sure you want to delete this?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the notification titled &quot;{notificationToDelete.title}&quot;.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotificationToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (notificationToDelete) handleDelete(notificationToDelete.id);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={Boolean(activeNotification)} onOpenChange={(open) => {
        if (!open) setActiveNotification(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeNotification?.title}</DialogTitle>
            <DialogDescription>
              {activeNotification?.notificationType ? getTypeBadge(activeNotification.notificationType) : null}
            </DialogDescription>
          </DialogHeader>
          {activeNotification && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground whitespace-pre-wrap">{activeNotification.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                {getPriorityBadge(activeNotification.priorityLevel)}
                {activeNotification.targetGroup && (
                  <span className="text-xs text-muted-foreground">Group: {activeNotification.targetGroup}</span>
                )}
                {activeNotification.createdAt && (
                  <span className="text-xs text-muted-foreground">
                    Created: {new Date(activeNotification.createdAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}