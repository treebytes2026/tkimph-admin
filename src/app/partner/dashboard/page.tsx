"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchPartnerEarnings,
  fetchPartnerOverview,
  fetchPartnerOrders,
  PartnerApiError,
  updatePartnerRestaurantAvailability,
  type PartnerOrder,
  type PartnerOverviewRestaurant,
} from "@/lib/partner-api";
import {
  Store,
  MapPin,
  Phone,
  Sparkles,
  UtensilsCrossed,
  ArrowRight,
  Loader2,
  Tags,
  ShoppingBag,
  AlertCircle,
  Utensils,
  Wallet,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

type PartnerOrderSnapshot = {
  total: number;
  pending: number;
  preparing: number;
  outForDelivery: number;
  completed: number;
};

function summarizeOrders(orders: PartnerOrder[]): PartnerOrderSnapshot {
  return orders.reduce(
    (acc, order) => {
      acc.total += 1;
      if (order.status === "pending" || order.status === "accepted") acc.pending += 1;
      if (order.status === "preparing") acc.preparing += 1;
      if (order.status === "out_for_delivery") acc.outForDelivery += 1;
      if (order.status === "completed") acc.completed += 1;
      return acc;
    },
    { total: 0, pending: 0, preparing: 0, outForDelivery: 0, completed: 0 }
  );
}

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RestaurantCard({ r }: { r: PartnerOverviewRestaurant }) {
  const hasListing = Boolean(r.business_type) || Boolean(r.business_category) || Boolean(r.cuisine);

  return (
    <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-2">
          <CardTitle className="text-xl font-bold tracking-tight">{r.name}</CardTitle>
          <p className="text-xs font-medium text-muted-foreground">Where you belong on TKimph</p>
          {hasListing ? (
            <div className="flex flex-wrap gap-2">
              {r.cuisine ? <Badge variant="default" className="gap-1 border-0 bg-primary/90 font-medium text-primary-foreground hover:bg-primary"><UtensilsCrossed className="size-3.5 opacity-90" aria-hidden /><span className="font-semibold">Cuisine:</span> {r.cuisine.name}</Badge> : null}
              {r.business_type ? <Badge variant="secondary" className="gap-1 font-normal"><Store className="size-3.5 opacity-80" aria-hidden />{r.business_type.name}</Badge> : null}
              {r.business_category ? <Badge variant="outline" className="gap-1 font-normal"><Tags className="size-3.5 opacity-80" aria-hidden />{r.business_category.name}</Badge> : null}
            </div>
          ) : (
            <CardDescription>Business type, category, and cuisine will show here once set.</CardDescription>
          )}
        </div>
        <Badge variant={r.operating_status === "open" ? "default" : "secondary"}>{r.operating_status.replaceAll("_", " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {r.address ? <p className="flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" /><span>{r.address}</span></p> : null}
        {r.phone ? <p className="flex gap-2 text-muted-foreground"><Phone className="mt-0.5 size-4 shrink-0 text-primary/80" /><span>{r.phone}</span></p> : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant={r.readiness_status === "ready" ? "default" : "outline"}>{r.readiness_status === "ready" ? "Launch ready" : "Needs setup"}</Badge>
          <Badge variant={r.publicly_orderable ? "default" : "secondary"}>{r.publicly_orderable ? "Customers can order" : "Ordering blocked"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboardHomePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerOverview>> | null>(null);
  const [earnings, setEarnings] = useState<Awaited<ReturnType<typeof fetchPartnerEarnings>> | null>(null);
  const [orderSnapshot, setOrderSnapshot] = useState<PartnerOrderSnapshot>({ total: 0, pending: 0, preparing: 0, outForDelivery: 0, completed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);

  async function refreshDashboard() {
    const [overviewRes, ordersRes, earningsRes] = await Promise.allSettled([
      fetchPartnerOverview(),
      fetchPartnerOrders({ per_page: 40 }),
      fetchPartnerEarnings(),
    ]);

    if (overviewRes.status === "fulfilled") {
      setData(overviewRes.value);
      setError(null);
    } else {
      const e = overviewRes.reason;
      if (e instanceof PartnerApiError && e.status === 403) setError("This area is for restaurant partners only.");
      else setError(e instanceof PartnerApiError ? e.message : "Could not load your dashboard.");
    }

    if (ordersRes.status === "fulfilled") setOrderSnapshot(summarizeOrders(ordersRes.value.data));
    if (earningsRes.status === "fulfilled") setEarnings(earningsRes.value);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshDashboard();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleAvailability(next: "open" | "paused") {
    const restaurant = data?.restaurants[0];
    if (!restaurant) return;
    setAvailabilityBusy(true);
    try {
      const updated = await updatePartnerRestaurantAvailability(restaurant.id, {
        operating_status: next,
        operating_note: next === "paused" ? "Paused by partner from dashboard." : "Store reopened by partner.",
      });
      setData((current) => current ? { ...current, restaurants: [updated] } : current);
      await refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update store availability.");
    } finally {
      setAvailabilityBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-8 animate-spin text-primary" /><span className="text-sm font-medium">Loading your partner hub...</span></div>;
  }

  if (error || !data) {
    return <div className="mx-auto max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center"><p className="text-sm font-medium text-destructive">{error ?? "Something went wrong."}</p><Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "mt-4 rounded-xl inline-flex")}>Back to home</Link></div>;
  }

  const firstName = data.user.name.split(/\s+/)[0] ?? data.user.name;
  const restaurant = data.restaurants[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-background to-brand-yellow/[0.12] p-8 shadow-sm md:p-10">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-sm font-medium text-muted-foreground">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">Welcome back, {firstName}</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">Stay on top of operations with your store status, readiness checklist, and order momentum in one place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm"><Sparkles className="size-4 text-primary" />Partner hub</span>
            {restaurant ? <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm"><Store className="size-4 text-primary" />{restaurant.operating_status.replaceAll("_", " ")}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80"><CardHeader className="pb-2"><CardDescription>Total orders</CardDescription><CardTitle className="text-2xl">{orderSnapshot.total}</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-xs text-muted-foreground"><ShoppingBag className="size-4 text-primary" />Across recent orders</CardContent></Card>
        <Card className="border-border/80"><CardHeader className="pb-2"><CardDescription>Needs action</CardDescription><CardTitle className="text-2xl">{orderSnapshot.pending}</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-xs text-muted-foreground"><AlertCircle className="size-4 text-amber-600" />Pending or newly accepted</CardContent></Card>
        <Card className="border-border/80"><CardHeader className="pb-2"><CardDescription>Preparing</CardDescription><CardTitle className="text-2xl">{orderSnapshot.preparing}</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-xs text-muted-foreground"><Utensils className="size-4 text-indigo-600" />In kitchen right now</CardContent></Card>
        <Card className="border-border/80"><CardHeader className="pb-2"><CardDescription>Pending settlement</CardDescription><CardTitle className="text-2xl">{formatMoney(earnings?.pending_settlement_amount ?? 0)}</CardTitle></CardHeader><CardContent className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="size-4 text-emerald-600" />COD-first payout visibility</CardContent></Card>
      </div>

      {restaurant ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Store availability</CardTitle>
              <CardDescription>Control whether your restaurant can accept new orders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={restaurant.operating_status === "open" ? "default" : "secondary"}>{restaurant.operating_status.replaceAll("_", " ")}</Badge>
                <Badge variant={restaurant.publicly_orderable ? "default" : "outline"}>{restaurant.publicly_orderable ? "Customers can order" : "Ordering blocked"}</Badge>
              </div>
              {restaurant.operating_note ? <p className="text-sm text-muted-foreground">{restaurant.operating_note}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={availabilityBusy || restaurant.operating_status === "open" || !data.settings.partner_self_pause_enabled} onClick={() => void toggleAvailability("open")}><PlayCircle className="mr-2 size-4" />Resume store</Button>
                <Button type="button" variant="outline" disabled={availabilityBusy || restaurant.operating_status === "paused" || !data.settings.partner_self_pause_enabled} onClick={() => void toggleAvailability("paused")}><PauseCircle className="mr-2 size-4" />Pause store</Button>
              </div>
              {!data.settings.partner_self_pause_enabled ? <p className="text-xs text-muted-foreground">Admin has disabled self-pause for partner accounts.</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Readiness checklist</CardTitle>
              <CardDescription>These items must be complete before your listing can accept public orders.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {restaurant.readiness_checks.map((check) => (
                <div key={check.key} className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{check.label}</span>
                  <span className={check.passed ? "font-semibold text-emerald-700" : "font-semibold text-foreground"}>{check.passed ? "Done" : "Needs work"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle><CardDescription>Open the tools partners use most.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Link href="/partner/dashboard/orders" className={cn(buttonVariants({ variant: "outline" }), "justify-between rounded-xl")}>Orders <ArrowRight className="size-4" /></Link>
            <Link href="/partner/dashboard/menu" className={cn(buttonVariants({ variant: "outline" }), "justify-between rounded-xl")}>Menu <ArrowRight className="size-4" /></Link>
            <Link href="/partner/dashboard/profile" className={cn(buttonVariants({ variant: "outline" }), "justify-between rounded-xl")}>Store profile <ArrowRight className="size-4" /></Link>
            <Link href="/partner/dashboard/promotions" className={cn(buttonVariants({ variant: "outline" }), "justify-between rounded-xl")}>Promotions <ArrowRight className="size-4" /></Link>
            <Link href="/partner/dashboard/earnings" className={cn(buttonVariants({ variant: "outline" }), "justify-between rounded-xl")}>Earnings <ArrowRight className="size-4" /></Link>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader><CardTitle className="text-base">Live kitchen flow</CardTitle><CardDescription>Current pipeline from accept to delivery.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2"><span className="text-muted-foreground">Pending / accepted</span><span className="font-semibold text-foreground">{orderSnapshot.pending}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2"><span className="text-muted-foreground">Preparing</span><span className="font-semibold text-foreground">{orderSnapshot.preparing}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2"><span className="text-muted-foreground">Out for delivery</span><span className="font-semibold text-foreground">{orderSnapshot.outForDelivery}</span></div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground">Your restaurant</h2>
        {data.restaurants.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20"><CardContent className="flex flex-col items-center gap-4 py-12 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10"><Store className="size-7 text-primary" /></div><div><p className="font-semibold text-foreground">No restaurant linked yet</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">After your application is approved, your store will show up here. Need help? Contact TKimph support.</p></div></CardContent></Card>
        ) : (
          <RestaurantCard r={data.restaurants[0]} />
        )}
      </div>
    </div>
  );
}
