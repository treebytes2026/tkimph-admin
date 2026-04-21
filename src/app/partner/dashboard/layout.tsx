"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getStoredUser, logout } from "@/lib/auth";
import {
  fetchPartnerOverviewCached,
  fetchPartnerNotifications,
  fetchPartnerUnreadNotificationsCount,
  markAllPartnerNotificationsRead,
  markPartnerNotificationRead,
  partnerPublicFileUrl,
  type PartnerNotificationRow,
} from "@/lib/partner-api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import {
  LayoutDashboard,
  Bell,
  CheckCheck,
  Clock3,
  LogOut,
  Loader2,
  Menu,
  ChevronRight,
  Package2,
  UtensilsCrossed,
  Clock,
  ShoppingBag,
  Store,
  Wallet,
  BadgePercent,
  type LucideIcon,
} from "lucide-react";

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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function partnerNotificationTitle(notification: PartnerNotificationRow): string {
  const category = String(notification.data?.category ?? notification.data?.kind ?? "").trim();
  if (category === "settlement_overdue") return "Legacy settlement reminder";
  if (category === "payment_proof_reviewed") return "Legacy payment-proof review";
  if (category === "commission_collection_created") return "Commission due";
  if (category === "commission_collection_received") return "Commission received";
  if (category === "commission_collection_reopened") return "Commission reopened";
  if (category === "order_update") return "Order update";
  if (notification.data?.order_number) return `Order ${notification.data.order_number}`;
  return "Partner notification";
}

function partnerNotificationAccent(notification: PartnerNotificationRow): string {
  const category = String(notification.data?.category ?? notification.data?.kind ?? "").trim();
  if (category === "settlement_overdue") return "border-amber-200 bg-amber-50 text-amber-700";
  if (category.startsWith("commission_collection_")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (!notification.read_at) return "border-primary/20 bg-primary/[0.06] text-primary";
  return "border-border/70 bg-card text-muted-foreground";
}

const navigation: Array<{
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}> = [
  { name: "Overview", href: "/partner/dashboard", icon: LayoutDashboard },
  { name: "Orders", href: "/partner/dashboard/orders", icon: ShoppingBag },
  { name: "Menu", href: "/partner/dashboard/menu", icon: UtensilsCrossed },
  { name: "Store profile", href: "/partner/dashboard/profile", icon: Store },
  { name: "Opening hours", href: "/partner/dashboard/hours", icon: Clock },
  { name: "Promotions", href: "/partner/dashboard/promotions", icon: BadgePercent },
  { name: "Earnings", href: "/partner/dashboard/earnings", icon: Wallet },
];

function SidebarContent({
  pathname,
  unreadOrdersCount,
}: {
  pathname: string;
  unreadOrdersCount: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="relative">
          <Image
            src="/tkimlogo.png"
            alt="TKimph"
            width={44}
            height={44}
            className="rounded-xl shadow-sm ring-2 ring-white/10"
          />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-brand-yellow ring-2 ring-sidebar" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">Partner</h1>
          <p className="text-xs font-medium text-sidebar-foreground/55">Restaurant portal</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border/80" />

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/partner/dashboard" && pathname.startsWith(item.href));
          const content = (
            <span
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                item.disabled
                  ? "cursor-not-allowed text-sidebar-foreground/35"
                  : isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-black/10"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="size-[1.15rem] shrink-0 opacity-90" strokeWidth={2} />
              {item.name}
              {item.href === "/partner/dashboard/orders" && unreadOrdersCount > 0 && (
                <span className="h-5 min-w-5 rounded-full bg-brand-yellow px-1 text-center text-[10px] font-bold leading-5 text-brand-yellow-foreground shadow-sm">
                  {unreadOrdersCount > 99 ? "99+" : unreadOrdersCount}
                </span>
              )}
              {isActive && !item.disabled && <ChevronRight className="ml-auto size-4 opacity-80" />}
              {item.disabled && (
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide opacity-70">Soon</span>
              )}
            </span>
          );
          return item.disabled ? (
            <div key={item.name}>{content}</div>
          ) : (
            <Link key={item.name} href={item.href}>
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <Link
          href="/"
          className="block rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3 text-center text-xs font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent/60"
        >
          Back to TKimph site
        </Link>
      </div>
    </div>
  );
}

export default function PartnerDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [headerProfilePhotoSrc, setHeaderProfilePhotoSrc] = useState<string | null>(null);
  const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PartnerNotificationRow[]>([]);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const user = getStoredUser();

  useEffect(() => {
    queueMicrotask(() => {
      const u = getStoredUser();
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token || !u) {
        router.replace("/login");
        return;
      }
      if (u.role !== "restaurant_owner") {
        router.replace("/");
        return;
      }
      setReady(true);
    });
  }, [router]);

  const refreshHeaderProfilePhoto = useCallback(() => {
    fetchPartnerOverviewCached()
      .then((o) => {
        const r = o.restaurants[0];
        setHeaderProfilePhotoSrc(
          r ? partnerPublicFileUrl(r.profile_image_path, r.profile_image_url) : null
        );
      })
      .catch(() => setHeaderProfilePhotoSrc(null));
  }, []);

  useEffect(() => {
    if (!ready) return;
    refreshHeaderProfilePhoto();
  }, [ready, pathname, refreshHeaderProfilePhoto]);

  useEffect(() => {
    if (!ready) return;
    const evt = "tkimph:partner-profile-photo-updated";
    const onUpdate = () => refreshHeaderProfilePhoto();
    window.addEventListener(evt, onUpdate);
    return () => window.removeEventListener(evt, onUpdate);
  }, [ready, refreshHeaderProfilePhoto]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = await fetchPartnerUnreadNotificationsCount();
        if (!cancelled) setUnreadOrdersCount(res.count);
      } catch {
        if (!cancelled) setUnreadOrdersCount(0);
      }
    };
    fetchUnread();
    const timer = window.setInterval(fetchUnread, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready, pathname]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const res = await fetchPartnerNotifications({ per_page: 12, page: 1 });
      setNotifications(res.data);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Could not load notifications.");
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;
    void loadNotifications();
  }, [notificationOpen, loadNotifications]);

  async function onOpenOrderNotification(notification: PartnerNotificationRow) {
    const category = String(notification.data?.category ?? "").trim();
    const targetHref = category.startsWith("settlement_")
      ? "/partner/dashboard"
      : category.startsWith("commission_collection_")
        ? "/partner/dashboard/earnings"
      : "/partner/dashboard/orders";
    try {
      if (!notification.read_at) {
        await markPartnerNotificationRead(notification.id);
      }
    } catch {
      // ignore mark-read failure and still navigate
    } finally {
      setNotificationOpen(false);
      router.push(targetHref);
    }
  }

  async function onMarkAllNotificationsRead() {
    try {
      await markAllPartnerNotificationsRead();
      const unread = await fetchPartnerUnreadNotificationsCount();
      setUnreadOrdersCount(unread.count);
      await loadNotifications();
    } catch {
      // ignore
    }
  }

  async function confirmLogout() {
    setLogoutPending(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      router.push("/");
    } finally {
      setLogoutPending(false);
    }
  }

  if (!ready || !user || user.role !== "restaurant_owner") {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="size-9 animate-pulse rounded-full bg-primary/25" />
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-2 w-20 animate-pulse rounded-md bg-muted/70" />
          </div>
        </div>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentPage = navigation.find(
    (item) =>
      pathname === item.href || (item.href !== "/partner/dashboard" && pathname.startsWith(item.href))
  );

  return (
    <>
    <div className="flex h-screen min-h-0 overflow-hidden bg-muted/25">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-sidebar-border/80 bg-sidebar shadow-[4px_0_24px_-12px_rgba(0,0,0,0.15)] lg:flex lg:flex-col">
        <SidebarContent pathname={pathname} unreadOrdersCount={unreadOrdersCount} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <SidebarContent pathname={pathname} unreadOrdersCount={unreadOrdersCount} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-card/90 px-4 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-card/75 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Restaurant partner
              </p>
              <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
                {currentPage?.name ?? "Overview"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="relative rounded-xl"
                    aria-label={unreadOrdersCount > 0 ? `Notifications, ${unreadOrdersCount} unread` : "Notifications"}
                  />
                }
              >
                <Bell className="size-5 text-muted-foreground" />
                {unreadOrdersCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-yellow px-1 text-[10px] font-bold leading-none text-brand-yellow-foreground ring-2 ring-card">
                    {unreadOrdersCount > 99 ? "99+" : unreadOrdersCount}
                  </span>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(100vw-1.5rem,26rem)] overflow-hidden rounded-3xl border border-border/70 p-0 shadow-2xl">
                <div className="border-b border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Notifications</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {unreadOrdersCount > 0 ? `${unreadOrdersCount} unread updates waiting` : "All caught up"}
                      </p>
                    </div>
                    {unreadOrdersCount > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full border-0 bg-white/12 text-white hover:bg-white/18"
                        onClick={() => void onMarkAllNotificationsRead()}
                      >
                        <CheckCheck className="size-4" />
                        Mark all read
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                        <Bell className="size-3.5" />
                        Quiet now
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto bg-background p-2">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      Loading...
                    </div>
                  ) : notificationsError ? (
                    <p className="px-3 py-6 text-center text-sm text-destructive">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {notifications.map((notification) => {
                        const unread = !notification.read_at;
                        return (
                          <li key={notification.id}>
                            <button
                              type="button"
                              onClick={() => void onOpenOrderNotification(notification)}
                              className={`w-full rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${partnerNotificationAccent(notification)}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex size-8 items-center justify-center rounded-2xl ${unread ? "bg-white text-primary shadow-sm" : "bg-muted text-foreground/70"}`}>
                                      {String(notification.data?.category ?? "").trim() === "settlement_overdue" ? (
                                        <Clock3 className="size-4" />
                                      ) : (
                                        <Package2 className="size-4" />
                                      )}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">
                                        {partnerNotificationTitle(notification)}
                                      </p>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                        {notification.data?.message || "New notification"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                    {notification.data?.order_number ? (
                                      <span className="rounded-full border border-border/70 bg-background px-2 py-1 font-semibold text-foreground">
                                        {notification.data.order_number}
                                      </span>
                                    ) : null}
                                    <span className="text-muted-foreground">
                                      {formatRelativeTime(notification.created_at)}
                                    </span>
                                  </div>
                                </div>
                                {unread ? (
                                  <span className="mt-1 size-2.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(22,163,74,0.12)]" />
                                ) : null}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-auto gap-2 rounded-xl py-2 pl-2 pr-3 hover:bg-muted/80"
                  />
                }
              >
                <Avatar key={headerProfilePhotoSrc ?? "fallback"} className="size-9 ring-2 ring-border/60">
                  {headerProfilePhotoSrc ? (
                    <AvatarImage src={headerProfilePhotoSrc} alt="" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="max-w-[10rem] truncate text-sm font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">Partner account</p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <div className="px-2 py-2">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLogoutDialogOpen(true)}
                  className="gap-2 rounded-lg text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
    <LogoutConfirmDialog
      open={logoutDialogOpen}
      onOpenChange={setLogoutDialogOpen}
      onConfirm={confirmLogout}
      pending={logoutPending}
    />
    </>
  );
}
