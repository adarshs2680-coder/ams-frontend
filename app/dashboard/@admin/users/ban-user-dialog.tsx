"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Ban } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const EXPIRY_OPTIONS = [
  { value: "none", label: "No expiry (until manually unbanned)" },
  { value: String(60 * 60 * 24), label: "1 day" },
  { value: String(60 * 60 * 24 * 7), label: "7 days" },
  { value: String(60 * 60 * 24 * 30), label: "30 days" },
] as const;

const banUserSchema = z.object({
  banReason: z.string().max(500).optional(),
  banExpiresIn: z.string(),
});

type BanUserValues = z.infer<typeof banUserSchema>;

interface BanUserDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Admin-only: bans a user from signing in (Better-Auth admin plugin —
 * authClient.admin.banUser). Session-create is blocked for banned users;
 * this does NOT revoke their existing active session on its own, so pair
 * with "Revoke Sessions" if they need to be kicked out immediately.
 */
export function BanUserDialog({ userId, userName, open, onOpenChange, onSuccess }: BanUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<BanUserValues>({
    resolver: zodResolver(banUserSchema),
    defaultValues: { banReason: "", banExpiresIn: "none" },
  });

  const onSubmit = async (values: BanUserValues) => {
    try {
      setIsLoading(true);
      await authClient.admin.banUser({
        userId,
        banReason: values.banReason || undefined,
        banExpiresIn: values.banExpiresIn === "none" ? undefined : Number(values.banExpiresIn),
      });
      toast.success(`${userName} has been banned.`);
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban User</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{userName}</span> will be blocked from signing in.
            Their current session stays active until it expires — use{" "}
            <span className="font-medium">Revoke Sessions</span> too if they need to be signed out
            immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="banReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Why is this user being banned?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="banExpiresIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>When the ban automatically lifts.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Ban className="mr-2 h-4 w-4" />
                Ban User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
