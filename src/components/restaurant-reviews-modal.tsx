"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Star } from "lucide-react";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

type RestaurantReview = {
  id: number;
  restaurant_rating: number;
  comment: string | null;
  customer_name: string | null;
  created_at: string | null;
};

type ReviewSort = "top" | "newest" | "highest" | "lowest";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="text-amber-500"
          style={{ width: size, height: size }}
          fill={n <= clamped ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function starCounts(reviews: RestaurantReview[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const key = Math.max(1, Math.min(5, r.restaurant_rating));
    counts[key] += 1;
  }
  return counts;
}

export function RestaurantReviewsModal({
  open,
  onOpenChange,
  restaurantName,
  reviews,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantName: string;
  reviews: RestaurantReview[];
}) {
  const titleId = useId();
  const mounted = useIsClient();
  const [sort, setSort] = useState<ReviewSort>("top");

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

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.restaurant_rating, 0) / reviews.length;
  }, [reviews]);

  const counts = useMemo(() => starCounts(reviews), [reviews]);

  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    if (sort === "newest") {
      return arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    if (sort === "highest") {
      return arr.sort((a, b) => b.restaurant_rating - a.restaurant_rating);
    }
    if (sort === "lowest") {
      return arr.sort((a, b) => a.restaurant_rating - b.restaurant_rating);
    }
    return arr.sort((a, b) => {
      if (b.restaurant_rating !== a.restaurant_rating) return b.restaurant_rating - a.restaurant_rating;
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [reviews, sort]);

  if (!mounted || !open) return null;

  const sortTabs: Array<{ id: ReviewSort; label: string }> = [
    { id: "top", label: "Top reviews" },
    { id: "newest", label: "Newest" },
    { id: "highest", label: "Highest rating" },
    { id: "lowest", label: "Lowest rating" },
  ];

  const node = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={() => onOpenChange(false)}
        aria-label="Close reviews"
      />
      <div className="relative z-[111] flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-6 pb-4 pt-5">
          <div>
            <h2 id={titleId} className="text-2xl font-bold text-foreground">{restaurantName}</h2>
            <p className="text-sm text-muted-foreground">Reviews</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
              <div>
                <p className="text-5xl font-bold text-foreground">
                  {reviews.length > 0 ? (average % 1 < 0.05 ? Math.round(average).toString() : average.toFixed(1)) : "New"}
                </p>
                <p className="mt-1 text-sm text-amber-600">
                  <Stars value={average} />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All ratings ({reviews.length.toLocaleString("en-PH")})
                </p>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = counts[stars] ?? 0;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="grid grid-cols-[26px_1fr_42px] items-center gap-2 text-xs">
                      <span className="inline-flex items-center text-foreground">
                        {stars}
                        <Star className="ml-0.5 size-3 text-amber-500" fill="currentColor" />
                      </span>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-right text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {sortTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSort(tab.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  sort === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {sortedReviews.length === 0 ? (
              <p className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                No reviews yet.
              </p>
            ) : (
              sortedReviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-border/70 bg-background p-4">
                  <p className="text-xl font-semibold text-foreground">{review.customer_name ?? "Customer"}</p>
                  <p className="mt-1 text-sm text-amber-600">
                    <Stars value={review.restaurant_rating} size={13} />
                    <span className="ml-2 text-muted-foreground">{relativeTime(review.created_at)}</span>
                  </p>
                  {review.comment ? <p className="mt-2 text-base text-foreground">{review.comment}</p> : null}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
