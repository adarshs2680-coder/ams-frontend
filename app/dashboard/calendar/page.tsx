"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import ActivityCalendar from "@/components/calendar/activity-calendar";
import DayDetailDialog from "@/components/calendar/day-detail-dialog";
import {
  getCalendarMonth,
  getCalendarDay,
  type CalendarDayMarker,
  type CalendarDayResponse,
} from "@/lib/api/calendar";

const ROLE_DESCRIPTION: Record<string, string> = {
  student: "Your attendance at a glance.",
  teacher: "Classes you've taught.",
  hod: "Classes taken in your department.",
  principal: "Classes taken institution-wide.",
  admin: "Classes taken institution-wide.",
  parent: "Your child's attendance at a glance.",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [markers, setMarkers] = useState<CalendarDayMarker[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayResponse | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await getCalendarMonth({ month: month.getMonth() + 1, year: month.getFullYear() });
        if (!cancelled) setMarkers(res.days);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [month]);

  const handleDaySelect = useCallback(async (date: Date) => {
    setSelectedDate(date);
    setDayDetail(null);
    setDayLoading(true);
    try {
      const res = await getCalendarDay(format(date, "yyyy-MM-dd"));
      setDayDetail(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load day detail");
    } finally {
      setDayLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4 md:p-6 pb-20 md:pb-6">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_DESCRIPTION[user?.role ?? ""] ?? "Your activity at a glance."}
        </p>
      </div>

      {loading ? (
        <Skeleton className="min-h-0 flex-1 w-full" />
      ) : (
        <ActivityCalendar
          markers={markers}
          month={month}
          onMonthChange={setMonth}
          onDaySelect={handleDaySelect}
          selectedDate={selectedDate}
          role={user?.role}
          className="min-h-0 flex-1"
        />
      )}

      <DayDetailDialog
        open={selectedDate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setDayDetail(null);
          }
        }}
        date={selectedDate}
        loading={dayLoading}
        detail={dayDetail}
      />
    </div>
  );
}
