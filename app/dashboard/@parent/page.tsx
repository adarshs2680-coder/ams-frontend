"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useState, useCallback } from "react";
import GreetingHeader from "@/components/student/greeting-header";
import AttendanceOverview from "@/components/student/attendance-overview";
import NotificationsList from "@/components/student/notifications-list";
import { type SubjectAttendanceStats } from "@/lib/api/attendance-stats";
import { getStoredReadIds, markNotificationRead, type NotificationRecord } from "@/lib/api/notification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { genConfig } from "react-nice-avatar";
import NiceAvatar from "react-nice-avatar";

interface Child {
  _id: string;
  name: string;
  email: string;
  image?: string;
  gender?: string;
  profile: {
    admission_number: string;
    department: { _id: string; name: string };
    batch: { _id: string; name: string };
  };
}

interface ParentProfile {
  child?: Child | string;
}

const mapNotificationType = (notificationType: string) => {
  switch (notificationType) {
    case "results":
      return "success" as const;
    case "info":
      return "info" as const;
    case "announcement":
    default:
      return "announcement" as const;
  }
};

const getNotificationCreatedTime = (createdAt?: string, id?: string) => {
  if (createdAt) {
    const createdTime = new Date(createdAt).getTime();
    if (!Number.isNaN(createdTime)) return createdTime;
  }

  if (id && /^[a-f\d]{24}$/i.test(id)) {
    return parseInt(id.slice(0, 8), 16) * 1000;
  }

  return Date.now();
};

const normalizeNotification = (notification: NotificationRecord, index: number) => {
  const id = notification._id || notification.id || `notification-${index}`;
  const typeValue = notification.Notificationtype || notification.notificationType || "announcement";
  const createdAtValue = notification.createdAt || notification.created_at;
  const createdTime = getNotificationCreatedTime(createdAtValue, id);

  return {
    id,
    title: notification.title || "Untitled",
    message: notification.message || "",
    type: mapNotificationType(typeValue),
    postedBy: "System",
    postedAt: new Date(createdTime),
    priorityLevel: notification.priorityLevel,
    isRead: false,
  };
};

export default function ParentDashboardPage() {
  const { user, session } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [attendance, setAttendance] = useState<SubjectAttendanceStats[]>([]);
  const [notifications, setNotifications] = useState<ReturnType<typeof normalizeNotification>[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithToken = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!session) {
      return new Response(JSON.stringify({ message: "Not authenticated" }), { status: 401 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error("API endpoint is not configured. Please set the NEXT_PUBLIC_API_URL environment variable.");
    }

    return fetch(`${apiUrl}${url}`, {
      ...options,
      credentials: "include",
    });
  }, [session]);

  useEffect(() => {
    const initializeDashboard = async () => {
      if (!user || !session) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotificationsLoading(true);
      setNotificationsError(null);
      setError(null);

      const childDataOrId = (user.profile as ParentProfile | undefined)?.child;

      if (!childDataOrId) {
        setError("Child information is not linked to your account. Please complete your profile in the onboarding section.");
        setLoading(false);
        setNotificationsLoading(false);
        return;
      }

      try {
        let childDetails: Child | null = null;

        if (typeof childDataOrId === "string") {
          const res = await fetchWithToken(`/user/${childDataOrId}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch child details (status: ${res.status})`);
          }
          const childUser = (await res.json()) as { data?: Child } & Record<string, unknown>;
          childDetails = (childUser.data || childUser) as Child;
        } else if (typeof childDataOrId === "object" && childDataOrId !== null && "_id" in childDataOrId) {
          childDetails = childDataOrId;
        }

        if (!childDetails) {
          throw new Error("Child details could not be resolved from profile.");
        }

        setChild(childDetails);

        const childId = childDetails._id;
        if (!childId) {
          throw new Error("Child's data is incomplete (missing ID).");
        }

        const [attendanceRes, notificationsRes] = await Promise.all([
          fetchWithToken(`/attendance/stats?for_user=${childId}`),
            fetchWithToken(`/notifications?limit=5`),
        ]);

        if (!attendanceRes.ok) {
          throw new Error("Failed to fetch attendance data.");
        }

        const attendancePayload = (await attendanceRes.json()) as { data?: SubjectAttendanceStats[] } & Record<string, unknown>;
        setAttendance((attendancePayload.data || []) as SubjectAttendanceStats[]);

        if (!notificationsRes.ok) {
          throw new Error("Failed to fetch child notifications");
        }

        const notificationsPayload = (await notificationsRes.json()) as {
          notifications?: NotificationRecord[];
          data?: { notifications?: NotificationRecord[] };
        } & Record<string, unknown>;
        const rawNotifications: NotificationRecord[] = Array.isArray(notificationsPayload)
          ? notificationsPayload
          : notificationsPayload?.notifications || notificationsPayload?.data?.notifications || [];

        const readIds = getStoredReadIds(user._id);
        const normalizedNotifications = rawNotifications.map((notification, index) => {
          const normalizedNotification = normalizeNotification(notification, index);
          return {
            ...normalizedNotification,
            isRead: readIds.includes(normalizedNotification.id),
          };
        });

        setNotifications(normalizedNotifications);
        setError(null);
      } catch (err) {
        console.error("Parent Dashboard Error:", err);
        setError(err instanceof Error ? err.message : "An error occurred while fetching your child's data.");
        setAttendance([]);
        setNotifications([]);
      } finally {
        setLoading(false);
        setNotificationsLoading(false);
      }
    };

    initializeDashboard();
  }, [fetchWithToken, session, user]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => {
      prev.forEach((notification) => {
        markNotificationRead(notification.id, user?._id);
      });
      return prev.map((notification) => ({ ...notification, isRead: true }));
    });
  };

  const profileImageConfig = useMemo(() => genConfig(child?.email || ""), [child?.email]);
  const hasUnread = notifications.some((notification) => !notification.isRead);

  return (
    <div className="container mx-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6">
      <GreetingHeader userName={user?.first_name || user?.name || "Parent"} />

      {child ? (
        <Card className="border-primary/20 bg-linear-to-br from-background to-primary/5">
          <CardHeader className="flex flex-row items-center gap-4">
            {child.image && child.image !== "gen" ? (
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={child.image} alt={child.name} />
                <AvatarFallback>{child.name?.[0] || "C"}</AvatarFallback>
              </Avatar>
            ) : (
              <NiceAvatar {...profileImageConfig} className="h-16 w-16 shrink-0" />
            )}
            <div className="text-left">
              <CardTitle className="text-2xl">{child.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Viewing your child’s current progress and updates</p>
              <div className="text-muted-foreground flex flex-wrap justify-start gap-x-4 gap-y-1 mt-2 text-sm">
                <span>{child.profile.admission_number}</span>
                <span>{child.profile.department.name}</span>
                <span>{child.profile.batch.name}</span>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ) : attendance.length > 0 ? (
            <AttendanceOverview
              attendance={attendance}
              warningText="⚠️ Your child's attendance is below 75%. Please encourage regular attendance."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No attendance data available yet.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {notificationsLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : notificationsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{notificationsError}</AlertDescription>
            </Alert>
          ) : (
            <NotificationsList
              notifications={notifications}
              hasUnread={hasUnread}
              onMarkAllRead={handleMarkAllRead}
            />
          )}
        </div>
      </div>
    </div>
  );
}