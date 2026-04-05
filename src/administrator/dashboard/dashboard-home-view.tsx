"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAdminRealtime } from "@/contexts/admin-realtime-context";
import { fetchAdminOrderSummary, fetchRestaurants, fetchUsers, type AdminOrderSummary } from "@/lib/admin-api";
import {
  Users,
  Store,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  ClipboardList,
  Bell,
  Loader2,
  Wallet,
  HandCoins,
  ReceiptText,
} from "lucide-react";

type DashboardCounts = {
  users: number | null;
  restaurants: number | null;
};

function formatNumber(value: number | null): string {
  if (value == null) return "--";
  return value.toLocaleString("en-PH");
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "--";
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relativeFromTimestamp(ts: number | null): string {
  if (!ts) return "Waiting for live data";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return "Updated just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `Updated ${min}m ago`;
  const hr = Math.round(min / 60);
  return `Updated ${hr}h ago`;
}

const weekBars = [46, 68, 52, 84, 60, 92, 74];

export function DashboardHomeView() {
  const {
    registrationStats: regStats,
    unreadNotificationCount,
    lastUpdatedAt,
    refresh,
  } = useAdminRealtime();

  const [counts, setCounts] = useState<DashboardCounts>({
    users: null,
    restaurants: null,
  });
  const [orderSummary, setOrderSummary] = useState<AdminOrderSummary | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountsLoading(true);
      const [usersRes, restaurantsRes, summaryRes] = await Promise.allSettled([
        fetchUsers({ page: 1 }),
        fetchRestaurants({ page: 1 }),
        fetchAdminOrderSummary(),
      ]);

      if (cancelled) return;

      setCounts({
        users: usersRes.status === "fulfilled" ? usersRes.value.total : null,
        restaurants: restaurantsRes.status === "fulfilled" ? restaurantsRes.value.total : null,
      });
      if (summaryRes.status === "fulfilled") {
        setOrderSummary(summaryRes.value);
      }
      setCountsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingPartner = regStats?.pending_partner_applications ?? 0;
  const pendingRider = regStats?.pending_rider_applications ?? 0;
  const pendingTotal = pendingPartner + pendingRider;

  const kpis = useMemo(
    () => [
      {
        title: "Users",
        value: formatNumber(counts.users),
        hint: countsLoading ? "Loading" : "Registered accounts",
        icon: Users,
        chip: counts.users != null ? `${counts.users >= 1000 ? "+1k" : "Active"}` : "Live",
      },
      {
        title: "Restaurants",
        value: formatNumber(counts.restaurants),
        hint: countsLoading ? "Loading" : "On platform",
        icon: Store,
        chip: "Partners",
      },
      {
        title: "Active orders",
        value: formatNumber(
          orderSummary
            ? orderSummary.pending + orderSummary.accepted + orderSummary.preparing + orderSummary.out_for_delivery
            : null
        ),
        hint: "Pending to out for delivery",
        icon: ClipboardList,
        chip: orderSummary && orderSummary.stalled_orders > 0 ? "Watch list" : "Live",
      },
      {
        title: "Active riders",
        value: formatNumber(orderSummary?.active_riders ?? null),
        hint: "Available for dispatch",
        icon: Bell,
        chip: unreadNotificationCount > 0 ? `${unreadNotificationCount} alerts` : "Calm",
      },
    ],
    [counts.users, counts.restaurants, countsLoading, unreadNotificationCount, orderSummary]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Admin operations
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Monitor platform health, process approval queues, and keep operations moving.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{relativeFromTimestamp(lastUpdatedAt)}</p>
          <Button
            onClick={() => void refresh()}
            variant="outline"
            className="h-10 gap-2 rounded-xl font-semibold"
          >
            <Sparkles className="size-4" />
            Refresh live data
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="group border-border/60 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <kpi.icon className="size-5" strokeWidth={1.8} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="border-0 bg-primary/10 text-primary">
                  {kpi.chip}
                </Badge>
                <span className="text-muted-foreground">{kpi.hint}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orderSummary ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="relative overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,1),rgba(255,247,237,1))] shadow-sm">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Platform income</p>
                <CardTitle className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {formatMoney(orderSummary.platform_income)}
                </CardTitle>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Total commission collected from all non-cancelled orders across the platform.
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-white/85 text-primary shadow-sm">
                <Wallet className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="relative grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Gross sales</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(orderSummary.gross_sales)}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Restaurant net</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(orderSummary.restaurant_net)}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Retention</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {orderSummary.gross_sales > 0
                    ? `${((orderSummary.platform_income / orderSummary.gross_sales) * 100).toFixed(1)}%`
                    : "--"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Revenue split</p>
                <CardTitle className="mt-2 text-lg">Restaurant payout</CardTitle>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <HandCoins className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-foreground">{formatMoney(orderSummary.restaurant_net)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Revenue remaining for restaurants after platform commission.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sales volume</p>
                <CardTitle className="mt-2 text-lg">Gross processed</CardTitle>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
                <ReceiptText className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-foreground">{formatMoney(orderSummary.gross_sales)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Total order value processed across active platform sales.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {pendingTotal > 0 ? (
        <Card className="border-primary/25 bg-primary/[0.04] shadow-sm">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ClipboardList className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Pending registration reviews</p>
                <p className="text-sm text-muted-foreground">
                  {pendingPartner} partner {pendingPartner === 1 ? "application" : "applications"} and {" "}
                  {pendingRider} rider {pendingRider === 1 ? "application" : "applications"} waiting.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/partner-applications"
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-xl")}
              >
                Partner queue
              </Link>
              <Link
                href="/dashboard/rider-applications"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
              >
                Rider queue
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {orderSummary ? (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operations alerts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned active orders</p>
              <p className="mt-1 text-2xl font-bold">{orderSummary.unassigned_active_orders}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stalled orders</p>
              <p className="mt-1 text-2xl font-bold">{orderSummary.stalled_orders}</p>
              <p className="text-xs text-muted-foreground">
                No updates for {orderSummary.sla_stalled_minutes}+ minutes
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unread notifications</p>
              <p className="mt-1 text-2xl font-bold">{unreadNotificationCount}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Activity trend</CardTitle>
              <p className="text-sm text-muted-foreground">Last 7 days snapshot</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Platform momentum</p>
              <p className="text-4xl font-bold tracking-tight tabular-nums">+18%</p>
            </div>
            <div className="flex h-28 items-end justify-between gap-1.5 rounded-xl bg-muted/50 px-3 pb-3 pt-6">
              {weekBars.map((h, i) => (
                <div
                  key={i}
                  className="w-full max-w-[2.5rem] rounded-md bg-gradient-to-t from-primary/80 to-primary/40 transition-all hover:from-primary hover:to-primary/70"
                  style={{ height: `${h}%` }}
                  title={`Day ${i + 1}`}
                />
              ))}
            </div>
            <Separator />
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Queue response target</span>
                <span className="font-semibold">Within 2 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unassigned active orders</span>
                <span className="font-semibold tabular-nums">
                  {orderSummary ? orderSummary.unassigned_active_orders : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stalled orders</span>
                <span className="font-semibold tabular-nums">
                  {orderSummary ? orderSummary.stalled_orders : "--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Operations checklist</CardTitle>
              <p className="text-sm text-muted-foreground">Recommended admin actions right now</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
              <Link href="/dashboard/orders">
                Open orders
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Review partner applications</p>
                <p className="text-xs text-muted-foreground">Approve stores to keep catalog growth steady.</p>
              </div>
              <Badge className="border-0 bg-primary/10 text-primary">{pendingPartner}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Review rider applications</p>
                <p className="text-xs text-muted-foreground">Maintain delivery capacity during peak hours.</p>
              </div>
              <Badge className="border-0 bg-primary/10 text-primary">{pendingRider}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Check unread admin notifications</p>
                <p className="text-xs text-muted-foreground">Resolve critical updates from the bell feed.</p>
              </div>
              <Badge className="border-0 bg-brand-yellow/25 text-brand-yellow-foreground">
                {unreadNotificationCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Handle unassigned or stalled orders</p>
                <p className="text-xs text-muted-foreground">Use Orders module to assign riders and unblock flow.</p>
              </div>
              {countsLoading || !orderSummary ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Badge variant="outline">
                  {orderSummary.unassigned_active_orders + orderSummary.stalled_orders} issues
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/users" className={cn(buttonVariants({ variant: "outline" }), "h-12 justify-between rounded-xl")}>Users <ArrowUpRight className="size-4" /></Link>
        <Link href="/dashboard/restaurants" className={cn(buttonVariants({ variant: "outline" }), "h-12 justify-between rounded-xl")}>Restaurants <ArrowUpRight className="size-4" /></Link>
        <Link href="/dashboard/partner-applications" className={cn(buttonVariants({ variant: "outline" }), "h-12 justify-between rounded-xl")}>Partner applications <ArrowUpRight className="size-4" /></Link>
        <Link href="/dashboard/rider-applications" className={cn(buttonVariants({ variant: "outline" }), "h-12 justify-between rounded-xl")}>Rider applications <ArrowUpRight className="size-4" /></Link>
      </div>
    </div>
  );
}
