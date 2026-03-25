"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bike, ChevronRight, Inbox, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AdminApiError,
  fetchAdminNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotificationRow,
} from "@/lib/admin-api";
import { useAdminRealtime } from "@/contexts/admin-realtime-context";
import { cn } from "@/lib/utils";

function notificationHref(n: AdminNotificationRow): string {
  const t = n.data?.type;
  if (t === "partner_application") return "/dashboard/partner-applications";
  if (t === "rider_application") return "/dashboard/rider-applications";
  return "/dashboard";
}

function notificationTitle(n: AdminNotificationRow): string {
  const t = n.data?.type;
  if (t === "partner_application") {
    const name = n.data?.business_name?.trim();
    return name ? `New partner: ${name}` : "New partner application";
  }
  if (t === "rider_application") {
    const name = n.data?.name?.trim();
    return name ? `New rider: ${name}` : "New rider application";
  }
  return "Notification";
}

function notificationSubtitle(n: AdminNotificationRow): string | null {
  const email = n.data?.email?.trim();
  return email || null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffSec = Math.round((now - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (diffSec < 45) return rtf.format(-Math.max(0, diffSec), "second");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function NotificationGlyph({ n }: { n: AdminNotificationRow }) {
  const t = n.data?.type;
  const isRider = t === "rider_application";
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
        !n.read_at
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/60 bg-muted/60 text-muted-foreground"
      )}
    >
      {isRider ? <Bike className="size-[1.125rem]" strokeWidth={2} /> : <Store className="size-[1.125rem]" strokeWidth={2} />}
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-[85%] animate-pulse rounded-md bg-muted" />
            <div className="h-2.5 w-[45%] animate-pulse rounded-md bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminNotificationBell() {
  const router = useRouter();
  const { unreadNotificationCount, refresh } = useAdminRealtime();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminNotifications({ per_page: 15, page: 1 });
      setItems(res.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  async function onSelect(n: AdminNotificationRow) {
    const href = notificationHref(n);
    try {
      if (!n.read_at) {
        await markNotificationRead(n.id);
        await refresh();
      }
    } catch {
      // still navigate
    }
    setOpen(false);
    router.push(href);
  }

  async function onMarkAllRead(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markAllNotificationsRead();
      await refresh();
      await loadList();
    } catch {
      // ignore
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "relative shrink-0 rounded-xl transition-colors",
              unreadNotificationCount > 0 &&
                "bg-brand-yellow/15 text-brand-yellow-foreground hover:bg-brand-yellow/25"
            )}
            aria-label={
              unreadNotificationCount > 0
                ? `Notifications, ${unreadNotificationCount} unread`
                : "Notifications"
            }
          />
        }
      >
        <Bell
          className={cn(
            "size-5",
            unreadNotificationCount > 0 ? "text-brand-yellow-foreground" : "text-muted-foreground"
          )}
          strokeWidth={2}
        />
        {unreadNotificationCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-yellow px-1 text-[10px] font-bold leading-none text-brand-yellow-foreground shadow-sm ring-2 ring-card">
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-2xl border border-border/70 bg-popover p-0 shadow-xl shadow-black/[0.08] ring-1 ring-black/[0.04] dark:ring-white/10"
      >
        {/* Header */}
        <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent px-4 pb-3 pt-4">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-yellow/15 blur-2xl" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-card shadow-sm">
                <Bell className="size-5 text-primary" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold leading-tight tracking-tight text-foreground">
                  Notifications
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {unreadNotificationCount > 0
                    ? `${unreadNotificationCount} unread`
                    : "You’re all caught up"}
                </p>
              </div>
            </div>
            {unreadNotificationCount > 0 ? (
              <button
                type="button"
                onClick={(e) => void onMarkAllRead(e)}
                className="shrink-0 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm transition hover:bg-muted/80"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[min(70vh,340px)] overflow-y-auto overflow-x-hidden overscroll-contain">
          {loading ? (
            <NotificationSkeleton />
          ) : error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => void loadList()}
                className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/40">
                <Inbox className="size-7 text-muted-foreground/70" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-foreground">No notifications yet</p>
              <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
                New partner and rider applications will show up here for your team.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-yellow/15 px-3 py-1 text-[11px] font-medium text-brand-yellow-foreground">
                <Sparkles className="size-3.5" />
                We’ll notify you when something arrives
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/50 p-1.5">
              {items.map((n) => {
                const unread = !n.read_at;
                const subtitle = notificationSubtitle(n);
                return (
                  <li key={n.id}>
                    <DropdownMenuItem
                      className={cn(
                        "w-full cursor-pointer flex-col items-stretch rounded-xl px-2 py-0 data-highlighted:bg-transparent",
                        unread && "bg-primary/[0.04]"
                      )}
                      onClick={() => void onSelect(n)}
                    >
                      <div className="flex w-full gap-3 rounded-lg px-1.5 py-2.5 transition-colors hover:bg-muted/60">
                        <div className="relative shrink-0">
                          <NotificationGlyph n={n} />
                          {unread ? (
                            <span
                              className="absolute -left-0.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-popover"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-[13px] leading-snug",
                                unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                              )}
                            >
                              {notificationTitle(n)}
                            </p>
                            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>
                          {subtitle ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                          ) : null}
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary/90">
                            View queue
                            <ChevronRight className="size-3 opacity-70" />
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator className="my-0 bg-border/60" />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-border/60 border-t border-border/60 bg-muted/20 p-0">
          <DropdownMenuItem
            className="cursor-pointer justify-center gap-2 rounded-none py-3 text-xs font-semibold text-foreground data-highlighted:bg-muted/50"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/partner-applications");
            }}
          >
            <Store className="size-3.5 text-primary" />
            Partner queue
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer justify-center gap-2 rounded-none py-3 text-xs font-semibold text-foreground data-highlighted:bg-muted/50"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/rider-applications");
            }}
          >
            <Bike className="size-3.5 text-primary" />
            Rider queue
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
