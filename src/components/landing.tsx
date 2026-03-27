"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Search,
  MapPin,
  ShoppingBag,
  Globe,
  ChevronDown,
  Bike,
  Store,
  ShoppingBasket,
  X,
  Heart,
  User,
  Ticket,
  HelpCircle,
  LogOut,
  ClipboardList,
  Award,
  Wallet,
  Crosshair,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { useCart } from "@/contexts/cart-context";
import { AUTH_CHANGED_EVENT, getStoredUser, logout, notifyAuthChanged, type AuthUser } from "@/lib/auth";
import { fetchCustomerOrders, fetchCustomerProfile, updateCustomerProfile } from "@/lib/customer-api";
import {
  fetchPublicCuisines,
  fetchPublicRestaurants,
  fetchPublicRestaurantsMenuFeed,
  type RestaurantWithMenusFeed,
} from "@/lib/public-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";

type HeaderSavedLocation = {
  id: string;
  address: string;
  cityLine: string;
  floor: string;
  note: string;
  label: "home" | "work" | "partner" | "other";
  lat: number | null;
  lon: number | null;
};

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type SearchPanelTab = "all" | "delivery" | "pickup" | "shops";

type SearchSuggestion = {
  id: string;
  label: string;
  subtitle: string;
  kind: "restaurant" | "dish" | "cuisine";
  value: string;
};

const DEFAULT_POPULAR_SEARCHES = [
  "pizza",
  "burger",
  "milk tea",
  "fried rice",
  "kfc",
  "cake",
  "lugaw",
];

type SearchPopularityData = {
  global: Record<string, number>;
  contexts: Record<string, Record<string, number>>;
};

const SEARCH_POPULARITY_KEY = "tkimph:search-popularity:v1";

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadSearchPopularity(): SearchPopularityData {
  if (typeof window === "undefined") {
    return { global: {}, contexts: {} };
  }
  try {
    const raw = localStorage.getItem(SEARCH_POPULARITY_KEY);
    if (!raw) return { global: {}, contexts: {} };
    const parsed = JSON.parse(raw) as SearchPopularityData;
    return {
      global: parsed.global ?? {},
      contexts: parsed.contexts ?? {},
    };
  } catch {
    return { global: {}, contexts: {} };
  }
}

function saveSearchPopularity(data: SearchPopularityData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEARCH_POPULARITY_KEY, JSON.stringify(data));
}

function parseRestaurantContext(pathname: string): string | null {
  if (!pathname.startsWith("/restaurant/")) return null;
  const segment = pathname.split("/")[2];
  if (!segment) return null;
  return `restaurant:${decodeURIComponent(segment).toLowerCase()}`;
}

function incrementSearchPopularity(
  current: SearchPopularityData,
  term: string,
  contexts: string[]
): SearchPopularityData {
  const normalized = normalizeTerm(term);
  if (!normalized) return current;

  const next: SearchPopularityData = {
    global: { ...current.global },
    contexts: { ...current.contexts },
  };

  next.global[normalized] = (next.global[normalized] ?? 0) + 1;

  for (const context of contexts) {
    if (!context) continue;
    const bucket = { ...(next.contexts[context] ?? {}) };
    bucket[normalized] = (bucket[normalized] ?? 0) + 1;
    next.contexts[context] = bucket;
  }

  return next;
}

function headerAddressKey(userId: number | null): string {
  return userId != null ? `tkimph:header-address:${userId}` : "tkimph:header-address:guest";
}

function checkoutLocationKey(userId: number | null): string {
  return userId != null ? `tkimph:checkout-locations:${userId}` : "tkimph:checkout-locations:guest";
}

function parseSavedLocations(raw: string | null): HeaderSavedLocation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HeaderSavedLocation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cityLineFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "Saved location";
}

function shortAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return "Select your address";
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function updateCheckoutPrimaryLocation(userId: number | null, address: string) {
  if (typeof window === "undefined") return;
  const nextAddress = address.trim();
  if (!nextAddress) return;

  const key = checkoutLocationKey(userId);
  const existing = parseSavedLocations(localStorage.getItem(key));
  const primaryId = userId != null ? `primary-${userId}` : "primary-guest";
  const primary: HeaderSavedLocation = {
    id: primaryId,
    address: nextAddress,
    cityLine: cityLineFromAddress(nextAddress),
    floor: "",
    note: "",
    label: "home",
    lat: null,
    lon: null,
  };

  const withoutPrimary = existing.filter((loc) => loc.id !== primaryId);
  localStorage.setItem(key, JSON.stringify([primary, ...withoutPrimary]));
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Could not convert your location to an address.");

  const data = (await res.json()) as ReverseGeocodeResponse;
  const a = data.address;
  const concise = [
    a?.road,
    a?.neighbourhood ?? a?.suburb,
    a?.city ?? a?.town ?? a?.municipality,
    a?.state,
    a?.postcode,
    a?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return concise || data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export function TopBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide sm:gap-4 sm:text-xs">
        <Link
          href="/partner/register"
          className="rounded-full border border-white/35 px-3 py-1.5 transition hover:bg-white/10 sm:px-4"
        >
          Sign up to be a restaurant partner
        </Link>
        <Link
          href="/partner/business-account"
          className="rounded-full border border-white/35 px-3 py-1.5 transition hover:bg-white/10 sm:px-4"
        >
          Sign up for a business account
        </Link>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-secondary-foreground/80 transition hover:bg-white/10 hover:text-secondary-foreground sm:right-4"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

const serviceTabs = [
  { label: "Delivery", icon: Bike },
  { label: "Pick-up", icon: Store },
  { label: "Mart", icon: ShoppingBasket },
  { label: "Shops", icon: Store },
];

export function Navbar() {
  return (
    <Suspense>
      <NavbarInner />
    </Suspense>
  );
}

function NavbarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { cartCount, setDrawerOpen } = useCart();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [orderUpdateCount, setOrderUpdateCount] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [headerAddress, setHeaderAddress] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [addressSyncing, setAddressSyncing] = useState(false);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [setAsPrimary, setSetAsPrimary] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState<SearchPanelTab>("all");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchPopularity, setSearchPopularity] = useState<SearchPopularityData>({ global: {}, contexts: {} });

  function statusSnapshotKey(id: number): string {
    return `tkimph:orders:status-snapshot:${id}`;
  }

  function unreadUpdatesKey(id: number): string {
    return `tkimph:orders:unread-updates:${id}`;
  }

  const activeServiceLabel =
    pathname === "/mart"
      ? "Mart"
      : pathname === "/shops"
        ? "Shops"
        : searchParams.get("expedition") === "pickup"
          ? "Pick-up"
          : "Delivery";

  const filteredSuggestions = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    const base =
      searchTab === "shops"
        ? []
        : searchSuggestions;

    if (!q) {
      return base.slice(0, 10);
    }

    return base
      .filter((s) => normalizeSearchText(`${s.label} ${s.subtitle} ${s.value}`).includes(q))
      .slice(0, 12);
  }, [searchQuery, searchSuggestions, searchTab]);

  const restaurantSearchContext = useMemo(() => parseRestaurantContext(pathname), [pathname]);

  const popularSearches = useMemo(() => {
    const contextKeys = [
      restaurantSearchContext,
      searchTab ? `tab:${searchTab}` : null,
      activeServiceLabel === "Pick-up" ? "tab:pickup" : "tab:delivery",
    ].filter((v): v is string => Boolean(v));

    const aggregate = new Map<string, number>();

    for (const key of contextKeys) {
      const bucket = searchPopularity.contexts[key] ?? {};
      for (const [term, count] of Object.entries(bucket)) {
        aggregate.set(term, (aggregate.get(term) ?? 0) + count * 2);
      }
    }

    for (const [term, count] of Object.entries(searchPopularity.global)) {
      aggregate.set(term, (aggregate.get(term) ?? 0) + count);
    }

    const ranked = Array.from(aggregate.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .filter(Boolean);

    const fallback = DEFAULT_POPULAR_SEARCHES.filter((term) => !ranked.includes(term));
    return [...ranked, ...fallback].slice(0, 12);
  }, [searchPopularity, searchTab, activeServiceLabel, restaurantSearchContext]);

  useEffect(() => {
    setMounted(true);
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setSearchPopularity(loadSearchPopularity());
  }, [mounted]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery(searchParams.get("q")?.trim() ?? "");
    }
  }, [searchParams, searchOpen]);

  useEffect(() => {
    if (activeServiceLabel === "Pick-up") setSearchTab("pickup");
    else if (activeServiceLabel === "Shops") setSearchTab("shops");
    else setSearchTab("all");
  }, [activeServiceLabel]);

  useEffect(() => {
    if (!mounted) return;
    const userId = user?.id ?? null;
    const fromStorage = localStorage.getItem(headerAddressKey(userId));
    const fromUser = user?.address?.trim() ?? "";
    const resolved = (fromStorage?.trim() || fromUser || "").trim();
    setHeaderAddress(resolved);
    setAddressInput(resolved);
  }, [mounted, user?.id, user?.address]);

  useEffect(() => {
    if (!mounted || !user || user.role !== "customer") {
      setOrderUpdateCount(0);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    const updateCountFromStorage = () => {
      try {
        const raw = localStorage.getItem(unreadUpdatesKey(userId));
        const parsed = raw ? (JSON.parse(raw) as number[]) : [];
        setOrderUpdateCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        setOrderUpdateCount(0);
      }
    };

    const pullOrderUpdates = async () => {
      try {
        const res = await fetchCustomerOrders(20);
        if (cancelled) return;

        let previousSnapshot: Record<string, string> = {};
        let unreadSet = new Set<number>();

        try {
          const rawSnapshot = localStorage.getItem(statusSnapshotKey(userId));
          if (rawSnapshot) previousSnapshot = JSON.parse(rawSnapshot) as Record<string, string>;
        } catch {
          previousSnapshot = {};
        }

        try {
          const rawUnread = localStorage.getItem(unreadUpdatesKey(userId));
          if (rawUnread) {
            const parsed = JSON.parse(rawUnread) as number[];
            unreadSet = new Set(Array.isArray(parsed) ? parsed : []);
          }
        } catch {
          unreadSet = new Set<number>();
        }

        const nextSnapshot: Record<string, string> = {};
        for (const order of res.data) {
          const id = String(order.id);
          nextSnapshot[id] = order.status;
          if (previousSnapshot[id] && previousSnapshot[id] !== order.status) {
            unreadSet.add(order.id);
          }
        }

        const nextUnread = Array.from(unreadSet).filter((id) => nextSnapshot[String(id)]);
        localStorage.setItem(statusSnapshotKey(userId), JSON.stringify(nextSnapshot));
        localStorage.setItem(unreadUpdatesKey(userId), JSON.stringify(nextUnread));
        setOrderUpdateCount(nextUnread.length);
      } catch {
        updateCountFromStorage();
      }
    };

    updateCountFromStorage();
    void pullOrderUpdates();

    const interval = window.setInterval(() => {
      void pullOrderUpdates();
    }, 10000);

    const refreshFromStorage = () => updateCountFromStorage();
    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener("tkimph:orders-unread-cleared", refreshFromStorage);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener("tkimph:orders-unread-cleared", refreshFromStorage);
    };
  }, [mounted, user]);

  function handleOpenOrders() {
    if (user?.role === "customer") {
      localStorage.setItem(unreadUpdatesKey(user.id), JSON.stringify([]));
      setOrderUpdateCount(0);
      window.dispatchEvent(new Event("tkimph:orders-unread-cleared"));
    }
    router.push("/orders");
  }

  function handleServiceTabClick(label: string) {
    if (label === "Mart") {
      router.push("/mart");
      return;
    }
    if (label === "Shops") {
      router.push("/shops");
      return;
    }

    const expedition = label === "Pick-up" ? "pickup" : "delivery";
    if (typeof window !== "undefined") {
      localStorage.setItem("tkimph:expedition", expedition);
    }
    router.push(`/?expedition=${expedition}`);
  }

  async function hydrateSearchCatalog() {
    if (searchLoaded || searchLoading) return;

    setSearchLoading(true);
    setSearchError(null);
    try {
      const [restaurantsRes, cuisinesRes, feedRes] = await Promise.all([
        fetchPublicRestaurants({ limit: 80 }),
        fetchPublicCuisines(),
        fetchPublicRestaurantsMenuFeed({ limit: 40 }),
      ]);

      const collected: SearchSuggestion[] = [];

      for (const r of restaurantsRes.data) {
        collected.push({
          id: `restaurant-${r.id}`,
          label: r.name,
          subtitle: `${r.cuisine?.name ?? "Restaurant"} · ${r.delivery_min_minutes ?? 20}-${
            r.delivery_max_minutes ?? 40
          } min`,
          kind: "restaurant",
          value: r.name,
        });
      }

      for (const c of cuisinesRes.data) {
        collected.push({
          id: `cuisine-${c.id}`,
          label: c.name,
          subtitle: "Cuisine",
          kind: "cuisine",
          value: c.name,
        });
      }

      const seenDish = new Set<string>();
      for (const block of feedRes.data as RestaurantWithMenusFeed[]) {
        for (const menu of block.menus) {
          for (const item of menu.items) {
            const dishKey = normalizeSearchText(item.name);
            if (seenDish.has(dishKey)) continue;
            seenDish.add(dishKey);
            collected.push({
              id: `dish-${block.restaurant.id}-${item.id}`,
              label: item.name,
              subtitle: `${block.restaurant.name} · ${menu.menu.name}`,
              kind: "dish",
              value: item.name,
            });
          }
        }
      }

      setSearchSuggestions(collected);
      setSearchLoaded(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Could not load search options.");
    } finally {
      setSearchLoading(false);
    }
  }

  function executeSearch(rawValue: string) {
    const q = rawValue.trim();
    if (!q) return;

    const nextPopularity = incrementSearchPopularity(searchPopularity, q, [
      searchTab ? `tab:${searchTab}` : "",
      activeServiceLabel === "Pick-up" ? "tab:pickup" : "tab:delivery",
      restaurantSearchContext ?? "",
    ]);
    setSearchPopularity(nextPopularity);
    saveSearchPopularity(nextPopularity);

    const params = new URLSearchParams();
    params.set("q", q);

    if (searchTab === "pickup") params.set("expedition", "pickup");
    if (searchTab === "delivery") params.set("expedition", "delivery");
    if (searchTab === "all" && activeServiceLabel === "Pick-up") params.set("expedition", "pickup");

    if (searchTab === "shops") {
      router.push(`/shops?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/?${params.toString()}`);
    }
    setSearchOpen(false);
  }

  async function handleLocateAddress() {
    setAddressMessage(null);
    setLocatingAddress(true);
    try {
      const pos = await getCurrentPosition();
      const next = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setAddressInput(next);
    } catch (err) {
      setAddressMessage(err instanceof Error ? err.message : "Could not get your location.");
    } finally {
      setLocatingAddress(false);
    }
  }

  async function handleSaveAddress() {
    const nextAddress = addressInput.trim();
    if (!nextAddress) {
      setAddressMessage("Please enter your address.");
      return;
    }

    setAddressMessage(null);
    setAddressSyncing(true);
    try {
      const userId = user?.id ?? null;
      localStorage.setItem(headerAddressKey(userId), nextAddress);
      updateCheckoutPrimaryLocation(userId, nextAddress);
      setHeaderAddress(nextAddress);

      if (user?.role === "customer" && setAsPrimary) {
        const profile = await fetchCustomerProfile();
        const res = await updateCustomerProfile({
          name: profile.name,
          email: profile.email,
          phone: profile.phone ?? "",
          address: nextAddress,
        });
        const stored = getStoredUser();
        if (stored) {
          localStorage.setItem("user", JSON.stringify({ ...stored, address: res.user.address }));
          notifyAuthChanged();
        }
      }

      setAddressModalOpen(false);
    } catch (err) {
      setAddressMessage(err instanceof Error ? err.message : "Could not save address.");
    } finally {
      setAddressSyncing(false);
    }
  }

  async function confirmLogout() {
    setLogoutPending(true);
    try {
      await logout();
      setUser(null);
      setLogoutDialogOpen(false);
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white shadow-[0_1px_0_oklch(0.48_0.16_145/0.07)]">
      {/* Row 1 */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/tkimlogo.png"
              alt="TKimph"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span className="hidden text-xl font-bold tracking-tight text-primary sm:inline">
              tkimph
            </span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setAddressMessage(null);
              setAddressInput(headerAddress);
              setAddressModalOpen(true);
            }}
            className="hidden min-w-0 max-w-[min(100%,280px)] items-center gap-2 text-left text-sm transition hover:opacity-90 md:flex lg:max-w-sm"
          >
            <MapPin className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              <span className="block text-muted-foreground">
                {headerAddress ? `New address ${shortAddress(headerAddress)}` : "New address"}
              </span>
              <span className="flex items-center gap-0.5 font-semibold text-foreground">
                {headerAddress ? "Change address" : "Select your address"}
                <ChevronDown className="size-4 text-muted-foreground" />
              </span>
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {mounted ? (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex max-w-[min(140px,42vw)] items-center gap-1.5 rounded-full border border-border px-2 py-1.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted">
                  <User className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{user.name.split(" ")[0] ?? user.name}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push("/checkout")}>
                    <Wallet className="size-4 text-primary" />
                    <span>TKimph wallet</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push("/checkout")}>
                    <Award className="size-4 text-primary" />
                    <span>TKimph rewards</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex cursor-pointer items-center justify-between gap-2" onClick={handleOpenOrders}>
                    <span className="flex items-center gap-2">
                      <ClipboardList className="size-4" />
                      <span>Orders</span>
                    </span>
                    {orderUpdateCount > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1.5 text-[10px] font-bold text-brand-yellow-foreground">
                        {orderUpdateCount > 99 ? "99+" : orderUpdateCount}
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push("/account")}>
                    <User className="size-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer bg-primary/8 focus:bg-primary/12"
                    onClick={() => router.push("/account#offers")}
                  >
                    <Ticket className="size-4 text-primary" />
                    <span>Vouchers & offers</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer">
                    <HelpCircle className="size-4" />
                    <span>Help center</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive"
                    onClick={() => setLogoutDialogOpen(true)}
                  >
                    <LogOut className="size-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-primary/25 font-semibold text-primary hover:bg-primary/5"
                  >
                    Log in
                  </Button>
                </Link>
                <Link href="/login" className="hidden sm:block">
                  <Button
                    size="sm"
                    className="rounded-full border-0 bg-brand-yellow px-3 font-semibold text-brand-yellow-foreground shadow-sm hover:brightness-95 sm:px-4"
                  >
                    Sign up
                  </Button>
                </Link>
              </>
            )
          ) : null}
          <button
            type="button"
            className="hidden rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-primary lg:flex"
            aria-label="Favorites"
          >
            <Heart className="size-5" />
          </button>
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted lg:flex"
          >
            <Globe className="size-4 text-muted-foreground" />
            EN
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {mounted && !user ? (
            <Link href="/login" className="sm:hidden">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-primary/25 px-2.5 font-semibold text-primary hover:bg-primary/5"
              >
                Log in
              </Button>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
          >
            <ShoppingBag className="size-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Row 2: tabs + search */}
      <div className="border-t border-border/60 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <nav className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {serviceTabs.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleServiceTabClick(item.label)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                  activeServiceLabel === item.label
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="size-4 opacity-80" />
                {item.label}
              </button>
            ))}
          </nav>
            <div className="relative w-full min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearch(searchQuery);
                }}
                className={`flex w-full min-w-0 items-center gap-3 rounded-full border px-4 py-2.5 shadow-inner transition ${
                  searchOpen
                    ? "border-primary/50 bg-white ring-2 ring-primary/20"
                    : "border-border bg-muted/80 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15"
                }`}
              >
                <Search className={`size-5 shrink-0 transition ${searchOpen ? "text-primary" : "text-muted-foreground"}`} />
                <input
                  type="search"
                  value={searchQuery}
                  onFocus={() => {
                    setSearchOpen(true);
                    void hydrateSearchCatalog();
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="Search for restaurants, cuisines, and dishes"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </form>

              <div
                className={`absolute left-0 top-[calc(100%+10px)] z-[65] w-full origin-top overflow-hidden rounded-2xl border border-border bg-white shadow-2xl transition duration-200 ${
                  searchOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-1 scale-[0.99] opacity-0"
                }`}
              >
                <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-sm">
                  {[
                    { id: "all", label: "All" },
                    { id: "delivery", label: "Delivery" },
                    { id: "pickup", label: "Pick-up" },
                    { id: "shops", label: "Shops" },
                  ].map((tab) => {
                    const active = searchTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSearchTab(tab.id as SearchPanelTab)}
                        className={`rounded-lg px-3 py-2 font-semibold transition ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

	                <div className="max-h-[58vh] overflow-y-auto p-4">
	                  <p className="text-sm font-semibold text-foreground">Popular searches</p>
	                  <div className="mt-3 flex flex-wrap gap-2">
	                    {popularSearches.map((chip) => (
	                      <button
	                        key={chip}
	                        type="button"
	                        onClick={() => executeSearch(chip)}
	                        className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-primary/35 hover:bg-primary/5"
	                      >
	                        {chip}
	                      </button>
	                    ))}
	                  </div>

                  <div className="mt-5 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Suggestions</p>
                    {searchLoading ? (
                      <p className="text-sm text-muted-foreground">Loading suggestions...</p>
                    ) : searchError ? (
                      <p className="text-sm text-destructive">{searchError}</p>
                    ) : filteredSuggestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {searchTab === "shops"
                          ? "Shop search will appear here soon."
                          : "No suggestions found. Try another keyword."}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => executeSearch(suggestion.value)}
                            className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {suggestion.label}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {suggestion.subtitle}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {suggestion.kind}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
	        </div>
	      </div>
	    </header>
      {searchOpen ? (
        <button
          type="button"
          aria-label="Close search overlay"
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-40 bg-black/45"
        />
      ) : null}
	    <LogoutConfirmDialog
      open={logoutDialogOpen}
      onOpenChange={setLogoutDialogOpen}
      onConfirm={confirmLogout}
      pending={logoutPending}
    />
    {addressModalOpen ? (
      <div className="fixed inset-0 z-[70] bg-black/20 px-4 pt-20" onClick={() => setAddressModalOpen(false)}>
        <div
          className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-white p-4 shadow-xl sm:p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-2 text-foreground">
            <MapPin className="size-5 text-primary" />
            <p className="truncate text-2x1 font-semibold">
              {headerAddress ? `New address ${headerAddress}` : "Set your delivery address"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-14 flex-1 items-center gap-2 rounded-xl border border-border px-3">
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Street, Postal Code"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              {addressInput ? (
                <button
                  type="button"
                  onClick={() => setAddressInput("")}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Clear address"
                >
                  <XCircle className="size-5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLocateAddress}
                disabled={locatingAddress}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/8 disabled:opacity-60"
              >
                <Crosshair className="size-4" />
                {locatingAddress ? "Locating..." : "Locate me"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveAddress}
              disabled={addressSyncing}
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              aria-label="Save address"
            >
              <ArrowRight className="size-6" />
            </button>
          </div>

          {user?.role === "customer" ? (
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={setAsPrimary}
                onChange={(e) => setSetAsPrimary(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Set this as my primary location
            </label>
          ) : null}

          {addressMessage ? (
            <p className="mt-2 text-sm text-destructive">{addressMessage}</p>
          ) : null}
        </div>
      </div>
    ) : null}
    </>
  );
}

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <Image
                src="/tkimlogo.png"
                alt="TKimph"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold">tkimph</span>
            </div>
            <p className="text-sm text-secondary-foreground/75">
              Your favorite food, delivered fast to your door.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  About us
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Contact
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Help center
                </Link>
              </li>
              <li>
                <Link href="/partner/register" className="transition hover:text-secondary-foreground">
                  Partner with us
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-secondary-foreground">
                  Partner sign in
                </Link>
              </li>
              <li>
                <Link href="/rider/register" className="transition hover:text-secondary-foreground">
                  Ride with us
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row">
          <p className="text-sm text-secondary-foreground/60">
            &copy; {new Date().getFullYear()} TKimph. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs text-secondary-foreground/50">Available on</span>
            <span className="rounded-full border border-white/25 px-3 py-1 text-sm font-medium">
              App Store
            </span>
            <span className="rounded-full border border-white/25 px-3 py-1 text-sm font-medium">
              Play Store
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
