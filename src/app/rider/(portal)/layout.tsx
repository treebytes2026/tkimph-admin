"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser, logout, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { Bike, LayoutDashboard, LogOut, Menu, UserRound } from "lucide-react";

const navItems = [
  { href: "/rider/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rider/profile", label: "Profile", icon: UserRound },
];

export default function RiderPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (u.role !== "rider") {
      router.replace("/");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  async function onConfirmLogout() {
    setLogoutPending(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLogoutPending(false);
    }
  }

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        Loading rider portal...
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen bg-muted/20">
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-border/70 bg-card p-4 transition-transform lg:static lg:translate-x-0 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-5 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bike className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Rider Portal</p>
              <p className="text-xs text-muted-foreground">TKimph</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{user.name}</p>
            <Badge variant="outline" className="mt-2 capitalize">
              {user.role.replace("_", " ")}
            </Badge>
          </div>
        </aside>

        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/35 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/70 bg-card/95 px-4 backdrop-blur lg:px-6">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)}>
                <Menu className="size-5" />
              </Button>
              <p className="text-sm font-semibold text-foreground">
                {pathname === "/rider/profile" ? "Rider profile" : "Rider dashboard"}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setLogoutDialogOpen(true)}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>

      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={onConfirmLogout}
        pending={logoutPending}
      />
    </>
  );
}
