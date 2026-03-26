"use client";

import Link from "next/link";
import { Bike, Percent, Star, UtensilsCrossed } from "lucide-react";
import {
  publicFileUrl,
  type PublicMenuItem,
  type PublicRestaurant,
  type RestaurantWithMenusFeed,
} from "@/lib/public-api";
import { cn } from "@/lib/utils";

function formatPesoInt(n: number) {
  return `₱${n.toLocaleString("en-PH")}`;
}

function formatReviews(n: number) {
  if (n >= 1000) {
    return `${Math.floor(n / 1000)}k+`;
  }
  return String(n);
}

function priceLevelSymbols(level: number) {
  const l = Math.min(3, Math.max(1, level));
  return "₱".repeat(l);
}

function formatPhp(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "₱0.00";
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type DishFeedEntry = {
  item: PublicMenuItem;
  restaurant: PublicRestaurant;
};

function flattenToDishes(blocks: RestaurantWithMenusFeed[]): DishFeedEntry[] {
  const out: DishFeedEntry[] = [];
  for (const { restaurant, menus } of blocks) {
    for (const group of menus) {
      for (const item of group.items) {
        out.push({ item, restaurant });
      }
    }
  }
  return out;
}

function DishFoodpandaCard({ item, restaurant }: DishFeedEntry) {
  const href = restaurant.slug ? `/restaurant/${encodeURIComponent(restaurant.slug)}` : null;
  const img = publicFileUrl(item.image_path, item.image_url);
  const rating = restaurant.rating ?? 4.5;
  const reviews = restaurant.review_count ?? 100;
  const dMin = restaurant.delivery_min_minutes ?? 20;
  const dMax = restaurant.delivery_max_minutes ?? 40;
  const fee = restaurant.delivery_fee_php ?? 49;
  const freeMin = restaurant.free_delivery_min_spend_php ?? 299;
  const level = restaurant.price_level ?? 2;
  const cuisine = restaurant.cuisine?.name ?? "Food";
  const promo = restaurant.promo_label;
  const isAd = restaurant.is_ad ?? false;

  const inner = (
    <>
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-primary/[0.08] to-muted"
        )}
      >
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={img}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <UtensilsCrossed className="size-14 text-primary/30" strokeWidth={1.25} />
          </div>
        )}
        {isAd ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Ad
          </span>
        ) : null}
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground">
            {item.name}
          </h3>
          <div className="flex shrink-0 items-baseline gap-0.5 text-sm font-bold tabular-nums text-foreground">
            <Star className="size-4 shrink-0 fill-orange-400 text-orange-400" aria-hidden />
            <span>{rating % 1 < 0.05 ? Math.round(rating).toString() : rating.toFixed(1)}</span>
            <span className="max-w-[4.5rem] truncate font-normal text-muted-foreground">
              ({formatReviews(reviews)})
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm font-semibold text-primary">from {formatPhp(item.price)}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {dMin}–{dMax} min · {priceLevelSymbols(level)} · {cuisine}
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs leading-snug">
          <Bike className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span className="font-medium text-foreground">{formatPesoInt(fee)}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            or Free with {formatPesoInt(freeMin)} spend
          </span>
        </p>
        {promo ? (
          <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Percent className="size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{promo}</span>
          </p>
        ) : null}
      </div>
    </>
  );

  const cardClass =
    "group overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(cardClass, "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}
      >
        {inner}
      </Link>
    );
  }

  return <article className={cardClass}>{inner}</article>;
}

export function AllRestaurantsMenuFeed({ blocks }: { blocks: RestaurantWithMenusFeed[] }) {
  const entries = flattenToDishes(blocks);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No dishes to show yet. Partners can add menu items from their dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(({ item, restaurant }) => (
        <DishFoodpandaCard key={`${restaurant.id}-${item.id}`} item={item} restaurant={restaurant} />
      ))}
    </div>
  );
}
