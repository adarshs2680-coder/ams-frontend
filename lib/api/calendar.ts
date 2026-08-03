/**
 * Activity Calendar API Service
 * Role-scoped day markers + day detail, derived from AttendanceSession.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type ApiResponse<T> = {
  status_code: number;
  message: string;
  data: T;
};

export interface CalendarDayMarker {
  date: string; // YYYY-MM-DD
  count: number;
  status?: "present" | "partial" | "absent";
}

export interface CalendarMonthResponse {
  role: string;
  days: CalendarDayMarker[];
}

interface CalendarSessionBase {
  sessionId: string;
  subject: string;
  start_time: string;
  end_time: string;
}

export interface StudentCalendarSession extends CalendarSessionBase {
  // Batch is always the student's own batch, so the teacher is shown instead.
  teacher: string;
  status: "present" | "absent" | "late" | "excused";
}

export interface StaffCalendarSession extends CalendarSessionBase {
  batch: string;
  teacher?: string;
  studentsPresent: number;
  totalStudents: number;
}

export type CalendarSession = StudentCalendarSession | StaffCalendarSession;

export interface CalendarDayResponse {
  role: string;
  date: string;
  sessions: CalendarSession[];
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

export async function getCalendarMonth(params: {
  month: number;
  year: number;
  batch?: string;
  subject?: string;
}): Promise<CalendarMonthResponse> {
  const query = new URLSearchParams({ month: String(params.month), year: String(params.year) });
  if (params.batch) query.append("batch", params.batch);
  if (params.subject) query.append("subject", params.subject);

  const response = await fetch(`${API_BASE}/attendance/calendar?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch calendar"));
  }

  const result = (await parseJsonSafe(response)) as ApiResponse<CalendarMonthResponse> | null;
  return result?.data ?? { role: "unknown", days: [] };
}

export async function getCalendarDay(
  date: string,
  params?: { batch?: string; subject?: string }
): Promise<CalendarDayResponse> {
  const query = new URLSearchParams({ date });
  if (params?.batch) query.append("batch", params.batch);
  if (params?.subject) query.append("subject", params.subject);

  const response = await fetch(`${API_BASE}/attendance/calendar/day?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch calendar day"));
  }

  const result = (await parseJsonSafe(response)) as ApiResponse<CalendarDayResponse> | null;
  return result?.data ?? { role: "unknown", date, sessions: [] };
}
