"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getStoredUser,
  getStoredToken,
  logout,
  type AuthUser,
} from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { AdminRealtimeProvider, useAdminRealtime } from "@/contexts/admin-realtime-context";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Store,
  Bike,
  ShoppingBag,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  ClipboardList,
  Tags,
  UserCircle,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Restaurants", href: "/dashboard/restaurants", icon: Store },
  { name: "Partner applications", href: "/dashboard/partner-applications", icon: ClipboardList },
  { name: "Rider applications", href: "/dashboard/rider-applications", icon: Bike },
  { name: "Business setup", href: "/dashboard/business-setup", icon: Tags },
  { name: "Riders", href: "/dashboard/riders", icon: UserCircle },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function SidebarContent({
  pathname,
  pendingPartner,
  pendingRider,
}: {
  pathname: string;
  pendingPartner: number;
  pendingRider: number;
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
          <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">TKimph</h1>
          <p className="text-xs font-medium text-sidebar-foreground/55">Administrator</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border/80" />

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const pending =
            item.href === "/dashboard/partner-applications"
              ? pendingPartner
              : item.href === "/dashboard/rider-applications"
                ? pendingRider
                : 0;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-black/10"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="size-[1.15rem] shrink-0 opacity-90" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                {pending > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center border-0 bg-brand-yellow px-1 text-[10px] font-bold tabular-nums text-brand-yellow-foreground shadow-sm hover:bg-brand-yellow"
                  >
                    {pending > 99 ? "99+" : pending}
                  </Badge>
                ) : null}
                {isActive ? <ChevronRight className="size-4 opacity-80" /> : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
            Build
          </p>
          <p className="text-xs text-sidebar-foreground/70">Admin v1.0 · Internal use</p>
        </div>
      </div>
    </div>
  );
}

export default function AdministratorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const token = getStoredToken();
      const storedUser = getStoredUser();
      setUser(storedUser);
      setAuthReady(true);
      if (!token || !storedUser) {
        router.push(ADMIN_LOGIN_PATH);
      }
    });
  }, [router]);

  if (!authReady || !user) {
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

  return (
    <AdminRealtimeProvider>
      <DashboardChrome user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
        {children}
      </DashboardChrome>
    </AdminRealtimeProvider>
  );
}

function DashboardChrome({
  user,
  sidebarOpen,
  setSidebarOpen,
  children,
}: {
  user: AuthUser;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { registrationStats } = useAdminRealtime();
  const pendingPartner = registrationStats?.pending_partner_applications ?? 0;
  const pendingRider = registrationStats?.pending_rider_applications ?? 0;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentPage = navigation.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href))
  );

  const router = useRouter();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  async function confirmLogout() {
    setLogoutPending(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      router.push(ADMIN_LOGIN_PATH);
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <>
    <div className="flex h-screen min-h-0 overflow-hidden bg-muted/25">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-sidebar-border/80 bg-sidebar shadow-[4px_0_24px_-12px_rgba(0,0,0,0.15)] lg:flex lg:flex-col">
        <SidebarContent
          pathname={pathname}
          pendingPartner={pendingPartner}
          pendingRider={pendingRider}
        />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <SidebarContent
            pathname={pathname}
            pendingPartner={pendingPartner}
            pendingRider={pendingRider}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-card/90 px-4 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-card/75 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="shrink-0 lg:hidden" />}
              >
                <Menu className="size-5" />
              </SheetTrigger>
            </Sheet>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administrator
              </p>
              <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
                {currentPage?.name ?? "Dashboard"}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <AdminNotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="h-auto gap-2 rounded-xl py-2 pl-2 pr-3 hover:bg-muted/80"
                  />
                }
              >
                <Avatar className="size-9 ring-2 ring-border/60">
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="max-w-[10rem] truncate text-sm font-semibold">{user.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {user.role.replace("_", " ")}
                  </p>
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
