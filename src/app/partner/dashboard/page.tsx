"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchPartnerOverview,
  PartnerApiError,
  type PartnerOverviewRestaurant,
} from "@/lib/partner-api";
import {
  Store,
  MapPin,
  Phone,
  Sparkles,
  UtensilsCrossed,
  Clock,
  ArrowRight,
  Loader2,
  Tags,
} from "lucide-react";

function RestaurantCard({ r }: { r: PartnerOverviewRestaurant }) {
  const hasListing =
    Boolean(r.business_type) || Boolean(r.business_category) || Boolean(r.cuisine);

  return (
    <Card className="border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="space-y-2">
          <CardTitle className="text-xl font-bold tracking-tight">{r.name}</CardTitle>
          <p className="text-xs font-medium text-muted-foreground">Where you belong on TKimph</p>
          {hasListing ? (
            <div className="flex flex-wrap gap-2">
              {r.cuisine ? (
                <Badge
                  variant="default"
                  className="gap-1 border-0 bg-primary/90 font-medium text-primary-foreground hover:bg-primary"
                >
                  <UtensilsCrossed className="size-3.5 opacity-90" aria-hidden />
                  <span className="font-semibold">Cuisine:</span> {r.cuisine.name}
                </Badge>
              ) : null}
              {r.business_type ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  <Store className="size-3.5 opacity-80" aria-hidden />
                  {r.business_type.name}
                </Badge>
              ) : null}
              {r.business_category ? (
                <Badge variant="outline" className="gap-1 font-normal">
                  <Tags className="size-3.5 opacity-80" aria-hidden />
                  {r.business_category.name}
                </Badge>
              ) : null}
            </div>
          ) : (
            <CardDescription>Business type, category, and cuisine will show here once set.</CardDescription>
          )}
        </div>
        <Badge
          className={
            r.is_active
              ? "border-0 bg-primary/15 font-medium text-primary hover:bg-primary/20"
              : "font-medium"
          }
          variant={r.is_active ? "default" : "secondary"}
        >
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {r.address ? (
          <p className="flex gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" />
            <span>{r.address}</span>
          </p>
        ) : null}
        {r.phone ? (
          <p className="flex gap-2 text-muted-foreground">
            <Phone className="mt-0.5 size-4 shrink-0 text-primary/80" />
            <span>{r.phone}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboardHomePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchPartnerOverview();
        if (!cancelled) {
          setData(o);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof PartnerApiError && e.status === 403) {
            setError("This area is for restaurant partners only.");
          } else {
            setError(e instanceof PartnerApiError ? e.message : "Could not load your dashboard.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading your partner hub…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
        <p className="text-sm font-medium text-destructive">{error ?? "Something went wrong."}</p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "default" }), "mt-4 rounded-xl inline-flex")}
        >
          Back to home
        </Link>
      </div>
    );
  }

  const firstName = data.user.name.split(/\s+/)[0] ?? data.user.name;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-background to-brand-yellow/[0.12] p-8 shadow-sm md:p-10">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative">
          <p className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            This is your restaurant partner home. Manage your presence on TKimph — more tools for menu,
            orders, and hours will land here next.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm dark:bg-card/80">
              <Sparkles className="size-4 text-primary" />
              Partner hub
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm dark:bg-card/60">
              <Store className="size-4 text-primary" />
              Partner listing
            </span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground">Your restaurant</h2>
        {data.restaurants.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <Store className="size-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No restaurant linked yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  After your application is approved, your store will show up here. Need help? Contact
                  TKimph support.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <RestaurantCard r={data.restaurants[0]} />
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-foreground">Coming next</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/80 opacity-80">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
                    <UtensilsCrossed className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Menu & dishes</CardTitle>
                    <CardDescription>Upload and edit your menu for customers.</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Soon
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" disabled>
                Open
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
          <Card className="border-border/80 opacity-80">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
                    <Clock className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Opening hours</CardTitle>
                    <CardDescription>Set when you accept orders.</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Soon
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" disabled>
                Open
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
