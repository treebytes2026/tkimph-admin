"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAdminRealtime } from "@/contexts/admin-realtime-context";
import {
  Users,
  Store,
  Bike,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  ArrowUpRight,
  Sparkles,
  ClipboardList,
} from "lucide-react";

const stats = [
  {
    title: "Total users",
    value: "1,234",
    change: "+12%",
    icon: Users,
    accent: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/15 text-primary",
  },
  {
    title: "Restaurants",
    value: "56",
    change: "+3",
    icon: Store,
    accent: "from-brand-yellow/25 to-brand-yellow/5",
    iconBg: "bg-brand-yellow/20 text-brand-yellow-foreground",
  },
  {
    title: "Active riders",
    value: "89",
    change: "+7",
    icon: Bike,
    accent: "from-primary/15 to-muted",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    title: "Total orders",
    value: "3,456",
    change: "+18%",
    icon: ShoppingBag,
    accent: "from-secondary/20 to-secondary/5",
    iconBg: "bg-secondary/15 text-secondary-foreground",
  },
];

const recentOrders = [
  {
    id: "#ORD-001",
    customer: "Juan Dela Cruz",
    restaurant: "Jollibee - SM City",
    status: "delivered",
    total: "₱345.00",
  },
  {
    id: "#ORD-002",
    customer: "Maria Santos",
    restaurant: "McDonald's - Ayala",
    status: "in_transit",
    total: "₱520.00",
  },
  {
    id: "#ORD-003",
    customer: "Pedro Reyes",
    restaurant: "Chowking - Robinsons",
    status: "preparing",
    total: "₱280.00",
  },
  {
    id: "#ORD-004",
    customer: "Ana Garcia",
    restaurant: "KFC - Market Mall",
    status: "pending",
    total: "₱415.00",
  },
  {
    id: "#ORD-005",
    customer: "Carlos Mendoza",
    restaurant: "Pizza Hut - Gaisano",
    status: "delivered",
    total: "₱690.00",
  },
];

const weekBars = [40, 65, 45, 80, 55, 90, 70];

function getStatusBadge(status: string) {
  switch (status) {
    case "delivered":
      return (
        <Badge className="border-0 bg-primary/15 font-medium text-primary hover:bg-primary/20">
          <CheckCircle className="mr-1 size-3" />
          Delivered
        </Badge>
      );
    case "in_transit":
      return (
        <Badge className="border-0 bg-brand-yellow/25 font-medium text-brand-yellow-foreground hover:bg-brand-yellow/35">
          <Bike className="mr-1 size-3" />
          In transit
        </Badge>
      );
    case "preparing":
      return (
        <Badge className="border-0 bg-muted font-medium text-foreground hover:bg-muted/80">
          <Clock className="mr-1 size-3" />
          Preparing
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="font-medium">
          <Clock className="mr-1 size-3" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function DashboardHomeView() {
  const { registrationStats: regStats } = useAdminRealtime();

  const pendingTotal =
    regStats != null
      ? regStats.pending_partner_applications + regStats.pending_rider_applications
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome */}
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
            Dashboard overview
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Track orders, partners, and riders at a glance. Numbers below are sample data for the
            admin preview.
          </p>
        </div>
        <Button className="h-10 shrink-0 gap-2 rounded-xl font-semibold shadow-sm">
          <Sparkles className="size-4" />
          Generate report
        </Button>
      </div>

      {pendingTotal !== null && pendingTotal > 0 ? (
        <Card className="border-primary/25 bg-primary/[0.04] shadow-sm">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ClipboardList className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Pending registration reviews</p>
                <p className="text-sm text-muted-foreground">
                  {regStats!.pending_partner_applications} partner
                  {regStats!.pending_partner_applications === 1 ? "" : "s"},{" "}
                  {regStats!.pending_rider_applications} rider
                  {regStats!.pending_rider_applications === 1 ? "" : "s"} waiting for action.
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

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="group relative overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent} opacity-90`}
            />
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div
                className={`flex size-10 items-center justify-center rounded-xl ${stat.iconBg} transition-transform group-hover:scale-105`}
              >
                <stat.icon className="size-5" strokeWidth={1.75} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight tabular-nums">{stat.value}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  <TrendingUp className="size-3" />
                  {stat.change}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Revenue + chart */}
        <Card className="border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Revenue</CardTitle>
              <p className="text-sm text-muted-foreground">Last 7 days (sample)</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-yellow/20 text-brand-yellow-foreground">
              <DollarSign className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-4xl font-bold tracking-tight tabular-nums">₱12,450</p>
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
                <span className="text-muted-foreground">This week</span>
                <span className="font-semibold tabular-nums">₱87,230</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">This month</span>
                <span className="font-semibold tabular-nums">₱342,100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Avg. order</span>
                <span className="font-semibold tabular-nums">₱385</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="border-border/60 shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Recent orders</CardTitle>
              <p className="text-sm text-muted-foreground">Latest activity across the platform</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              View all
              <ArrowUpRight className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="hidden grid-cols-[1fr_1fr_auto_auto] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>Customer</span>
                <span>Restaurant</span>
                <span className="text-center">Status</span>
                <span className="text-right">Total</span>
              </div>
              <ul className="divide-y divide-border/60">
                {recentOrders.map((order) => (
                  <li
                    key={order.id}
                    className="grid grid-cols-1 gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_auto_auto] md:items-center md:gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-brand-yellow/15 text-sm font-bold text-primary">
                        {order.customer
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{order.customer}</p>
                        <p className="text-xs text-muted-foreground">{order.id}</p>
                      </div>
                    </div>
                    <p className="truncate text-sm text-muted-foreground md:text-foreground">
                      {order.restaurant}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end md:justify-center">
                      {getStatusBadge(order.status)}
                    </div>
                    <span className="font-semibold tabular-nums sm:text-right md:text-right">
                      {order.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
