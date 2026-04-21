"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  fetchPartnerOverviewCached,
  PartnerApiError,
  updatePartnerRestaurant,
  type PartnerOpeningHoursDay,
  defaultPartnerOpeningWeek,
} from "@/lib/partner-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function normalizeFromApi(hours: PartnerOpeningHoursDay[] | null): PartnerOpeningHoursDay[] {
  if (!hours?.length) return defaultPartnerOpeningWeek();
  const byDay = new Map(hours.map((h) => [h.day, h]));
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const row = byDay.get(day);
    if (row) return { ...row, day };
    return { day, closed: true, open: null, close: null };
  });
}

export default function PartnerHoursPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [rows, setRows] = useState<PartnerOpeningHoursDay[]>(() => defaultPartnerOpeningWeek());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchPartnerOverviewCached();
        if (cancelled) return;
        const r = o.restaurants[0];
        if (r) {
          setRestaurantId(r.id);
          setRows(normalizeFromApi(r.opening_hours));
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof PartnerApiError ? e.message : "Could not load opening hours.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateRow(day: number, patch: Partial<PartnerOpeningHoursDay>) {
    setRows((prev) =>
      prev.map((row) => (row.day === day ? { ...row, ...patch } : row))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (restaurantId == null) return;

    for (const row of rows) {
      if (!row.closed) {
        if (!row.open || !row.close) {
          toast.error(`Set open and close times for ${DAY_LABELS[row.day]}, or mark closed.`);
          return;
        }
        if (row.open >= row.close) {
          toast.error(`Closing time must be after opening time on ${DAY_LABELS[row.day]}.`);
          return;
        }
      }
    }

    const payload: PartnerOpeningHoursDay[] = rows.map((r) =>
      r.closed
        ? { day: r.day, closed: true, open: null, close: null }
        : { day: r.day, closed: false, open: r.open, close: r.close }
    );

    setSaving(true);
    try {
      await updatePartnerRestaurant(restaurantId, { opening_hours: payload });
      toast.success("Opening hours saved.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    );
  }

  if (error || restaurantId == null) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
        <p className="text-sm font-medium text-destructive">{error ?? "No restaurant linked to your account yet."}</p>
        <Link
          href="/partner/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "default" }), "mt-4 rounded-xl inline-flex")}
        >
          Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Opening hours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set when customers can visit or order. Times use 24-hour format (e.g. 09:00–21:00).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Clock className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Weekly schedule</CardTitle>
                <CardDescription>Toggle closed days, or set open and close times for each day.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row) => (
              <div
                key={row.day}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-[8rem] font-semibold text-foreground">{DAY_LABELS[row.day]}</div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => {
                        const closed = e.target.checked;
                        updateRow(row.day, {
                          closed,
                          open: closed ? null : row.open ?? "09:00",
                          close: closed ? null : row.close ?? "21:00",
                        });
                      }}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="text-muted-foreground">Closed</span>
                  </label>
                  {!row.closed && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Opens</Label>
                        <input
                          type="time"
                          value={row.open ?? ""}
                          onChange={(e) => updateRow(row.day, { open: e.target.value || null })}
                          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Closes</Label>
                        <input
                          type="time"
                          value={row.close ?? ""}
                          onChange={(e) => updateRow(row.day, { close: e.target.value || null })}
                          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving} className="rounded-xl font-semibold">
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save opening hours"
            )}
          </Button>
          <Link
            href="/partner/dashboard/profile"
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "rounded-xl")}
          >
            Store profile
          </Link>
        </div>
      </form>
    </div>
  );
}
