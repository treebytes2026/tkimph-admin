"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { getStoredUser, logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronRight,
  UtensilsCrossed,
  Clock,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/partner/dashboard", icon: LayoutDashboard },
  { name: "Menu", href: "/partner/dashboard/menu", icon: UtensilsCrossed, disabled: true },
  { name: "Opening hours", href: "/partner/dashboard/hours", icon: Clock, disabled: true },
];

function SidebarContent({ pathname }: { pathname: string }) {
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
  const user = getStoredUser();

  useEffect(() => {
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
  }, [router]);

  async function handleLogout() {
    await logout();
    router.push("/");
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
    <div className="flex min-h-screen bg-muted/25">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border/80 bg-sidebar shadow-[4px_0_24px_-12px_rgba(0,0,0,0.15)] lg:flex lg:flex-col">
        <SidebarContent pathname={pathname} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <SidebarContent pathname={pathname} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-card/90 px-4 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-card/75 lg:px-8">
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
                onClick={handleLogout}
                className="gap-2 rounded-lg text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
