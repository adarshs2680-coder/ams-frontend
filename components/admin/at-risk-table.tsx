"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AtRiskStudentRow } from "@/lib/api/analytics";

const VISIBLE_COUNT = 5;

function AtRiskRows({ rows }: { rows: AtRiskStudentRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead className="text-right">Attendance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell>
              <Link href={`/dashboard/users?highlight=${row.studentId}`} className="hover:underline">
                {row.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.batch}</TableCell>
            <TableCell className="text-right">
              <Badge variant="destructive">{row.attendancePercentage}%</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AtRiskTable({
  rows,
  loading,
  title = "At-Risk Students",
}: {
  rows: AtRiskStudentRow[];
  loading?: boolean;
  title?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = rows.slice(0, VISIBLE_COUNT);
  const hasMore = rows.length > VISIBLE_COUNT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No at-risk students in this scope right now.
          </div>
        ) : (
          <>
            <AtRiskRows rows={visibleRows} />
            {hasMore && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
                Show more ({rows.length - VISIBLE_COUNT} more)
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <AtRiskRows rows={rows} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
