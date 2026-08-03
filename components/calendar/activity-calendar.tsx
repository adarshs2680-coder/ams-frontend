"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarDayMarker } from "@/lib/api/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<NonNullable<CalendarDayMarker["status"]>, string> = {
  present: "Present",
  partial: "Partial",
  absent: "Absent",
};

const STATUS_STYLE: Record<NonNullable<CalendarDayMarker["status"]>, string> = {
  present: "bg-emerald-500/90 text-white",
  partial: "bg-amber-500/90 text-white",
  absent: "bg-destructive/90 text-white",
};

interface ActivityCalendarProps {
  markers: CalendarDayMarker[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onDaySelect: (date: Date) => void;
  selectedDate?: Date | null;
  role?: string;
  className?: string;
}

export default function ActivityCalendar({
  markers,
  month,
  onMonthChange,
  onDaySelect,
  selectedDate,
  role,
  className,
}: ActivityCalendarProps) {
  const markerMap = useMemo(() => new Map(markers.map((m) => [m.date, m])), [markers]);
  const showStatus = role === "student" || role === "parent";

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

  return (
    <div
      className={cn(
        "flex h-full w-full select-none flex-col rounded-xl border-2 shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-2">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{format(month, "MMMM yyyy")}</h2>
        <div className="w-[104px]" aria-hidden />
      </div>

      {/* Weekday row */}
      <div className="grid shrink-0 grid-cols-7 border-b-2 bg-muted/50 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn("py-1.5", i === 0 && "bg-black/5 text-primary/70 dark:bg-white/6")}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks — fill remaining height, rows split evenly regardless of 5 vs 6 weeks */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, month);
              const key = format(day, "yyyy-MM-dd");
              const marker = inMonth ? markerMap.get(key) : undefined;
              const clickable = Boolean(marker && marker.count > 0);
              const today = isToday(day);
              const isSunday = di === 0;

              // Single background decision (not several possibly-conflicting
              // bg-* classes) so the whole Sunday column shades consistently,
              // including the leading/trailing days from adjacent months.
              const bgClass = !inMonth
                ? isSunday
                  ? "bg-black/[0.08] dark:bg-white/[0.1]"
                  : "bg-muted/20"
                : isSunday
                  ? "bg-black/[0.05] dark:bg-white/[0.06]"
                  : undefined;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onDaySelect(day)}
                  className={cn(
                    "flex min-h-0 flex-col items-stretch gap-0.5 overflow-hidden border-b-2 border-r-2 p-1 text-left last:border-r-0",
                    bgClass,
                    !inMonth && "text-muted-foreground",
                    today && "bg-primary/5",
                    clickable ? "cursor-pointer hover:bg-accent/50" : "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                      today && "bg-primary font-semibold text-primary-foreground shadow-sm",
                      selectedDate &&
                        isSameDay(day, selectedDate) &&
                        !today &&
                        "ring-2 ring-primary"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {marker && (
                    <span
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm",
                      showStatus
                          ? STATUS_STYLE[marker.status ?? "absent"]
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {showStatus
                        ? `${STATUS_LABEL[marker.status ?? "absent"]} (${marker.count})`
                        : `${marker.count} class${marker.count === 1 ? "" : "es"}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
