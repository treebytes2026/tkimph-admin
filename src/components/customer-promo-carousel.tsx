"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { RestaurantListingCard } from "@/components/landing-restaurant-card";
import type { PublicRestaurant } from "@/lib/public-api";
import { cn } from "@/lib/utils";

type CustomerPromoCarouselProps = {
  restaurants: PublicRestaurant[];
  loading?: boolean;
  className?: string;
};

export function CustomerPromoCarousel({ restaurants, loading, className }: CustomerPromoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState(45 * 60 + 37);

  useEffect(() => {
    const t = window.setInterval(() => {
      setTimeLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;
  const slides = restaurants.slice(0, 8);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 320);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-primary/[0.06] to-emerald-600/10 shadow-sm ring-1 ring-primary/10",
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,oklch(0.55_0.14_145/0.12),transparent)]" />
      <div className="relative px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">Limited time</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Get 25% off
            </h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground sm:text-base">
              Min. order <span className="font-bold text-foreground">₱ 220</span>
            </p>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-white shadow-md dark:bg-zinc-800"
            title="Offer ends in"
          >
            <Clock className="size-4 shrink-0 opacity-90" />
            <span className="font-mono text-lg font-bold tabular-nums">
              {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="relative mt-6">
          {loading ? (
            <div className="flex gap-4 overflow-hidden pb-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[min(85vw,260px)] shrink-0 overflow-hidden rounded-xl border border-white/60 bg-white/80 shadow-md"
                >
                  <div className="aspect-[16/10] animate-pulse bg-muted" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : slides.length === 0 ? (
            <p className="rounded-xl border border-dashed border-primary/25 bg-white/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Add restaurants to see featured picks here.
            </p>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {slides.map((r) => (
                  <div key={r.id} className="w-[min(85vw,260px)] shrink-0 snap-start sm:w-[280px]">
                    <RestaurantListingCard restaurant={r} variant="top" />
                  </div>
                ))}
              </div>
              {slides.length > 1 ? (
                <button
                  type="button"
                  onClick={() => scrollBy("right")}
                  className="absolute right-0 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-lg transition hover:bg-muted"
                  aria-label="Next deals"
                >
                  <ChevronRight className="size-5" />
                </button>
              ) : null}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground sm:text-left">
          Participating restaurants only.{" "}
          <Link href="#" className="font-medium text-primary hover:underline">
            See terms
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
