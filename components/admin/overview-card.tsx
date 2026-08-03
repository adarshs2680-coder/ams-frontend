import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface OverviewCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  loading?: boolean;
  tone?: "default" | "warning" | "danger";
}

const toneClasses: Record<NonNullable<OverviewCardProps["tone"]>, string> = {
  default: "text-primary bg-primary/10",
  warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  danger: "text-destructive bg-destructive/10",
};

export default function OverviewCard({ label, value, icon: Icon, loading, tone = "default" }: OverviewCardProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
