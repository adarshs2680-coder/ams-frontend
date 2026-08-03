"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RecentAnnouncement } from "@/lib/api/analytics";

const VISIBLE_COUNT = 3;

function AnnouncementList({ announcements }: { announcements: RecentAnnouncement[] }) {
  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <div key={a._id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{a.title || "Untitled"}</p>
            {a.priorityLevel && (
              <Badge variant={a.priorityLevel === "High" ? "destructive" : "secondary"}>
                {a.priorityLevel}
              </Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.message}</p>
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementFeed({
  announcements,
  loading,
}: {
  announcements: RecentAnnouncement[];
  loading?: boolean;
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const visibleAnnouncements = announcements.slice(0, VISIBLE_COUNT);
  const hasMore = announcements.length > VISIBLE_COUNT;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Announcements</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/notifications")}>
            New Announcement
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : announcements.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
            No announcements yet.
          </div>
        ) : (
          <>
            <AnnouncementList announcements={visibleAnnouncements} />
            {hasMore && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(true)}>
                Show more ({announcements.length - VISIBLE_COUNT} more)
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recent Announcements</DialogTitle>
          </DialogHeader>
          <AnnouncementList announcements={announcements} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
