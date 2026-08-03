"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { User } from "@/lib/types/UserTypes";

interface StaffAdvisorComboboxProps {
  teachers: User[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

const teacherLabel = (t: User) => (t.first_name || t.last_name ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : t.name);

export function StaffAdvisorCombobox({ teachers, value, onChange, loading, disabled }: StaffAdvisorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = teachers.find((t) => t._id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const label = teacherLabel(t).toLowerCase();
      return label.includes(q) || t.email?.toLowerCase().includes(q);
    });
  }, [teachers, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading ? "Loading teachers..." : selected ? teacherLabel(selected) : "Select staff advisor"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teachers..."
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No teacher found.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => {
                  onChange(t._id!);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  t._id === value && "bg-accent/50"
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0", t._id === value ? "opacity-100" : "opacity-0")} />
                <span className="flex flex-col">
                  <span>{teacherLabel(t)}</span>
                  {t.email && <span className="text-xs text-muted-foreground">{t.email}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
