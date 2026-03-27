"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Bike, Percent, Star, UtensilsCrossed } from "lucide-react";
import {
  publicFileUrl,
  type PublicMenuItem,
  type PublicRestaurant,
  type RestaurantWithMenusFeed,
} from "@/lib/public-api";
import { cn } from "@/lib/utils";

function formatPesoInt(n: number) {
  return `\u20B1${n.toLocaleString("en-PH")}`;
}

function formatReviews(n: number) {
  if (n <= 0) return "0";
  if (n >= 1000) {
    return `${Math.floor(n / 1000)}k+`;
  }
  return String(n);
}

function priceLevelSymbols(level: number) {
  const l = Math.min(3, Math.max(1, level));
  return "\u20B1".repeat(l);
}

function formatPhp(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "\u20B10.00";
  return `\u20B1${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function promoAdjustedPrice(item: PublicMenuItem, restaurant: PublicRestaurant): number | null {
  const base = Number(item.price);
  if (!Number.isFinite(base) || base <= 0) return null;
  const promos = restaurant.promotions ?? [];
  if (promos.length === 0) return null;

  const promo = promos.find((p) => p.min_spend <= base);
  if (!promo) return null;

  const raw =
    promo.discount_type === "percentage"
      ? base * (promo.discount_value / 100)
      : promo.discount_value;
  const capped = promo.max_discount_amount != null ? Math.min(raw, promo.max_discount_amount) : raw;
  const discount = Math.max(0, Math.min(base, capped));
  const next = Math.max(0, base - discount);

  return next < base ? next : null;
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

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function DishFoodpandaCard({ item, restaurant }: DishFeedEntry) {
  return (
    <Suspense>
      <DishFoodpandaCardInner item={item} restaurant={restaurant} />
    </Suspense>
  );
}

function DishFoodpandaCardInner({ item, restaurant }: DishFeedEntry) {
  const searchParams = useSearchParams();
  const expedition = searchParams.get("expedition") === "pickup" ? "pickup" : "delivery";
  const href = restaurant.slug
    ? `/restaurant/${encodeURIComponent(restaurant.slug)}?expedition=${expedition}`
    : null;
  const img = publicFileUrl(item.image_path, item.image_url);
  const rating = item.rating ?? 0;
  const reviews = item.review_count ?? 0;
  const dMin = restaurant.delivery_min_minutes ?? 20;
  const dMax = restaurant.delivery_max_minutes ?? 40;
  const fee = restaurant.delivery_fee_php ?? 49;
  const freeMin = restaurant.free_delivery_min_spend_php ?? 299;
  const level = restaurant.price_level ?? 2;
  const cuisine = restaurant.cuisine?.name ?? "Food";
  const promo = restaurant.promo_label;
  const isAd = restaurant.is_ad ?? false;
  const adjusted = promoAdjustedPrice(item, restaurant);

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
            <span>{reviews > 0 ? (rating % 1 < 0.05 ? Math.round(rating).toString() : rating.toFixed(1)) : "New"}</span>
            <span className="max-w-[4.5rem] truncate font-normal text-muted-foreground">
              ({reviews > 0 ? formatReviews(reviews) : "No reviews yet"})
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm">
          <span className="font-semibold text-primary">from {formatPhp(adjusted ?? item.price)}</span>
          {adjusted != null ? (
            <span className="ml-2 text-xs text-muted-foreground line-through">from {formatPhp(item.price)}</span>
          ) : null}
        </p>
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

export function AllRestaurantsMenuFeed({
  blocks,
  query = "",
}: {
  blocks: RestaurantWithMenusFeed[];
  query?: string;
}) {
  const q = normalizeQuery(query);
  const entries = flattenToDishes(blocks).filter(({ item, restaurant }) => {
    if (!q) return true;
    const haystack = normalizeQuery(`${item.name} ${restaurant.name} ${restaurant.cuisine?.name ?? ""}`);
    return haystack.includes(q);
  });

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
