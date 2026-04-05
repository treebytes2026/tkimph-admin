"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import { AllRestaurantsMenuFeed } from "@/components/all-restaurants-menu-feed";
import { RestaurantListingCard } from "@/components/landing-restaurant-card";
import {
  PublicApiError,
  fetchPublicCuisines,
  fetchPublicRestaurants,
  fetchPublicRestaurantsMenuFeed,
  type PublicCuisine,
  type PublicRestaurant,
  type RestaurantWithMenusFeed,
} from "@/lib/public-api";
import { AUTH_CHANGED_EVENT, getStoredUser, type AuthUser } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Clock,
  ShieldCheck,
  Store,
  UtensilsCrossed,
  Coffee,
  Sandwich,
  Pizza,
  Cake,
  IceCream,
  Loader2,
  Salad,
  ChevronRight,
  SlidersHorizontal,
  Truck,
  QrCode,
  Apple,
  X,
  Sparkles,
  Tag,
} from "lucide-react";

type SortOption = "relevance" | "fastest" | "distance" | "top_rated" | "name_asc" | "name_desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "fastest", label: "Fastest delivery" },
  { value: "distance", label: "Distance" },
  { value: "top_rated", label: "Top rated" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

function applyRestaurantSort(list: PublicRestaurant[], sortBy: SortOption): PublicRestaurant[] {
  const out = [...list];
  switch (sortBy) {
    case "relevance":
      return out;
    case "fastest":
      return out.sort(
        (a, b) => (a.delivery_min_minutes ?? 99) - (b.delivery_min_minutes ?? 99)
      );
    case "distance":
      return out.sort(
        (a, b) => (a.delivery_max_minutes ?? 50) - (b.delivery_max_minutes ?? 50)
      );
    case "top_rated":
      return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "name_asc":
      return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    case "name_desc":
      return out.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    default:
      return out;
  }
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

type PickupMapPoint = {
  restaurant: PublicRestaurant;
  lat: number | null;
  lon: number | null;
};

type PickupGeocodeHit = {
  lat: string;
  lon: string;
};

async function geocodePickupAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as PickupGeocodeHit[];
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

/** Visual variety for cuisine chips (API returns names only). */
const CUISINE_RINGS = [
  "from-amber-400/90 to-orange-600/80",
  "from-red-400/90 to-rose-700/80",
  "from-yellow-400/90 to-amber-700/80",
  "from-amber-500/90 to-yellow-800/80",
  "from-stone-400/90 to-stone-700/80",
  "from-emerald-400/90 to-teal-700/80",
  "from-sky-300/90 to-indigo-500/80",
  "from-lime-400/90 to-emerald-700/80",
  "from-orange-200/90 to-amber-900/70",
  "from-rose-300/90 to-red-800/80",
];

const CUISINE_ICONS = [
  UtensilsCrossed,
  Pizza,
  UtensilsCrossed,
  Sandwich,
  Coffee,
  Cake,
  IceCream,
  Salad,
  Coffee,
  UtensilsCrossed,
];

const features = [
  {
    icon: Truck,
    title: "Fast delivery",
    description: "Get your food delivered in 30 minutes or less.",
  },
  {
    icon: Store,
    title: "Best restaurants",
    description: "We partner with the best local restaurants near you.",
  },
  {
    icon: ShieldCheck,
    title: "Secure payments",
    description: "Your transactions are safe and encrypted.",
  },
  {
    icon: Clock,
    title: "24/7 support",
    description: "Our support team is always here to help you.",
  },
];

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cuisineScroll = useRef<HTMLDivElement>(null);
  const topRestaurantsScroll = useRef<HTMLDivElement>(null);
  const restaurantsSectionRef = useRef<HTMLElement>(null);
  const homeRestaurantsRef = useRef<HTMLDivElement>(null);
  /** Tracks cuisine filter for “clear → scroll back to home” (Top + All). */
  const prevSelectedCuisineId = useRef<number | null | "init">("init");
  const [appQrVisible, setAppQrVisible] = useState(true);

  const [cuisines, setCuisines] = useState<PublicCuisine[]>([]);
  const [cuisinesError, setCuisinesError] = useState<string | null>(null);
  const [loadingCuisines, setLoadingCuisines] = useState(true);

  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [menuFeedBlocks, setMenuFeedBlocks] = useState<RestaurantWithMenusFeed[]>([]);
  /** Total matching the current filter (from API), not just loaded rows. */
  const [restaurantTotal, setRestaurantTotal] = useState<number | null>(null);
  const [restaurantListLimit, setRestaurantListLimit] = useState(60);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [selectedCuisineId, setSelectedCuisineId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [ratings4Plus, setRatings4Plus] = useState(false);
  const [superRestaurant, setSuperRestaurant] = useState(false);
  const [offerFreeDelivery, setOfferFreeDelivery] = useState(false);
  const [offerVouchers, setOfferVouchers] = useState(false);
  const [offerDeals, setOfferDeals] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [pickupMapLoading, setPickupMapLoading] = useState(false);
  const [pickupPoints, setPickupPoints] = useState<PickupMapPoint[]>([]);
  const [pickupRestaurants, setPickupRestaurants] = useState<PublicRestaurant[]>([]);
  const [selectedPickupRestaurantId, setSelectedPickupRestaurantId] = useState<number | null>(null);
  const expedition = searchParams.get("expedition") === "pickup" ? "pickup" : "delivery";
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const normalizedSearchQuery = normalizeQuery(searchQuery);

  useEffect(() => {
    const sync = () => setSessionUser(getStoredUser());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPublicCuisines();
        if (!cancelled) {
          setCuisines(res.data);
          setCuisinesError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCuisinesError(e instanceof PublicApiError ? e.message : "Could not load cuisines.");
        }
      } finally {
        if (!cancelled) setLoadingCuisines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params =
      selectedCuisineId != null ? { cuisine_id: selectedCuisineId, limit: 60 } : { limit: 60 };
    (async () => {
      setLoadingRestaurants(true);
      try {
        const [restaurantsResult, feedResult] = await Promise.allSettled([
          fetchPublicRestaurants(params),
          selectedCuisineId == null
            ? fetchPublicRestaurantsMenuFeed(params)
            : Promise.resolve({ data: [] as RestaurantWithMenusFeed[], meta: undefined }),
        ]);
        if (!cancelled) {
          if (restaurantsResult.status === "fulfilled") {
            const res = restaurantsResult.value;
            setRestaurants(res.data);
            setRestaurantTotal(res.meta?.total ?? res.data.length);
            if (res.meta?.limit != null) setRestaurantListLimit(res.meta.limit);
          } else {
            setRestaurants([]);
            setRestaurantTotal(0);
          }
          if (feedResult.status === "fulfilled") {
            setMenuFeedBlocks(feedResult.value.data);
          } else {
            setMenuFeedBlocks([]);
          }
        }
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCuisineId]);

  useEffect(() => {
    if (expedition !== "pickup") {
      setPickupRestaurants([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPublicRestaurants({ limit: 60 });
        if (!cancelled) setPickupRestaurants(res.data);
      } catch {
        if (!cancelled) setPickupRestaurants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expedition]);

  useEffect(() => {
    if (expedition !== "pickup" || pickupRestaurants.length === 0) {
      setPickupPoints([]);
      setSelectedPickupRestaurantId(null);
      setPickupMapLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setPickupMapLoading(true);
      try {
        const cacheKey = "tkimph:pickup-geocode-cache:v1";
        let cache: Record<string, { lat: number; lon: number }> = {};
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) cache = JSON.parse(raw) as Record<string, { lat: number; lon: number }>;
        } catch {
          cache = {};
        }

        const withAddress = pickupRestaurants.filter((r) => Boolean(r.address?.trim()));

        const points: PickupMapPoint[] = [];
        for (const restaurant of withAddress) {
          if (cancelled) return;
          const address = restaurant.address!.trim();
          let coords: { lat: number; lon: number } | null = cache[address] ?? null;
          if (!coords) {
            coords = await geocodePickupAddress(address);
            if (coords) cache[address] = coords;
          }
          points.push({
            restaurant,
            lat: coords?.lat ?? null,
            lon: coords?.lon ?? null,
          });
        }

        localStorage.setItem(cacheKey, JSON.stringify(cache));
        if (cancelled) return;
        setPickupPoints(points);
        setSelectedPickupRestaurantId((prev) => {
          if (prev != null && points.some((p) => p.restaurant.id === prev)) return prev;
          const firstMappable = points.find((p) => p.lat != null && p.lon != null);
          return firstMappable?.restaurant.id ?? points[0]?.restaurant.id ?? null;
        });
      } finally {
        if (!cancelled) setPickupMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expedition, pickupRestaurants]);

  /** After choosing a cuisine, scroll to the filtered results. */
  useEffect(() => {
    if (selectedCuisineId == null) return;
    const t = window.setTimeout(() => {
      restaurantsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [selectedCuisineId]);

  /** After Clear all (cuisine), return to home layout (Top + All) and scroll there. */
  useEffect(() => {
    const prev = prevSelectedCuisineId.current;
    if (prev !== "init" && prev != null && selectedCuisineId == null) {
      const t = window.setTimeout(() => {
        homeRestaurantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      prevSelectedCuisineId.current = selectedCuisineId;
      return () => window.clearTimeout(t);
    }
    prevSelectedCuisineId.current = selectedCuisineId;
  }, [selectedCuisineId]);

  const selectedCuisine = cuisines.find((c) => c.id === selectedCuisineId);
  const selectedPickupPoint =
    pickupPoints.find((point) => point.restaurant.id === selectedPickupRestaurantId) ?? pickupPoints[0] ?? null;
  const pickupMapHref =
    selectedPickupPoint?.lat != null && selectedPickupPoint?.lon != null
      ? `/pickup/map?expedition=pickup&lat=${selectedPickupPoint.lat}&lng=${selectedPickupPoint.lon}`
      : "/pickup/map?expedition=pickup";

  const clientFilteredRestaurants = useMemo(() => {
    let list = [...restaurants];
    if (ratings4Plus) {
      list = list.filter((r) => (r.rating ?? 0) >= 4);
    }
    if (superRestaurant) {
      list = list.filter((r) => (r.rating ?? 0) >= 4.5 && (r.review_count ?? 0) >= 40);
    }
    if (offerFreeDelivery) {
      list = list.filter((r) => (r.delivery_fee_php ?? 49) === 0);
    }
    if (offerVouchers) {
      list = list.filter(
        (r) =>
          (r.free_delivery_min_spend_php != null && r.free_delivery_min_spend_php > 0) ||
          (r.promo_label != null && r.promo_label.length > 0)
      );
    }
    if (offerDeals) {
      list = list.filter((r) => r.promo_label != null && r.promo_label.length > 0);
    }
    if (normalizedSearchQuery) {
      const feedSearchByRestaurant = new Map<number, string>();
      for (const block of menuFeedBlocks) {
        const menuNames = block.menus.map((menu) => menu.menu.name).join(" ");
        const dishNames = block.menus
          .flatMap((menu) => menu.items.map((item) => item.name))
          .join(" ");
        feedSearchByRestaurant.set(
          block.restaurant.id,
          normalizeQuery(`${block.restaurant.name} ${menuNames} ${dishNames}`)
        );
      }

      list = list.filter((r) => {
        const restaurantText = normalizeQuery(
          `${r.name} ${r.cuisine?.name ?? ""} ${(r.menus ?? []).map((m) => m.name).join(" ")}`
        );
        const feedText = feedSearchByRestaurant.get(r.id) ?? "";
        return restaurantText.includes(normalizedSearchQuery) || feedText.includes(normalizedSearchQuery);
      });
    }
    return list;
  }, [
    restaurants,
    ratings4Plus,
    superRestaurant,
    offerFreeDelivery,
    offerVouchers,
    offerDeals,
    normalizedSearchQuery,
    menuFeedBlocks,
  ]);

  const displayedRestaurants = useMemo(
    () => applyRestaurantSort(clientFilteredRestaurants, sortBy),
    [clientFilteredRestaurants, sortBy]
  );

  const sortedMenuFeedBlocks = useMemo(() => {
    const ids = new Set(clientFilteredRestaurants.map((r) => r.id));
    const list = menuFeedBlocks.filter((b) => ids.has(b.restaurant.id));
    const order = new Map(displayedRestaurants.map((r, i) => [r.id, i]));
    list.sort(
      (a, b) =>
        (order.get(a.restaurant.id) ?? 999) - (order.get(b.restaurant.id) ?? 999)
    );
    return list;
  }, [menuFeedBlocks, clientFilteredRestaurants, displayedRestaurants]);

  const hasActiveFilters =
    selectedCuisineId != null ||
    sortBy !== "relevance" ||
    ratings4Plus ||
    superRestaurant ||
    offerFreeDelivery ||
    offerVouchers ||
    offerDeals;

  const totalMatching = restaurantTotal ?? restaurants.length;
  const shownCount = restaurants.length;
  const clientOfferFilters =
    ratings4Plus || superRestaurant || offerFreeDelivery || offerVouchers || offerDeals;
  const hasMoreThanShown =
    !loadingRestaurants &&
    !clientOfferFilters &&
    totalMatching > shownCount;

  const clearAllFilters = () => {
    setSelectedCuisineId(null);
    setSortBy("relevance");
    setRatings4Plus(false);
    setSuperRestaurant(false);
    setOfferFreeDelivery(false);
    setOfferVouchers(false);
    setOfferDeals(false);
  };

  const topRestaurants = useMemo(
    () => (selectedCuisineId == null ? displayedRestaurants.slice(0, 12) : []),
    [displayedRestaurants, selectedCuisineId]
  );

  const scrollTopRestaurants = (dir: "left" | "right") => {
    const el = topRestaurantsScroll.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.75, 340);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  const scrollCuisines = (dir: "left" | "right") => {
    const el = cuisineScroll.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 360);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBanner />
      <Navbar />

      <div className="relative flex flex-1 flex-col">
        {/* Floating app strip — desktop */}
        {appQrVisible ? (
        <aside className="pointer-events-none fixed left-4 top-[calc(50%+3rem)] z-40 hidden -translate-y-1/2 xl:block">
          <div className="pointer-events-auto relative w-[200px] rounded-2xl border border-primary/25 bg-secondary p-4 pt-5 text-secondary-foreground shadow-xl">
            <button
              type="button"
              onClick={() => setAppQrVisible(false)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-secondary-foreground/70 transition hover:bg-white/10 hover:text-secondary-foreground"
              aria-label="Close app download"
            >
              <X className="size-4" />
            </button>
            <p className="px-1 text-center text-xs font-semibold leading-snug text-secondary-foreground/95">
              Unlock more app-only deals. Download now.
            </p>
            <div className="mt-3 flex justify-center rounded-lg bg-white p-2">
              <QrCode className="size-20 text-primary" aria-hidden />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <span className="flex items-center justify-center gap-1.5 rounded-full bg-brand-yellow/20 py-2 text-[11px] font-semibold text-brand-yellow">
                <Apple className="size-3.5" /> App Store
              </span>
              <span className="flex items-center justify-center gap-1.5 rounded-full bg-brand-yellow/20 py-2 text-[11px] font-semibold text-brand-yellow">
                <span className="font-bold text-[10px]">▶</span> Google Play
              </span>
            </div>
          </div>
        </aside>
        ) : null}

        {/* Main: filters + browse (Foodpanda-style: sidebar + main) */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pb-16 pt-2 lg:gap-8 lg:pt-4">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-36 space-y-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-bold text-foreground">Filters</h3>
                  {hasActiveFilters ? (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      Active
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sort by
                </p>
                <ul className="mt-2 max-h-[220px] space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {SORT_OPTIONS.map((opt) => {
                    const id = `sort-${opt.value}`;
                    return (
                      <li key={opt.value}>
                        <label
                          htmlFor={id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground transition hover:bg-muted/60"
                        >
                          <input
                            id={id}
                            type="radio"
                            name="sort"
                            checked={sortBy === opt.value}
                            onChange={() => setSortBy(opt.value)}
                            className="size-4 shrink-0 accent-primary"
                          />
                          {opt.label}
                        </label>
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick filters
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRatings4Plus((v) => !v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      ratings4Plus
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    Ratings 4+
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuperRestaurant((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      superRestaurant
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Sparkles className="size-3.5 text-amber-500" />
                    Super restaurant
                  </button>
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offers</p>
                <ul className="mt-2 space-y-2">
                  <li>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={offerFreeDelivery}
                        onChange={(e) => setOfferFreeDelivery(e.target.checked)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      Free delivery
                    </label>
                  </li>
                  <li>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={offerVouchers}
                        onChange={(e) => setOfferVouchers(e.target.checked)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      Accepts vouchers
                    </label>
                  </li>
                  <li>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={offerDeals}
                        onChange={(e) => setOfferDeals(e.target.checked)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="inline-flex items-center gap-1">
                        <Tag className="size-3.5 text-primary" />
                        Deals
                      </span>
                    </label>
                  </li>
                </ul>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cuisines
                </p>
                <ul className="mt-2 max-h-[200px] space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  <li>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted/60">
                      <input
                        type="radio"
                        name="sidebar-cuisine"
                        checked={selectedCuisineId == null}
                        onChange={() => setSelectedCuisineId(null)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      All cuisines
                    </label>
                  </li>
                  {cuisines.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted/60">
                        <input
                          type="radio"
                          name="sidebar-cuisine"
                          checked={selectedCuisineId === c.id}
                          onChange={() => setSelectedCuisineId(c.id)}
                          className="size-4 shrink-0 accent-primary"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-xl text-sm font-semibold"
                  disabled={!hasActiveFilters}
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Resets cuisine, sort & offers
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Mobile: sort + quick filters */}
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sort by
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                  disabled={!hasActiveFilters}
                  onClick={clearAllFilters}
                >
                  Clear all
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRatings4Plus((v) => !v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    ratings4Plus ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  Ratings 4+
                </button>
                <button
                  type="button"
                  onClick={() => setOfferFreeDelivery((v) => !v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    offerFreeDelivery ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  Free delivery
                </button>
                <button
                  type="button"
                  onClick={() => setOfferDeals((v) => !v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    offerDeals ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  Deals
                </button>
              </div>
            </div>

            {expedition === "pickup" ? (
              <section className="pb-2 pt-8 md:pb-3 md:pt-10">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                      Pick-up map
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      View all pickup restaurants on a full map page with multiple pins.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    className="rounded-xl px-4 font-semibold"
                    onClick={() => router.push(pickupMapHref)}
                  >
                    Show map
                  </Button>
                </div>
                <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  {pickupMapLoading ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Preparing pickup map data...
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Restaurants with pickup:{" "}
                        <span className="font-semibold text-foreground">{pickupPoints.length}</span>
                      </p>
                      {selectedPickupPoint ? (
                        <p className="mt-2 text-sm font-medium text-foreground">
                          Suggested area: {selectedPickupPoint.restaurant.name}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            ) : null}

            {/* Cuisines — horizontal strip */}
            <section className="py-8 md:py-10">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Cuisines</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tap a cuisine to show only those restaurants and the count found. Tap again for all.
                  </p>
                </div>
                <div className="hidden gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => scrollCuisines("left")}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                    aria-label="Scroll cuisines left"
                  >
                    <ChevronRight className="size-5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCuisines("right")}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                    aria-label="Scroll cuisines right"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>

              {cuisinesError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {cuisinesError}
                </p>
              ) : loadingCuisines ? (
                <div className="flex gap-4 overflow-hidden rounded-xl bg-muted/30 px-1 py-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex shrink-0 flex-col items-center gap-2">
                      <div className="size-[4.5rem] animate-pulse rounded-full bg-muted sm:size-20" />
                      <div className="h-3 w-14 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : cuisines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cuisines are available yet.</p>
              ) : (
                <div className="relative">
                  <div
                    ref={cuisineScroll}
                    className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
                  >
                    {cuisines.map((cuisine, index) => {
                      const Icon = CUISINE_ICONS[index % CUISINE_ICONS.length];
                      const ring = CUISINE_RINGS[index % CUISINE_RINGS.length];
                      const isSelected = selectedCuisineId === cuisine.id;
                      return (
                        <button
                          key={cuisine.id}
                          type="button"
                          onClick={() =>
                            setSelectedCuisineId((prev) => (prev === cuisine.id ? null : cuisine.id))
                          }
                          aria-pressed={isSelected}
                          className="group flex w-[4.5rem] shrink-0 cursor-pointer snap-start flex-col items-center gap-2 sm:w-[5.25rem]"
                        >
                          <div
                            className={`flex size-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br ${ring} p-0.5 shadow-md ring-2 transition group-hover:scale-[1.04] group-hover:shadow-lg sm:size-20 ${
                              isSelected ? "ring-primary ring-offset-2 ring-offset-background" : "ring-white"
                            }`}
                          >
                            <div className="flex size-full items-center justify-center rounded-full bg-white/95 text-primary shadow-inner">
                              <Icon className="size-8 sm:size-9" strokeWidth={1.5} />
                            </div>
                          </div>
                          <span className="max-w-[5rem] text-center text-xs font-semibold text-foreground sm:text-sm">
                            {cuisine.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollCuisines("right")}
                    className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-white text-primary shadow-lg transition hover:bg-muted sm:hidden"
                    aria-label="More cuisines"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}
            </section>

            {/* Filtered by cuisine: single “N Restaurants found” block */}
            {selectedCuisineId != null ? (
              <section
                ref={restaurantsSectionRef}
                id="restaurants-found"
                className="scroll-mt-28 py-6 md:scroll-mt-32 md:py-8"
              >
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                      {loadingRestaurants ? (
                        "Restaurants"
                      ) : displayedRestaurants.length === 1 ? (
                        "1 Restaurant found"
                      ) : (
                        `${displayedRestaurants.length.toLocaleString()} Restaurants found`
                      )}
                    </h2>
                    {!loadingRestaurants ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedCuisine ? (
                          <>
                            Cuisine:{" "}
                            <span className="font-semibold text-foreground">{selectedCuisine.name}</span>
                            {sortBy !== "relevance" ? (
                              <span>
                                {" "}
                                · Sort:{" "}
                                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Relevance"}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Loading restaurants…</p>
                    )}
                    {!loadingRestaurants && hasMoreThanShown ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Showing {shownCount.toLocaleString()} of {totalMatching.toLocaleString()} (up to{" "}
                        {restaurantListLimit} per request).
                      </p>
                    ) : null}
                  </div>
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 shrink-0 rounded-full px-4 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={clearAllFilters}
                    >
                      Clear all
                    </Button>
                  ) : null}
                </div>

                {loadingRestaurants ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
                      >
                        <div className="aspect-[16/10] animate-pulse bg-muted" />
                        <div className="space-y-2 p-4">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
                          <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : restaurants.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                    <Store className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.25} />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {selectedCuisine
                        ? `No restaurants in “${selectedCuisine.name}” yet.`
                        : "No restaurants to show yet."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Check back soon or try another cuisine.
                    </p>
                    {hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-6 rounded-xl font-semibold"
                        onClick={clearAllFilters}
                      >
                        Clear all filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {displayedRestaurants.map((restaurant) => (
                      <RestaurantListingCard key={restaurant.id} restaurant={restaurant} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div
                ref={homeRestaurantsRef}
                id="home-restaurants"
                className="scroll-mt-28 md:scroll-mt-32"
              >
                {/* Top restaurants — home only */}
                <section className="border-b border-border/60 py-6 md:py-8">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                        Top restaurants
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Popular picks — swipe sideways for more.
                      </p>
                    </div>
                    {!loadingRestaurants && topRestaurants.length > 1 ? (
                      <div className="hidden gap-2 sm:flex">
                        <button
                          type="button"
                          onClick={() => scrollTopRestaurants("left")}
                          className="flex size-10 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                          aria-label="Scroll top restaurants left"
                        >
                          <ChevronRight className="size-5 rotate-180" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollTopRestaurants("right")}
                          className="flex size-10 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                          aria-label="Scroll top restaurants right"
                        >
                          <ChevronRight className="size-5" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {loadingRestaurants ? (
                    <div className="flex gap-4 overflow-hidden pb-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[min(100%,280px)] shrink-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:w-[300px]"
                        >
                          <div className="aspect-[16/10] animate-pulse bg-muted" />
                          <div className="space-y-2 p-4">
                            <div className="h-4 w-[85%] animate-pulse rounded bg-muted" />
                            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : topRestaurants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No restaurants yet.</p>
                  ) : (
                    <div className="relative -mx-1">
                      <div
                        ref={topRestaurantsScroll}
                        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {topRestaurants.map((restaurant) => (
                          <div
                            key={`top-${restaurant.id}`}
                            className="w-[min(85vw,280px)] shrink-0 snap-start sm:w-[300px]"
                          >
                            <RestaurantListingCard restaurant={restaurant} variant="top" />
                          </div>
                        ))}
                      </div>
                      {topRestaurants.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => scrollTopRestaurants("right")}
                          className="absolute right-0 top-[38%] flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-lg transition hover:bg-muted sm:hidden"
                          aria-label="More top restaurants"
                        >
                          <ChevronRight className="size-5" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>

                {/* All restaurants — home */}
                <section className="py-6 md:py-8">
                  <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                        All restaurants
                      </h2>
                      {!loadingRestaurants && sortBy !== "relevance" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Relevance"}
                        </p>
                      ) : null}
                      {!loadingRestaurants && normalizedSearchQuery ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Showing results for <span className="font-semibold text-foreground">&quot;{searchQuery}&quot;</span>
                        </p>
                      ) : null}
                    </div>
                    {sortBy !== "relevance" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 shrink-0 rounded-full px-4 text-sm font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => setSortBy("relevance")}
                      >
                        Reset sort
                      </Button>
                    ) : null}
                  </div>

                  {loadingRestaurants ? (
                    <div className="space-y-10">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-6">
                          <div className="space-y-2 border-b border-border/60 pb-3">
                            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
                            <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
                          </div>
                          <div className="space-y-4">
                            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {Array.from({ length: 3 }).map((_, j) => (
                                <div
                                  key={j}
                                  className="flex min-h-[112px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
                                >
                                  <div className="flex flex-1 flex-col justify-center gap-2 p-3">
                                    <div className="h-4 w-[85%] animate-pulse rounded bg-muted" />
                                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                                    <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
                                  </div>
                                  <div className="w-[108px] shrink-0 animate-pulse bg-muted sm:w-[118px]" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : restaurants.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                      <Store className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.25} />
                      <p className="mt-3 text-sm font-medium text-foreground">No restaurants to show yet.</p>
                    </div>
                  ) : sortedMenuFeedBlocks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                      <Store className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.25} />
                      <p className="mt-3 text-sm font-medium text-foreground">
                        Could not load menu previews.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Refresh the page or try again later.</p>
                    </div>
                  ) : (
                    <AllRestaurantsMenuFeed blocks={sortedMenuFeedBlocks} query={searchQuery} />
                  )}
                </section>
              </div>
            )}

            {/* Promo banner — guest acquisition vs signed-in (avoid “create account” for logged-in users) */}
            <section className="py-8 md:py-10">
              {sessionUser ? (
                <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground shadow-lg ring-2 ring-brand-yellow/50 md:flex-row md:items-center md:p-10">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                      Welcome back
                      {sessionUser.name
                        ? `, ${sessionUser.name.trim().split(/\s+/)[0]}`
                        : ""}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-primary-foreground/85 md:text-base">
                      {sessionUser.role === "restaurant_owner"
                        ? "Manage your restaurant, menus, and store profile from the partner portal."
                        : sessionUser.role === "admin"
                          ? "Open the administrator dashboard to manage the platform."
                          : "Your member offers and vouchers live on your account page."}
                    </p>
                  </div>
                  <Link
                    href={
                      sessionUser.role === "restaurant_owner"
                        ? "/partner/dashboard"
                        : sessionUser.role === "admin"
                          ? "/dashboard"
                          : "/account#offers"
                    }
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "h-11 rounded-full border-0 bg-brand-yellow px-8 font-bold text-brand-yellow-foreground shadow-md hover:brightness-95"
                    )}
                  >
                    {sessionUser.role === "restaurant_owner"
                      ? "Partner dashboard"
                      : sessionUser.role === "admin"
                        ? "Admin dashboard"
                        : "View offers"}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground shadow-lg ring-2 ring-brand-yellow/50 md:flex-row md:items-center md:p-10">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                      Order faster with your account
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-primary-foreground/85 md:text-base">
                      Create an account or download the app to unlock deals, saved addresses, and faster checkout.
                    </p>
                  </div>
                  <Link href="/login">
                    <Button
                      size="lg"
                      className="h-11 rounded-full border-0 bg-brand-yellow px-8 font-bold text-brand-yellow-foreground shadow-md hover:brightness-95"
                    >
                      Get started
                    </Button>
                  </Link>
                </div>
              )}
            </section>

            {/* Why TKimph */}
            <section className="py-8 md:py-12">
              <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Why order with TKimph?
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm transition hover:border-primary/20 hover:shadow-md"
                  >
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                      <feature.icon className="size-6 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
