"use client";

import { useEffect, useState } from "react";
import { Users, GraduationCap, Layers, CalendarCheck, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import GreetingHeader from "@/components/student/greeting-header";
import OverviewCard from "@/components/admin/overview-card";
import DeptAttendanceChart from "@/components/admin/dept-attendance-chart";
import AtRiskTable from "@/components/admin/at-risk-table";
import AnnouncementFeed from "@/components/admin/announcement-feed";
import { getAnalyticsOverview, type AnalyticsOverview } from "@/lib/api/analytics";
import { toast } from "sonner";

const SCOPE_COPY: Record<AnalyticsOverview["scope"], { title: string; chart: string; atRisk: string }> = {
  institution: {
    title: "Institution Overview",
    chart: "Attendance by Batch",
    atRisk: "At-Risk Students (Institution-wide)",
  },
  department: {
    title: "Department Overview",
    chart: "Attendance by Batch (Your Department)",
    atRisk: "At-Risk Students (Your Department)",
  },
  class: {
    title: "Your Class",
    chart: "Attendance Trend",
    atRisk: "At-Risk Students in Your Class",
  },
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdvisor, setIsAdvisor] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getAnalyticsOverview();
        if (cancelled) return;
        setOverview(data);
        setIsAdvisor(data !== null);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load analytics overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const copy = SCOPE_COPY[overview?.scope ?? "institution"];

  return (
    <div className="container mx-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6">
      <GreetingHeader userName={user?.first_name || user?.name || "Admin"} />

      {!loading && !isAdvisor ? (
        <div className="flex h-40 items-center justify-center rounded-xl border text-center text-sm text-muted-foreground px-6">
          You aren&apos;t assigned as a staff advisor for any batch, so there&apos;s no class analytics to show here yet.
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <OverviewCard label="Students" value={overview?.totalStudents ?? 0} icon={Users} loading={loading} />
            <OverviewCard label="Teachers" value={overview?.totalTeachers ?? 0} icon={GraduationCap} loading={loading} />
            <OverviewCard label="Batches" value={overview?.totalBatches ?? 0} icon={Layers} loading={loading} />
            <OverviewCard label="Sessions Today" value={overview?.sessionsToday ?? 0} icon={CalendarCheck} loading={loading} />
            <OverviewCard
              label="Avg. Attendance (30d)"
              value={`${overview?.avgAttendance ?? 0}%`}
              icon={TrendingUp}
              loading={loading}
              tone={overview && overview.avgAttendance < 75 ? "warning" : "default"}
            />
            <OverviewCard
              label="At-Risk Students"
              value={overview?.atRiskCount ?? 0}
              icon={AlertTriangle}
              loading={loading}
              tone={overview && overview.atRiskCount > 0 ? "danger" : "default"}
            />
          </div>

          {/* Charts + Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DeptAttendanceChart data={overview?.attendanceChart ?? []} loading={loading} title={copy.chart} />
            <AtRiskTable rows={overview?.atRiskTable ?? []} loading={loading} title={copy.atRisk} />
          </div>

          {overview?.scope !== "class" && (
            <AnnouncementFeed announcements={overview?.recentAnnouncements ?? []} loading={loading} />
          )}
        </>
      )}
    </div>
  );
}
