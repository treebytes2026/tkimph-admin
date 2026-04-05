"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import {
  PublicApiError,
  fetchPublicRestaurantBySlug,
  publicFileUrl,
  type PublicMenuGroup,
  type PublicMenuItem,
  type PublicRestaurant,
} from "@/lib/public-api";
import { MenuItemModal } from "@/components/menu-item-modal";
import { RestaurantInfoModal } from "@/components/restaurant-info-modal";
import { RestaurantReviewsModal } from "@/components/restaurant-reviews-modal";
import { useCart } from "@/contexts/cart-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  Flame,
  Info,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

function formatPhp(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "\u20B10.00";
  return `\u20B1${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Spaced peso for cart summary (matches common delivery-app UI). */
function formatPhpSpaced(amount: number): string {
  if (Number.isNaN(amount)) return "\u20B1 0";
  const s = amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `\u20B1 ${s}`;
}

export default function RestaurantDetailPage() {
  return (
    <Suspense>
      <RestaurantDetailPageInner />
    </Suspense>
  );
}

function RestaurantDetailPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const expedition = searchParams.get("expedition") === "pickup" ? "pickup" : "delivery";

  const {
    cart,
    addToCart,
    setQty,
    setLineQuantity,
    cartTotal,
    cartCount,
    registerCartRestaurant,
  } = useCart();

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);
  const [menuGroups, setMenuGroups] = useState<PublicMenuGroup[]>([]);
  const [reviews, setReviews] = useState<Array<{ id: number; restaurant_rating: number; comment: string | null; customer_name: string | null; created_at: string | null }>>([]);

  const [search, setSearch] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [itemModalItem, setItemModalItem] = useState<PublicMenuItem | null>(null);
  const [itemModalQty, setItemModalQty] = useState(1);
  const menuTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPublicRestaurantBySlug(slug);
        if (cancelled) return;
        setRestaurant(res.restaurant);
        setMenuGroups(res.menus);
        setReviews(res.reviews ?? []);
        const first = res.menus[0]?.menu?.id ?? null;
        setActiveMenuId(first);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof PublicApiError ? e.message : "Restaurant not found.");
          setRestaurant(null);
          setMenuGroups([]);
          setReviews([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (restaurant) registerCartRestaurant(restaurant);
  }, [restaurant, registerCartRestaurant]);

  const filteredMenuGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuGroups;
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (it) =>
            it.name.toLowerCase().includes(q) ||
            (it.description?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [menuGroups, search]);

  const itemCountForMenu = useCallback(
    (menuId: number) => {
      const g = filteredMenuGroups.find((s) => s.menu.id === menuId);
      return g?.items.length ?? 0;
    },
    [filteredMenuGroups]
  );

  const scrollMenuTabs = useCallback((dir: "left" | "right") => {
    const el = menuTabsRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 320);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  }, []);

  const openItemModal = useCallback(
    (item: PublicMenuItem) => {
      const line = cart.find((l) => l.item.id === item.id);
      setItemModalQty(line?.qty ?? 1);
      setItemModalItem(item);
    },
    [cart]
  );

  const scrollToMenu = (menuId: number) => {
    setActiveMenuId(menuId);
    document.getElementById(`menu-block-${menuId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const profileSrc = restaurant
    ? publicFileUrl(restaurant.profile_image_path, restaurant.profile_image_url)
    : null;
  const deliveryFee = restaurant?.delivery_fee_php ?? 0;

  const cuisineLine = [restaurant?.cuisine?.name, restaurant?.business_type?.name].filter(Boolean).join(" | ");
  const restaurantRating = restaurant?.rating ?? 0;
  const restaurantReviewCount = restaurant?.review_count ?? 0;

  if (!slug) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="flex-1">
        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Loading menu </p>
          </div>
        ) : error || !restaurant ? (
          <div className="mx-auto max-w-lg px-4 py-20 text-center">
            <p className="text-sm font-medium text-destructive">{error ?? "Not found."}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ChevronLeft className="size-4" /> Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-border/80 bg-card">
              <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-muted-foreground">
                <Link href="/" className="font-medium text-primary hover:underline">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{restaurant.name}</span>
              </div>
            </div>

            {/* Restaurant header */}
            <section className="border-b border-border/80 bg-card">
              <div className="mx-auto max-w-7xl px-4 py-6 md:flex md:gap-8 md:py-8">
                <div className="mx-auto flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted shadow-sm md:mx-0 md:size-36">
                  {profileSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profileSrc} alt="" className="size-full object-cover" />
                  ) : (
                    <Store className="size-14 text-primary/35" strokeWidth={1.25} />
                  )}
                </div>
                <div className="mt-4 min-w-0 flex-1 text-center md:mt-0 md:text-left">
                  {cuisineLine ? (
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {cuisineLine}
                    </p>
                  ) : null}
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    {restaurant.name}
                  </h1>
                  {restaurant.description ? (
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                      {restaurant.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm md:justify-start">
                    <span className="flex items-center gap-1.5 font-semibold text-primary">
                      <Bike className="size-4 shrink-0" />
                      {deliveryFee === 0 ? "Delivery is free right now" : `Delivery fee ${formatPhp(deliveryFee)}`}
                    </span>
                    <span className="text-muted-foreground">Checkout total updates before you place the order</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm md:justify-start">
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Star className="size-4 fill-current" />
                      <span className="font-semibold text-foreground">
                        {restaurantReviewCount > 0
                          ? (restaurantRating % 1 < 0.05 ? Math.round(restaurantRating).toString() : restaurantRating.toFixed(1))
                          : "New"}
                      </span>
                      <span className="text-muted-foreground">
                        ({restaurantReviewCount > 0 ? restaurantReviewCount.toLocaleString("en-PH") : "No reviews yet"})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewsModalOpen(true)}
                      className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                    >
                      See reviews
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfoModalOpen(true)}
                      className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                    >
                      <Info className="size-4" />
                      More info
                    </button>
                  </div>
                  {restaurant.address ? (
                    <p className="mt-3 flex items-start justify-center gap-2 text-xs text-muted-foreground md:justify-start">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {restaurant.address}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Deals strip */}
            <section className="border-b border-border/60 bg-muted/40">
              <div className="mx-auto max-w-7xl px-4 py-4">
                <h2 className="mb-3 text-sm font-bold text-foreground">Available deals</h2>
                {restaurant.promotions && restaurant.promotions.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {restaurant.promotions.slice(0, 4).map((promo) => (
                      <div key={promo.id} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                          <Percent className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{promo.code} - {promo.name}</p>
                          <p className="line-clamp-2 text-xs">{promo.display_label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-secondary to-secondary/90 px-5 py-4 text-secondary-foreground shadow-sm">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Percent className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">App-only deals</p>
                      <p className="text-xs text-secondary-foreground/85">
                        Download the app to unlock more discounts.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Menu + cart layout */}
            <div className="mx-auto max-w-7xl px-4 pb-24 pt-2 lg:flex lg:gap-8 lg:pb-12">
              <div className="min-w-0 flex-1">
                {/* Sticky menu bar: search (pill) + scrollable menu tabs + chevron */}
                <div className="sticky top-[52px] z-30 -mx-4 border-b border-border/80 bg-card px-4 py-3 shadow-sm lg:top-16">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-3 md:items-end md:gap-4">
                    <div className="relative w-full shrink-0 sm:max-w-[min(100%,280px)] sm:w-72">
                      <Search
                        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                        strokeWidth={2}
                      />
                      <input
                        type="search"
                        placeholder="Search in menu"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoComplete="off"
                        className="h-10 w-full rounded-full border-0 bg-muted/90 pl-10 pr-4 text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/25"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-2">
                      <div
                        ref={menuTabsRef}
                        className="flex min-h-[42px] min-w-0 flex-1 flex-nowrap items-end gap-0 overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {menuGroups.map((group) => {
                          const id = group.menu.id;
                          const active = activeMenuId === id;
                          const count = itemCountForMenu(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => scrollToMenu(id)}
                              className={cn(
                                "-mb-px shrink-0 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm transition-colors md:px-4",
                                active
                                  ? "border-foreground font-bold text-foreground"
                                  : "border-transparent font-normal text-muted-foreground hover:text-foreground/85"
                              )}
                            >
                              <span className="inline-flex items-baseline gap-0.5">
                                <span>{group.menu.name}</span>
                                <span
                                  className={cn(
                                    "tabular-nums",
                                    active ? "text-foreground/90" : "text-muted-foreground"
                                  )}
                                >
                                  ({count})
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => scrollMenuTabs("left")}
                          className="hidden size-10 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-md transition hover:bg-muted sm:flex"
                          aria-label="Scroll menus left"
                        >
                          <ChevronLeft className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollMenuTabs("right")}
                          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-md transition hover:bg-muted"
                          aria-label="Scroll menus right"
                        >
                          <ChevronRight className="size-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end sm:mt-3 sm:justify-start lg:hidden">
                    <div className="inline-flex w-full max-w-[280px] rounded-full border border-border/70 bg-muted/50 p-1 text-xs font-semibold sm:max-w-none sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("delivery")}
                        className={cn(
                          "flex-1 rounded-full px-4 py-2 transition sm:flex-none sm:px-5",
                          deliveryMode === "delivery"
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                            : "text-muted-foreground"
                        )}
                      >
                        Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMode("pickup")}
                        className={cn(
                          "flex-1 rounded-full px-4 py-2 transition sm:flex-none sm:px-5",
                          deliveryMode === "pickup"
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
                            : "text-muted-foreground"
                        )}
                      >
                        Pick-up
                      </button>
                    </div>
                  </div>
                </div>

                {/* Menus (partner-defined: Lunch, All day, etc.) */}
                <div className="space-y-10 py-6">
                  {filteredMenuGroups.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      {search.trim() ? "No dishes match your search." : "No menu items yet."}
                    </p>
                  ) : (
                    filteredMenuGroups.map((group) => (
                      <section key={group.menu.id} id={`menu-block-${group.menu.id}`} className="scroll-mt-48">
                        <div className="mb-4">
                          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                            <Flame className="size-6 text-orange-500" aria-hidden />
                            {group.menu.name}
                          </h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">Dishes on this menu.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {group.items.map((item) => {
                            const img = publicFileUrl(item.image_path, item.image_url);
                            const line = cart.find((l) => l.item.id === item.id);
                            const hasDiscount =
                              Boolean(item.has_discount) &&
                              typeof item.original_price === "number" &&
                              item.original_price > Number(item.price);
                            return (
                              <article
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openItemModal(item)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openItemModal(item);
                                  }
                                }}
                                className="flex min-h-[112px] cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md"
                              >
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pl-3 pr-2">
                                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                                    {item.name}
                                  </h3>
                                  <p className="text-sm">
                                    <span className="font-semibold text-primary">{formatPhp(item.price)}</span>
                                    {hasDiscount ? (
                                      <span className="ml-2 text-xs text-muted-foreground line-through">
                                        {formatPhp(item.original_price!)}
                                      </span>
                                    ) : null}
                                  </p>
                                  {hasDiscount ? (
                                    <p className="text-[11px] font-semibold text-emerald-700">
                                      {item.discount_percent}% off on this dish
                                    </p>
                                  ) : null}
                                  {item.description ? (
                                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                                      {item.description}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="relative w-[108px] shrink-0 self-stretch bg-muted sm:w-[118px]">
                                  {img ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={img}
                                      alt=""
                                      className="absolute inset-0 size-full object-cover"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <UtensilsCrossed className="size-10 text-muted-foreground/35" strokeWidth={1.25} />
                                    </div>
                                  )}
                                  <div className="pointer-events-none absolute bottom-2 right-2 z-10">
                                    {line ? (
                                      <span className="flex min-w-8 items-center justify-center rounded-full bg-primary px-2 py-1 text-xs font-bold tabular-nums text-primary-foreground shadow-md">
                                        {line.qty}
                                      </span>
                                    ) : (
                                      <span
                                        className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-md"
                                        aria-hidden
                                      >
                                        <Plus className="size-4 stroke-[2.5]" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </div>

              {/* Cart   desktop (delivery-app style panel) */}
              <aside className="hidden w-full max-w-[380px] shrink-0 lg:block">
                <div className="sticky top-24">
                  <div className="flex max-h-[min(100vh-7rem,720px)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#fafafa] shadow-sm dark:bg-card">
                    {/* Delivery / Pick-up */}
                    <div className="shrink-0 border-b border-border/60 bg-muted/40 p-3">
                      <div className="flex w-full rounded-full border border-border/50 bg-muted/70 p-1">
                        <button
                          type="button"
                          onClick={() => setDeliveryMode("delivery")}
                          className={cn(
                            "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                            deliveryMode === "delivery"
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                              : "text-muted-foreground hover:text-foreground/80"
                          )}
                        >
                          Delivery
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryMode("pickup")}
                          className={cn(
                            "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                            deliveryMode === "pickup"
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                              : "text-muted-foreground hover:text-foreground/80"
                          )}
                        >
                          Pick-up
                        </button>
                      </div>
                    </div>

                    {/* Scrollable lines */}
                    <div className="relative min-h-[260px] flex-1 overflow-y-auto overscroll-contain">
                      {cart.length === 0 ? (
                        <div className="flex min-h-[min(45vh,320px)] flex-col items-center justify-center px-6 py-10">
                          <div className="relative mb-2 flex h-36 w-full max-w-[220px] items-center justify-center">
                            <div className="absolute left-2 top-4 rotate-[-8deg] rounded-lg border-2 border-pink-200 bg-gradient-to-br from-pink-100 to-pink-50 px-2 py-1.5 shadow-md">
                              <Percent className="size-6 text-pink-500" strokeWidth={2.5} />
                            </div>
                            <div className="relative z-[1] flex size-24 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-100/90 to-amber-200/80 shadow-inner ring-2 ring-amber-900/10">
                              <ShoppingBag className="size-12 text-amber-900/70" strokeWidth={1.5} />
                            </div>
                            <Sparkles className="absolute right-6 top-2 size-6 text-amber-400" />
                            <Sparkles className="absolute bottom-6 right-10 size-4 text-yellow-400" />
                            <Sparkles className="absolute left-10 top-2 size-3 text-yellow-300" />
                          </div>
                          <p className="max-w-[200px] text-center text-xs leading-relaxed text-muted-foreground">
                            Your bag is empty. Add something delicious from the menu.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-0 divide-y divide-border/60 px-4 py-3">
                          {cart.map((line) => {
                            const thumb = publicFileUrl(
                              line.item.image_path,
                              line.item.image_url
                            );
                            return (
                              <li key={line.item.id} className="flex gap-3 py-3 first:pt-0">
                                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  {thumb ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={thumb} alt="" className="size-full object-cover" />
                                  ) : (
                                    <div className="flex size-full items-center justify-center text-muted-foreground">
                                      <ShoppingBag className="size-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-tight text-foreground">
                                    {line.item.name}
                                  </p>
                                  <p className="text-xs font-semibold text-primary">
                                    {formatPhp(parseFloat(line.item.price) * line.qty)}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() => setQty(line.item.id, 0)}
                                      aria-label="Remove"
                                    >
                                      <Trash2 className="size-4" />
                                    </button>
                                    <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1 shadow-sm">
                                      <button
                                        type="button"
                                        className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
                                        onClick={() => setQty(line.item.id, line.qty - 1)}
                                      >
                                        <Minus className="size-3.5" />
                                      </button>
                                      <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums">
                                        {line.qty}
                                      </span>
                                      <button
                                        type="button"
                                        className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
                                        onClick={() => addToCart(line.item)}
                                      >
                                        <Plus className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Fade above footer */}
                    <div
                      className="pointer-events-none h-3 shrink-0 bg-gradient-to-t from-[#fafafa] to-transparent dark:from-card"
                      aria-hidden
                    />

                    {/* Sticky summary */}
                    <div className="shrink-0 border-t border-border/80 bg-[#fafafa] px-4 pb-4 pt-1 dark:bg-card">
                      <div className="flex items-start justify-between gap-3 pt-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-bold leading-tight text-foreground">
                            Total (incl. fees and tax)
                          </p>
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-foreground underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
                          >
                            See summary
                          </button>
                        </div>
                        <p className="shrink-0 text-base font-bold tabular-nums text-foreground">
                          {formatPhpSpaced(cartTotal)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        className={cn(
                          "mt-4 h-12 w-full rounded-xl text-[15px] font-semibold",
                          cart.length === 0
                            ? "cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                        disabled={cart.length === 0}
                        onClick={() => router.push(`/checkout?expedition=${expedition}`)}
                      >
                        Review payment and address
                      </Button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* Mobile cart bar */}
            {cart.length > 0 ? (
              <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-[#fafafa] p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:bg-card lg:hidden">
                <div className="mx-auto flex max-w-lg flex-col gap-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Total (incl. fees and tax)
                      </p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {formatPhpSpaced(cartTotal)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{cartCount} items</p>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-xl text-[15px] font-semibold"
                    disabled={cart.length === 0}
                    onClick={() => router.push(`/checkout?expedition=${expedition}`)}
                  >
                    Review payment and address
                  </Button>
                </div>
              </div>
            ) : null}

            <MenuItemModal
              open={itemModalItem != null}
              onOpenChange={(open) => {
                if (!open) setItemModalItem(null);
              }}
              item={itemModalItem}
              quantity={itemModalQty}
              onQuantityChange={setItemModalQty}
              onAddToCart={() => {
                if (itemModalItem) setLineQuantity(itemModalItem, itemModalQty);
              }}
            />

            <RestaurantInfoModal
              open={infoModalOpen}
              onOpenChange={setInfoModalOpen}
              restaurant={restaurant}
            />
            <RestaurantReviewsModal
              open={reviewsModalOpen}
              onOpenChange={setReviewsModalOpen}
              restaurantName={restaurant.name}
              reviews={reviews}
            />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}




