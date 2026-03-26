"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Clock, MapPin, X } from "lucide-react";
import {
  publicFileUrl,
  type PublicLocationImage,
  type PublicOpeningHoursDay,
  type PublicRestaurant,
} from "@/lib/public-api";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Monday → Sunday (matches common delivery-app weekly lists). */
const WEEK_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

function mondayFirstSort(a: PublicOpeningHoursDay, b: PublicOpeningHoursDay): number {
  const ra = WEEK_ORDER_MON_FIRST.indexOf(a.day as (typeof WEEK_ORDER_MON_FIRST)[number]);
  const rb = WEEK_ORDER_MON_FIRST.indexOf(b.day as (typeof WEEK_ORDER_MON_FIRST)[number]);
  return ra - rb;
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** One line for display (24h as stored, e.g. "09:00 – 21:00"). */
function formatHoursLine(row: PublicOpeningHoursDay): string {
  if (row.closed) return "Closed";
  if (row.open && row.close) return `${row.open} – ${row.close}`;
  return "—";
}

function hoursKey(row: PublicOpeningHoursDay): string {
  if (row.closed) return "closed";
  if (row.open && row.close) return `${row.open}|${row.close}`;
  return "unknown";
}

/** Next calendar day (handles Sat → Sun). */
function isNextCalendarDay(prevDay: number, nextDay: number): boolean {
  if (nextDay === prevDay + 1) return true;
  if (prevDay === 6 && nextDay === 0) return true;
  return false;
}

/** Merge Wed–Sat style ranges when consecutive days share the same hours. */
function groupConsecutiveDays(
  sorted: PublicOpeningHoursDay[]
): { startDay: number; endDay: number; row: PublicOpeningHoursDay }[] {
  const groups: { startDay: number; endDay: number; row: PublicOpeningHoursDay }[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      isNextCalendarDay(last.endDay, row.day) &&
      hoursKey(last.row) === hoursKey(row)
    ) {
      last.endDay = row.day;
    } else {
      groups.push({ startDay: row.day, endDay: row.day, row });
    }
  }
  return groups;
}

function dayRangeLabel(startDay: number, endDay: number): string {
  if (startDay === endDay) return DAY_LABELS[startDay];
  return `${DAY_LABELS[startDay]} – ${DAY_LABELS[endDay]}`;
}

/** Returns true/false if determinable, or null if no hours data. */
function isOpenNow(hours: PublicOpeningHoursDay[] | null | undefined): boolean | null {
  if (!hours?.length) return null;
  const now = new Date();
  const day = now.getDay();
  const row = hours.find((h) => h.day === day);
  if (!row || row.closed || !row.open || !row.close) return false;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const openM = timeToMinutes(row.open);
  const closeM = timeToMinutes(row.close);
  return nowM >= openM && nowM < closeM;
}

export type RestaurantInfoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: PublicRestaurant;
  /** Shown in “Minimum order” copy (matches header strip when possible). */
  minimumOrderPeso?: number;
};

export function RestaurantInfoModal({
  open,
  onOpenChange,
  restaurant,
  minimumOrderPeso = 99,
}: RestaurantInfoModalProps) {
  const titleId = useId();
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) queueMicrotask(() => setHoursExpanded(false));
  }, [open]);

  const openStatus = useMemo(
    () => isOpenNow(restaurant.opening_hours),
    [restaurant.opening_hours]
  );

  const fee = restaurant.delivery_fee_php ?? 49;
  const sortedHours = useMemo(() => {
    const h = restaurant.opening_hours;
    if (!h?.length) return [];
    return [...h].sort((a, b) => a.day - b.day);
  }, [restaurant.opening_hours]);

  const todayRow = useMemo(() => {
    const d = new Date().getDay();
    return sortedHours.find((r) => r.day === d);
  }, [sortedHours]);

  const sortedHoursMondayFirst = useMemo(() => {
    if (!sortedHours.length) return [];
    return [...sortedHours].sort(mondayFirstSort);
  }, [sortedHours]);

  const groupedWeeklyRows = useMemo(
    () => groupConsecutiveDays(sortedHoursMondayFirst),
    [sortedHoursMondayFirst]
  );

  const resolvedLocationPhotos = useMemo(() => {
    const imgs = restaurant.location_images ?? [];
    const sorted = [...imgs].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    return sorted
      .map((img) => ({ img, src: publicFileUrl(img.path, img.url) }))
      .filter((x): x is { img: PublicLocationImage; src: string } => x.src != null);
  }, [restaurant.location_images]);

  if (!mounted || !open) return null;

  const node = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
        aria-label="Close dialog"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[101] flex max-h-[min(92vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/80 bg-card shadow-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 pb-4 pt-5">
          <h2 id={titleId} className="pr-8 text-lg font-bold leading-snug text-foreground">
            {restaurant.name}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground transition hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
          {/* Hours — clock + status left, pill “View more” right; panel expands below */}
          <section className="border-b border-border/50 pb-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">
                    {sortedHours.length === 0
                      ? "Opening hours"
                      : openStatus
                        ? "Now Open"
                        : "Closed"}
                  </p>
                  <button
                    type="button"
                    aria-expanded={hoursExpanded}
                    aria-controls="opening-hours-panel"
                    onClick={() => setHoursExpanded((v) => !v)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-muted/70 px-2.5 py-1.5 text-sm font-normal text-foreground shadow-sm transition hover:bg-muted"
                  >
                    <span>{hoursExpanded ? "View less" : "View more"}</span>
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground"
                      aria-hidden
                    >
                      {hoursExpanded ? (
                        <ChevronUp className="size-3.5" strokeWidth={2} />
                      ) : (
                        <ChevronDown className="size-3.5" strokeWidth={2} />
                      )}
                    </span>
                  </button>
                </div>

                <div
                  id="opening-hours-panel"
                  role="region"
                  aria-label={
                    sortedHours.length === 0 ? "Opening hours details" : "Full weekly opening hours"
                  }
                  aria-hidden={!hoursExpanded}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    hoursExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="mt-3 space-y-2">
                      {sortedHours.length === 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            No schedule is published yet. The restaurant adds hours from{" "}
                            <span className="font-medium text-foreground">Partner dashboard → Hours</span>; after
                            they save, you will see each day here (same Mon–Sun data as the partner editor).
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-5 pt-0.5">
                          {todayRow ? (
                            <div>
                              <p className="text-sm font-normal text-foreground">Today</p>
                              <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                                {formatHoursLine(todayRow)}
                              </p>
                            </div>
                          ) : null}

                          <div>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 text-sm font-bold text-foreground">Weekly schedule</span>
                              <div className="h-px min-w-0 flex-1 bg-border" />
                            </div>
                            <div className="mt-4 space-y-4">
                              {groupedWeeklyRows.map((g) => (
                                <div key={`${g.startDay}-${g.endDay}`}>
                                  <p className="text-sm font-normal text-foreground">
                                    {dayRangeLabel(g.startDay, g.endDay)}
                                  </p>
                                  <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                                    {formatHoursLine(g.row)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Address + location photos (partner uploads) */}
          <section className="border-b border-border/50 py-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                {restaurant.address?.trim() ? (
                  <p className="text-sm font-bold leading-snug text-foreground">{restaurant.address.trim()}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Address not available.</p>
                )}
                {resolvedLocationPhotos.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {resolvedLocationPhotos.map(({ img, src }) => (
                      <div
                        key={img.id}
                        className="overflow-hidden rounded-xl ring-1 ring-border/60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="aspect-[16/10] w-full object-cover sm:max-h-72"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "mt-3 flex aspect-[16/10] h-44 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-border/40 sm:h-52"
                    )}
                  >
                    <MapPin className="size-10 text-muted-foreground/40" strokeWidth={1.25} />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Delivery & minimum order */}
          <section className="space-y-5 pt-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Delivery fee</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Delivery fee is charged based on time of day, distance, and surge conditions. Typical fee from this
                store is around {formatPeso(fee)}.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Minimum order</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                For orders below {formatPeso(minimumOrderPeso)}, we may charge a small order fee.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
