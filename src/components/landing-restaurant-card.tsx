"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Bike, Percent, Star, Store } from "lucide-react";
import { publicFileUrl, type PublicRestaurant } from "@/lib/public-api";
import { cn } from "@/lib/utils";

function formatPesoInt(n: number) {
  return `₱${n.toLocaleString("en-PH")}`;
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
  return "₱".repeat(l);
}

export type RestaurantListingCardProps = {
  restaurant: PublicRestaurant;
  /** `top` = compact strip (profile photo only). `all` = full card with menu names (Pizza · rice meal). */
  variant?: "top" | "all";
  className?: string;
  imageClassName?: string;
};

export function RestaurantListingCard(props: RestaurantListingCardProps) {
  return (
    <Suspense>
      <RestaurantListingCardInner {...props} />
    </Suspense>
  );
}

function RestaurantListingCardInner({
  restaurant,
  variant = "all",
  className,
  imageClassName,
}: RestaurantListingCardProps) {
  const searchParams = useSearchParams();
  const expedition = searchParams.get("expedition") === "pickup" ? "pickup" : "delivery";
  const profilePhoto = publicFileUrl(restaurant.profile_image_path, restaurant.profile_image_url);
  const photo = profilePhoto;
  const showMenuNames = variant === "all";
  const rating = restaurant.rating ?? 0;
  const reviews = restaurant.review_count ?? 0;
  const dMin = restaurant.delivery_min_minutes ?? 20;
  const dMax = restaurant.delivery_max_minutes ?? 40;
  const fee = restaurant.delivery_fee_php ?? 49;
  const level = restaurant.price_level ?? 2;
  const cuisine = restaurant.cuisine?.name ?? "Restaurant";
  const promo = restaurant.promo_label;
  const isAd = restaurant.is_ad ?? false;
  const menuNames = restaurant.menus?.map((m) => m.name).filter(Boolean) ?? [];
  const detailHref = restaurant.slug
    ? `/restaurant/${encodeURIComponent(restaurant.slug)}?expedition=${expedition}`
    : null;

  const inner = (
    <>
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-primary/[0.08] to-muted",
          imageClassName
        )}
      >
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Store className="size-14 text-primary/30" strokeWidth={1.25} />
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
            {restaurant.name}
          </h3>
          <div className="flex shrink-0 items-baseline gap-0.5 text-sm font-bold tabular-nums text-foreground">
            <Star className="size-4 shrink-0 fill-orange-400 text-orange-400" aria-hidden />
            <span>{reviews > 0 ? (rating % 1 < 0.05 ? Math.round(rating).toString() : rating.toFixed(1)) : "New"}</span>
            <span className="max-w-[4.5rem] truncate font-normal text-muted-foreground">
              ({reviews > 0 ? formatReviews(reviews) : "No reviews yet"})
            </span>
          </div>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {dMin}–{dMax} min · {priceLevelSymbols(level)} · {cuisine}
        </p>
        {showMenuNames && menuNames.length > 0 ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">Menus:</span> {menuNames.join(" · ")}
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs leading-snug">
          <Bike className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <span className="font-medium text-foreground">
            {fee === 0 ? "Free delivery" : `Delivery ${formatPesoInt(fee)}`}
          </span>
        </p>
        {promo ? (
          <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Percent className="size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{promo}</span>
          </p>
        ) : null}
        {showMenuNames && detailHref ? (
          <p className="mt-2 text-xs font-semibold text-primary">View full menu →</p>
        ) : null}
      </div>
    </>
  );

  const cardClass = cn(
    "group overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md",
    className
  );

  if (detailHref) {
    return (
      <Link
        href={detailHref}
        className={cn(
          cardClass,
          "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
      >
        {inner}
      </Link>
    );
  }

  return <article className={cardClass}>{inner}</article>;
}
