/**
 * Analytics API Service
 * Institutional overview data — scoped server-side by role (staff advisor's
 * class / HOD's department / principal & admin's whole institution).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiResponse<T> = {
  status_code: number;
  message: string;
  data: T;
};

export type OverviewScope = "class" | "department" | "institution";

export interface AttendanceChartPoint {
  batchId: string;
  name: string;
  department: string;
  avgAttendance: number;
}

export interface AtRiskStudentRow {
  studentId: string;
  name: string;
  batch: string;
  attendancePercentage: number;
}

export interface RecentAnnouncement {
  _id: string;
  title?: string;
  message?: string;
  priorityLevel?: string;
  targetGroup?: string;
  createdBy?: string;
}

export interface AnalyticsOverview {
  scope: OverviewScope;
  totalStudents: number;
  totalTeachers: number;
  totalBatches: number;
  sessionsToday: number;
  avgAttendance: number;
  atRiskCount: number;
  attendanceChart: AttendanceChartPoint[];
  atRiskTable: AtRiskStudentRow[];
  recentAnnouncements: RecentAnnouncement[];
}

const parseJsonSafe = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const readErrorMessage = async (response: Response, fallback: string) => {
  const payload = await parseJsonSafe(response);
  return payload?.message || payload?.error || fallback;
};

/**
 * Returns `null` when the caller is a teacher who isn't a staff advisor
 * for any batch — render an empty state rather than an error in that case.
 */
export async function getAnalyticsOverview(
  params?: { atRiskThreshold?: number; windowDays?: number }
): Promise<AnalyticsOverview | null> {
  const queryParams = new URLSearchParams();
  if (params?.atRiskThreshold) queryParams.append("atRiskThreshold", params.atRiskThreshold.toString());
  if (params?.windowDays) queryParams.append("windowDays", params.windowDays.toString());

  const url = `${API_BASE}/analytics/overview${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, "Failed to fetch analytics overview");
    throw new Error(message);
  }

  const result = (await parseJsonSafe(response)) as ApiResponse<AnalyticsOverview | null> | null;
  return result?.data ?? null;
}
