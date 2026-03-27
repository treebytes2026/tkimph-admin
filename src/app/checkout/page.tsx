"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import {
  Briefcase,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  Home,
  HandCoins,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Smartphone,
  ShoppingBag,
  Trash2,
  CreditCard,
} from "lucide-react";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import { CheckoutAuthPanel } from "@/components/checkout/checkout-auth-panel";
import { useCart } from "@/contexts/cart-context";
import { publicFileUrl } from "@/lib/public-api";
import { AUTH_CHANGED_EVENT, getStoredUser, notifyAuthChanged, type AuthUser } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fetchCustomerProfile,
  placeCustomerOrder,
  updateCustomerProfile,
  validateCustomerPromotion,
} from "@/lib/customer-api";

function formatPhpSpaced(amount: number): string {
  if (Number.isNaN(amount)) return "₱ 0";
  const s = amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `₱ ${s}`;
}

const SERVICE_FEE_PHP = 5;
const DELIVERY_STRIKE_PHP = 19;

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

type GeocodeResult = {
  lat: string;
  lon: string;
};

type MapCoords = {
  lat: number;
  lon: number;
};

type SavedLocation = {
  id: string;
  address: string;
  cityLine: string;
  floor: string;
  note: string;
  label: "home" | "work" | "partner" | "other";
  lat: number | null;
  lon: number | null;
};

type EditingLocation = {
  id: string | null;
  address: string;
  floor: string;
  note: string;
  label: "home" | "work" | "partner" | "other";
  lat: number | null;
  lon: number | null;
};

const LABEL_OPTIONS = [
  { value: "home", label: "Home", icon: Home },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "partner", label: "Partner", icon: Heart },
  { value: "other", label: "Other", icon: Plus },
] as const;

function locationStorageKey(userId: number | null | undefined): string {
  return userId != null ? `tkimph:checkout-locations:${userId}` : "tkimph:checkout-locations:guest";
}

function cityLineFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : "Saved location";
}

function createLocation(input: Partial<SavedLocation> & { address: string }): SavedLocation {
  return {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    address: input.address.trim(),
    cityLine: input.cityLine?.trim() || cityLineFromAddress(input.address),
    floor: input.floor?.trim() || "",
    note: input.note?.trim() || "",
    label: input.label ?? "home",
    lat: input.lat ?? null,
    lon: input.lon ?? null,
  };
}

function loadSavedLocations(userId: number | null | undefined): SavedLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(locationStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLocation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSavedLocations(userId: number | null | undefined, locations: SavedLocation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(locationStorageKey(userId), JSON.stringify(locations));
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

async function geocodeAddress(query: string): Promise<MapCoords | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Could not find that address on the map.");

  const data = (await res.json()) as GeocodeResult[];
  if (!data[0]) return null;

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
  };
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

function buildMapEmbedUrl(coords: MapCoords): string {
  const delta = 0.0038;
  const left = coords.lon - delta;
  const right = coords.lon + delta;
  const top = coords.lat + delta;
  const bottom = coords.lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${coords.lat}%2C${coords.lon}`;
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, cartRestaurant, cartTotal, cartCount, clearCart } = useCart();
  const [user, setUser] = useState<AuthUser | null>(null);
  const userId = user?.id ?? null;
  const mounted = useIsClient();
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet" | "card">("cod");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount_amount: number } | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [pickupOption, setPickupOption] = useState<"standard" | "scheduled">("standard");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [mapCoords, setMapCoords] = useState<MapCoords | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<EditingLocation>({
    id: null,
    address: "",
    floor: "",
    note: "",
    label: "home",
    lat: null,
    lon: null,
  });
  const editorAddressRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("expedition");
    if (fromQuery === "pickup" || fromQuery === "delivery") {
      setDeliveryMode(fromQuery);
      if (typeof window !== "undefined") {
        localStorage.setItem("tkimph:expedition", fromQuery);
      }
      return;
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tkimph:expedition");
      if (stored === "pickup" || stored === "delivery") {
        setDeliveryMode(stored);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    setDeliveryAddress(user?.address ?? "");
  }, [user?.address]);

  useEffect(() => {
    const locations = loadSavedLocations(userId);
    if (locations.length > 0) {
      setSavedLocations(locations);
      setSelectedLocationId((current) => current ?? locations[0].id);
      return;
    }

    const baseAddress = user?.address?.trim();
    if (baseAddress) {
      const initial = createLocation({
        address: baseAddress,
        label: "home",
      });
      setSavedLocations([initial]);
      setSelectedLocationId(initial.id);
      saveSavedLocations(userId, [initial]);
    } else {
      setSavedLocations([]);
      setSelectedLocationId(null);
    }
  }, [userId, user?.address]);

  useEffect(() => {
    const address = deliveryAddress.trim();
    if (!address) {
      setMapCoords(null);
      setMapLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setMapLoading(true);
      try {
        const coords = await geocodeAddress(address);
        if (!cancelled) {
          setMapCoords(coords);
        }
      } catch {
        if (!cancelled) {
          setMapCoords(null);
        }
      } finally {
        if (!cancelled) {
          setMapLoading(false);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deliveryAddress]);

  useEffect(() => {
    if (!editorOpen) return;

    const address = editingLocation.address.trim();
    if (!address) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setMapLoading(true);
      try {
        const coords = await geocodeAddress(address);
        if (!cancelled && coords) {
          setMapCoords(coords);
          setEditingLocation((current) => ({ ...current, lat: coords.lat, lon: coords.lon }));
        }
      } catch {
        if (!cancelled) {
          setEditingLocation((current) => ({ ...current, lat: null, lon: null }));
        }
      } finally {
        if (!cancelled) {
          setMapLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editorOpen, editingLocation.address]);

  const grandTotal = useMemo(() => Math.max(0, cartTotal + SERVICE_FEE_PHP - (promoApplied?.discount_amount ?? 0)), [cartTotal, promoApplied?.discount_amount]);
  const strikeTotal = useMemo(() => grandTotal + DELIVERY_STRIKE_PHP, [grandTotal]);

  const dMin = cartRestaurant?.delivery_min_minutes ?? 5;
  const dMax = cartRestaurant?.delivery_max_minutes ?? 20;
  const selectedLocation = savedLocations.find((location) => location.id === selectedLocationId) ?? null;

  const hasDeliveryAddress = deliveryAddress.trim().length > 0;
  const pickupScheduleValid =
    pickupOption === "standard" || (pickupDate.trim().length > 0 && pickupTime.trim().length > 0);
  const canPlaceOrder =
    !placingOrder && (deliveryMode === "delivery" ? hasDeliveryAddress : pickupScheduleValid);
  const todayIso = new Date().toISOString().slice(0, 10);
  const editorMapEmbedUrl = mapCoords
    ? buildMapEmbedUrl(mapCoords)
    : null;

  useEffect(() => {
    if (!selectedLocation) return;
    setDeliveryAddress(selectedLocation.address);
    setDeliveryNote(selectedLocation.note);
    if (selectedLocation.lat != null && selectedLocation.lon != null) {
      setMapCoords({ lat: selectedLocation.lat, lon: selectedLocation.lon });
    }
  }, [selectedLocationId, selectedLocation]);

  function openAddLocationEditor() {
    setEditingLocation({
      id: null,
      address: deliveryAddress,
      floor: "",
      note: deliveryNote,
      label: "other",
      lat: mapCoords?.lat ?? null,
      lon: mapCoords?.lon ?? null,
    });
    setEditorOpen(true);
  }

  function openEditLocationEditor(location: SavedLocation) {
    setEditingLocation({
      id: location.id,
      address: location.address,
      floor: location.floor,
      note: location.note,
      label: location.label,
      lat: location.lat,
      lon: location.lon,
    });
    if (location.lat != null && location.lon != null) {
      setMapCoords({ lat: location.lat, lon: location.lon });
    }
    setEditorOpen(true);
  }

  function handleDeleteLocation(locationId: string) {
    const next = savedLocations.filter((location) => location.id !== locationId);
    setSavedLocations(next);
    saveSavedLocations(userId, next);
    if (selectedLocationId === locationId) {
      const fallback = next[0] ?? null;
      setSelectedLocationId(fallback?.id ?? null);
      setDeliveryAddress(fallback?.address ?? "");
      setDeliveryNote(fallback?.note ?? "");
      if (fallback?.lat != null && fallback?.lon != null) {
        setMapCoords({ lat: fallback.lat, lon: fallback.lon });
      } else {
        setMapCoords(null);
      }
    }
  }

  async function handleSubmitLocationEditor() {
    const address = editingLocation.address.trim();
    if (!address) {
      setAddressMessage("Please enter a delivery address before saving.");
      return;
    }

    let coords = editingLocation.lat != null && editingLocation.lon != null
      ? { lat: editingLocation.lat, lon: editingLocation.lon }
      : null;

    if (!coords) {
      try {
        coords = await geocodeAddress(address);
      } catch {
        coords = null;
      }
    }

    const nextLocation = createLocation({
      id: editingLocation.id ?? undefined,
      address,
      floor: editingLocation.floor,
      note: editingLocation.note,
      label: editingLocation.label,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
    });

    const nextLocations = editingLocation.id
      ? savedLocations.map((location) => (location.id === editingLocation.id ? nextLocation : location))
      : [nextLocation, ...savedLocations];

    setSavedLocations(nextLocations);
    saveSavedLocations(userId, nextLocations);
    setSelectedLocationId(nextLocation.id);
    setDeliveryAddress(nextLocation.address);
    setDeliveryNote(nextLocation.note);
    if (nextLocation.lat != null && nextLocation.lon != null) {
      setMapCoords({ lat: nextLocation.lat, lon: nextLocation.lon });
    }
    setEditorOpen(false);
  }

  async function handleLocateMe() {
    setAddressMessage(null);
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setMapCoords(coords);
      const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      setDeliveryAddress(address);
      setEditingLocation((current) => ({ ...current, address, lat: coords.lat, lon: coords.lon }));
      setAddressMessage("Location detected. Please review your address details before placing order.");
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setAddressMessage("Location permission denied. Please allow location access and try again.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setAddressMessage("Unable to detect your location right now.");
        } else if (err.code === err.TIMEOUT) {
          setAddressMessage("Location request timed out. Please try again.");
        } else {
          setAddressMessage("Could not get your location.");
        }
      } else {
        setAddressMessage(err instanceof Error ? err.message : "Could not get your location.");
      }
    } finally {
      setLocating(false);
    }
  }

  async function handleSaveAddressToProfile() {
    if (!user) return;
    setAddressMessage(null);

    const address = (editorOpen ? editingLocation.address : deliveryAddress).trim();
    if (!address) {
      setAddressMessage("Please enter a delivery address first.");
      return;
    }

    setSavingAddress(true);
    try {
      const profile = await fetchCustomerProfile();
      if (!profile.phone?.trim()) {
        setAddressMessage("Please set your phone number in your account page before saving address.");
        return;
      }

      const res = await updateCustomerProfile({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address,
      });

      const existing = getStoredUser();
      if (existing) {
        localStorage.setItem("user", JSON.stringify({ ...existing, address: res.user.address }));
        notifyAuthChanged();
      }

      setAddressMessage("Delivery address saved to your account.");
    } catch (err) {
      setAddressMessage(err instanceof Error ? err.message : "Could not save delivery address.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handlePlaceOrder() {
    if (!user) {
      setOrderMessage("Please sign in to place your order.");
      return;
    }
    if (!cartRestaurant) {
      setOrderMessage("Please add items from a restaurant before checkout.");
      return;
    }
    if (deliveryMode === "delivery" && !deliveryAddress.trim()) {
      setOrderMessage("Please select a delivery address first.");
      return;
    }
    if (deliveryMode === "pickup" && !pickupScheduleValid) {
      setOrderMessage("Please select your pick-up date and time.");
      return;
    }

    setOrderMessage(null);
    setPlacingOrder(true);
    try {
      const payload = {
        restaurant_id: cartRestaurant.id,
        delivery_mode: deliveryMode,
        payment_method: paymentMethod,
        promo_code: promoApplied?.code ?? null,
        delivery_address:
          deliveryMode === "pickup"
            ? cartRestaurant.address?.trim() || "Pick-up at restaurant"
            : deliveryAddress.trim(),
        delivery_floor: deliveryMode === "delivery" ? selectedLocation?.floor?.trim() || null : null,
        delivery_note:
          deliveryMode === "delivery"
            ? deliveryNote.trim() || null
            : pickupOption === "scheduled"
              ? `Scheduled pick-up: ${pickupDate} ${pickupTime}`
              : "Standard pick-up",
        location_label: deliveryMode === "delivery" ? selectedLocation?.label ?? null : "pickup",
        items: cart.map((line) => ({ item_id: line.item.id, qty: line.qty })),
      };
      const res = await placeCustomerOrder(payload);
      clearCart();
      setOrderMessage(`${res.message} Order #${res.order.order_number}`);
      router.push("/orders");
    } catch (err) {
      setOrderMessage(err instanceof Error ? err.message : "Could not place your order.");
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleApplyPromo() {
    const code = promoCode.trim();
    if (!code) {
      setPromoMessage("Enter a promo code first.");
      setPromoApplied(null);
      return;
    }

    setPromoLoading(true);
    setPromoMessage(null);
    try {
      const res = await validateCustomerPromotion({
        code,
        subtotal: cartTotal,
        restaurant_id: cartRestaurant?.id,
      });
      if (!res.valid) {
        setPromoApplied(null);
        setPromoMessage(res.message);
        return;
      }
      setPromoApplied({ code: res.code ?? code.toUpperCase(), discount_amount: res.discount_amount });
      setPromoMessage(`Promo applied: -${formatPhpSpaced(res.discount_amount)}`);
    } catch (err) {
      setPromoApplied(null);
      setPromoMessage(err instanceof Error ? err.message : "Could not validate promo code.");
    } finally {
      setPromoLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <TopBanner />
        <Navbar />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <ShoppingBag className="size-16 text-muted-foreground/35" strokeWidth={1.25} />
          <h1 className="mt-6 text-xl font-bold text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add something from a restaurant menu before checkout.</p>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "default" }), "mt-8 rounded-xl font-semibold")}
          >
            Browse restaurants
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Left: auth or delivery step */}
          <div className="min-w-0">
            {!user ? (
              <CheckoutAuthPanel onSignedIn={(u) => setUser(u)} />
            ) : (
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {deliveryMode === "delivery" ? "Delivery details" : "Review and place your order"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user.email}</span>
                </p>
                {deliveryMode === "delivery" ? (
                  <>
                    <div className="mt-6 rounded-[1.75rem] border border-border/70 bg-white p-6 shadow-[0_20px_60px_-42px_rgba(22,101,52,0.45)]">
                      <p className="text-lg font-semibold text-foreground">Saved Addresses</p>
                      {savedLocations.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {savedLocations.map((location) => {
                            const isSelected = selectedLocationId === location.id;
                            return (
                              <div
                                key={location.id}
                                onClick={() => setSelectedLocationId(location.id)}
                                className={cn(
                                  "cursor-pointer rounded-[1.3rem] border p-4 shadow-sm transition",
                                  isSelected
                                    ? "border-emerald-900/22 bg-gradient-to-br from-white via-white to-emerald-50/70"
                                    : "border-border/70 bg-white hover:border-emerald-900/18 hover:bg-emerald-50/35"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border shadow-sm",
                                      isSelected
                                        ? "border-emerald-900/15 bg-emerald-900 text-white"
                                        : "border-emerald-900/20 bg-white text-emerald-900"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "size-2.5 rounded-full",
                                        isSelected ? "bg-white" : "bg-emerald-900/35"
                                      )}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <MapPin className="size-4 shrink-0 text-primary" />
                                          <p className="truncate text-[1.05rem] font-semibold text-foreground">
                                            {location.address}
                                          </p>
                                        </div>
                                        <p className="mt-1 text-base text-muted-foreground">{location.cityLine}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                          Note to rider: {location.note || "none"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEditLocationEditor(location);
                                          }}
                                          className="text-emerald-900 hover:bg-emerald-100/70 hover:text-emerald-950"
                                        >
                                          <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeleteLocation(location.id);
                                          }}
                                          className="text-emerald-900 hover:bg-emerald-100/70 hover:text-emerald-950"
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[1.3rem] border border-dashed border-emerald-900/18 bg-emerald-50/45 p-6 text-sm text-muted-foreground">
                          No saved address yet. Add one to continue with delivery.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={openAddLocationEditor}
                        className="mt-5 inline-flex items-center gap-2 text-base font-medium text-foreground transition hover:text-primary"
                      >
                        <Plus className="size-5" />
                        Add address
                      </button>

                      {addressMessage ? (
                        <p className="mt-3 text-sm text-muted-foreground">{addressMessage}</p>
                      ) : null}
                    </div>
                    <div className="mt-5 rounded-[1.5rem] border border-border/70 bg-white p-4 shadow-sm">
                      <p className="text-base font-semibold text-foreground">Payment method</p>
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-900/20 bg-emerald-50/55 px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-900 text-white">
                            <HandCoins className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Cash on Delivery (COD)</p>
                            <p className="text-xs text-muted-foreground">Pay cash when your rider arrives</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                          Active
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-3 opacity-75">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Smartphone className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">GCash</p>
                            <p className="text-xs text-muted-foreground">E-wallet checkout integration</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Coming Soon
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-3 opacity-75">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <CreditCard className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Credit / Debit Card</p>
                            <p className="text-xs text-muted-foreground">Card payments via secure gateway</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Coming Soon
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 space-y-5">
                    <div className="rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-sm">
                      <p className="text-[2rem] font-bold leading-tight text-foreground">Pick-up at</p>
                      <div className="mt-4 flex items-start gap-2">
                        <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                        <div>
                          <p className="text-xl font-semibold text-foreground">{cartRestaurant?.name ?? "Restaurant"}</p>
                          <p className="mt-1 text-base text-muted-foreground">
                            {cartRestaurant?.address?.trim() || "Restaurant address unavailable"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-sm">
                      <p className="text-[2rem] font-bold leading-tight text-foreground">Pick-up options</p>
                      <div className="mt-4 space-y-3">
                        <button
                          type="button"
                          onClick={() => setPickupOption("standard")}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition",
                            pickupOption === "standard"
                              ? "border-emerald-900/35 bg-emerald-50/55"
                              : "border-border/70 bg-white hover:border-emerald-900/20"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex size-6 items-center justify-center rounded-full border",
                                pickupOption === "standard"
                                  ? "border-emerald-900 bg-emerald-900 text-white"
                                  : "border-muted-foreground/40 text-transparent"
                              )}
                            >
                              <span className="size-2.5 rounded-full bg-current" />
                            </span>
                            <span className="text-lg font-semibold text-foreground">Standard</span>
                          </span>
                          <span className="text-base text-muted-foreground">15 mins</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPickupOption("scheduled")}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition",
                            pickupOption === "scheduled"
                              ? "border-emerald-900/35 bg-emerald-50/55"
                              : "border-border/70 bg-white hover:border-emerald-900/20"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex size-6 items-center justify-center rounded-full border",
                                pickupOption === "scheduled"
                                  ? "border-emerald-900 bg-emerald-900 text-white"
                                  : "border-muted-foreground/40 text-transparent"
                              )}
                            >
                              <span className="size-2.5 rounded-full bg-current" />
                            </span>
                            <span className="text-lg font-semibold text-foreground">Scheduled</span>
                          </span>
                          <span className="text-base text-muted-foreground">Select date and time</span>
                        </button>
                      </div>

                      {pickupOption === "scheduled" ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="space-y-2">
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                              <CalendarDays className="size-4 text-primary" />
                              Date
                            </span>
                            <input
                              type="date"
                              min={todayIso}
                              value={pickupDate}
                              onChange={(e) => setPickupDate(e.target.value)}
                              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-primary/45"
                            />
                          </label>
                          <label className="space-y-2">
                            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                              <Clock3 className="size-4 text-primary" />
                              Time
                            </span>
                            <input
                              type="time"
                              value={pickupTime}
                              onChange={(e) => setPickupTime(e.target.value)}
                              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-primary/45"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.5rem] border border-border/70 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[2rem] font-bold leading-tight text-foreground">Personal details</p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-base"
                          onClick={() => router.push("/account")}
                        >
                          Edit
                        </Button>
                      </div>
                      <div className="mt-3 space-y-1 text-base">
                        <p className="font-semibold text-foreground">{user.name}</p>
                        <p className="text-muted-foreground">{user.email}</p>
                        <p className="text-muted-foreground">{user.phone || "No phone number set yet"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                <div className="flex w-full rounded-full border border-border/50 bg-muted/70 p-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("delivery")}
                    className={cn(
                      "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                      deliveryMode === "delivery"
                        ? "bg-primary text-primary-foreground shadow-sm"
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
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    Pick-up
                  </button>
                </div>
                {deliveryMode === "delivery" ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Standard {dMin}–{dMax} mins
                  </p>
                ) : (
                  <p className="mt-2 text-center text-xs text-muted-foreground">Pick up at the restaurant</p>
                )}
              </div>

              {cartRestaurant ? (
                <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted">
                    {publicFileUrl(cartRestaurant.profile_image_path, cartRestaurant.profile_image_url) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={publicFileUrl(cartRestaurant.profile_image_path, cartRestaurant.profile_image_url)!}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Image src="/tkimlogo.png" alt="" width={24} height={24} className="rounded opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{cartRestaurant.name}</p>
                    <p className="text-xs text-muted-foreground">{cartCount} items</p>
                  </div>
                </div>
              ) : null}

              <div className="px-4 py-4">
                <h2 className="text-sm font-bold text-foreground">Your items</h2>
                <ul className="mt-3 space-y-4">
                  {cart.map((line) => {
                    const thumb = publicFileUrl(line.item.image_path, line.item.image_url);
                    const lineTotal = parseFloat(line.item.price) * line.qty;
                    return (
                      <li key={line.item.id} className="flex gap-3">
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
                          <p className="text-sm font-medium leading-tight text-foreground">{line.item.name}</p>
                          <p className="text-xs text-muted-foreground">{line.qty}×</p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatPhpSpaced(lineTotal)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border/60 px-4 py-4 text-sm">
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cod", "wallet", "card"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition",
                          paymentMethod === method
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Promo code</p>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter code"
                      className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                    <Button type="button" variant="outline" onClick={() => void handleApplyPromo()} disabled={promoLoading}>
                      {promoLoading ? "Checking..." : "Apply"}
                    </Button>
                  </div>
                  {promoMessage ? <p className="text-xs text-muted-foreground">{promoMessage}</p> : null}
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums text-foreground">{formatPhpSpaced(cartTotal)}</span>
                </div>
                {deliveryMode === "delivery" ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Standard delivery</span>
                    <span className="text-right">
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPhpSpaced(DELIVERY_STRIKE_PHP)}
                      </span>{" "}
                      <span className="font-semibold text-primary">Free</span>
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-medium tabular-nums text-foreground">{formatPhpSpaced(SERVICE_FEE_PHP)}</span>
                </div>
                {promoApplied ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Discount ({promoApplied.code})</span>
                    <span className="font-semibold tabular-nums text-emerald-700">-{formatPhpSpaced(promoApplied.discount_amount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="border-t-4 border-primary bg-primary/10 px-4 py-3">
                <div className="flex gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    You&apos;ve got free delivery on your first order.
                  </p>
                </div>
              </div>

              <div className="border-t border-border/80 bg-muted/20 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-foreground">Total</p>
                    <p className="text-xs text-muted-foreground">(Incl. fees and tax)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-foreground">{formatPhpSpaced(grandTotal)}</p>
                    <p className="text-xs text-muted-foreground line-through">{formatPhpSpaced(strikeTotal)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={!canPlaceOrder}
                  className="mt-4 h-12 w-full rounded-xl border-0 bg-primary text-[15px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {placingOrder
                    ? "Placing order..."
                    : deliveryMode === "pickup"
                      ? "Place pick-up order"
                      : "Place order"}
                </Button>
                {orderMessage ? (
                  <p className="mt-3 text-sm text-muted-foreground">{orderMessage}</p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] rounded-t-[2rem] border-t border-border bg-white p-0 sm:mx-auto sm:max-w-3xl sm:rounded-[2rem] sm:border">
          <div className="overflow-y-auto">
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Delivery address</h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-base font-medium text-foreground transition hover:text-primary"
              >
                Cancel
              </button>
            </div>

            <div className="px-6">
              <div className="mb-4">
                <p className="text-[2rem] font-bold leading-tight tracking-tight text-foreground">
                  What&apos;s your exact location?
                </p>
                <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
                  Providing your location enables more accurate search and delivery ETA, seamless
                  order tracking and personalised recommendations.
                </p>
              </div>

              <div className="mb-4 rounded-[1.2rem] border border-border bg-white p-3 shadow-sm">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Enter your address
                </label>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <textarea
                    ref={editorAddressRef}
                    className="min-h-[58px] flex-1 resize-none rounded-[1rem] border border-transparent bg-transparent px-2 py-2 text-base text-foreground outline-none transition focus-visible:border-primary/35 focus-visible:bg-emerald-50/35"
                    placeholder="1006 Ongpin St, Manila"
                    value={editingLocation.address}
                    onChange={(e) =>
                      setEditingLocation((current) => ({
                        ...current,
                        address: e.target.value,
                        lat: null,
                        lon: null,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="h-11 rounded-xl px-4 text-base text-foreground hover:bg-emerald-50 hover:text-primary"
                  >
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4 text-primary" />}
                    {locating ? "Locating..." : "Locate me"}
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.35rem] border border-emerald-900/12 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30">
                <div className="relative aspect-[16/5] overflow-hidden">
                  {editorMapEmbedUrl ? (
                    <>
                      <iframe
                        title="Location map preview"
                        src={editorMapEmbedUrl}
                        className="size-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/15 via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(21,128,61,0.20),transparent_28%),linear-gradient(135deg,rgba(236,253,245,1),rgba(220,252,231,0.8))]">
                      <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-2 text-sm font-semibold text-emerald-900 shadow-sm">
                        {mapLoading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4 text-primary" />}
                        {mapLoading ? "Loading map..." : "Map preview"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-1 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        {editingLocation.address.trim() || "Set a delivery address"}
                      </p>
                      <p className="text-base text-muted-foreground">
                        {cityLineFromAddress(editingLocation.address || deliveryAddress)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="my-6 border-t border-border/80" />

              <div className="space-y-4 pb-6">
                <input
                  className="h-14 w-full rounded-[1.15rem] border border-border bg-background px-4 text-base text-foreground outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Floor"
                  value={editingLocation.floor}
                  onChange={(e) =>
                    setEditingLocation((current) => ({ ...current, floor: e.target.value }))
                  }
                />
                <textarea
                  className="min-h-[88px] w-full rounded-[1.15rem] border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
                  placeholder="Note to rider - e.g. building, landmark"
                  value={editingLocation.note}
                  onChange={(e) =>
                    setEditingLocation((current) => ({ ...current, note: e.target.value }))
                  }
                />

                <div>
                  <p className="text-lg font-semibold text-foreground">Add a Label</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {LABEL_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = editingLocation.label === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setEditingLocation((current) => ({ ...current, label: option.value }))
                          }
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-base transition",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-white text-foreground hover:border-primary/35 hover:bg-emerald-50"
                          )}
                        >
                          <Icon className="size-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="h-11 rounded-xl bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
                  >
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                    {locating ? "Locating..." : "Locate me"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAddressToProfile}
                    disabled={savingAddress}
                    className="h-11 rounded-xl"
                  >
                    {savingAddress ? "Saving..." : "Save to profile"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-border/70 bg-white px-6 py-4">
              <Button
                type="button"
                onClick={handleSubmitLocationEditor}
                className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Submit
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
}
