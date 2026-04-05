"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Pusher from "pusher-js";
import { Footer, Navbar, TopBanner } from "@/components/landing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AUTH_CHANGED_EVENT, getStoredToken, getStoredUser, type AuthUser } from "@/lib/auth";
import { CustomerApiError, fetchCustomerOrder, type CustomerOrder } from "@/lib/customer-api";
import { CheckCircle2, Clock3, Loader2, MapPin, Navigation, Phone, Store, Truck } from "lucide-react";

declare global {
  interface Window {
    L?: LeafletRuntime;
  }
}

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: [number, number][], options?: { padding?: [number, number] }) => void;
  invalidateSize: (options?: { pan?: boolean; debounceMoveend?: boolean }) => void;
  remove: () => void;
};

type LeafletMarker = {
  remove: () => void;
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (html: string) => LeafletMarker;
};

type LeafletPolyline = {
  remove: () => void;
  addTo: (map: LeafletMap) => LeafletPolyline;
};

type LeafletRuntime = {
  map: (
    element: HTMLElement,
    options: { center: [number, number]; zoom: number; zoomControl: boolean; preferCanvas?: boolean }
  ) => LeafletMap;
  tileLayer: (
    url: string,
    options: { maxZoom: number; attribution: string; subdomains?: string; detectRetina?: boolean }
  ) => { addTo: (map: LeafletMap) => void };
  marker: (coords: [number, number], options?: { icon?: unknown }) => LeafletMarker;
  polyline: (coords: [number, number][], options?: { color?: string; weight?: number; opacity?: number; dashArray?: string }) => LeafletPolyline;
  divIcon: (options: { className?: string; html?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }) => unknown;
};

type GeocodeHit = { lat: string; lon: string };
type CustomerOrderRealtimeEvent = {
  order_id?: number;
  reason?: string;
  live_location?: {
    latitude: number;
    longitude: number;
    accuracy_meters?: number | null;
    recorded_at?: string | null;
  } | null;
};
type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
const API_BASE_URL = API_URL.replace(/\/api\/?$/, "");
const DEFAULT_REVERB_HOST = (() => {
  try {
    return new URL(API_BASE_URL).hostname;
  } catch {
    return "127.0.0.1";
  }
})();
const REVERB_APP_KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY || "local";
const REVERB_HOST = process.env.NEXT_PUBLIC_REVERB_HOST || DEFAULT_REVERB_HOST;
const REVERB_PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT || 8080);
const REVERB_SCHEME = process.env.NEXT_PUBLIC_REVERB_SCHEME || "http";
const REVERB_CLUSTER = process.env.NEXT_PUBLIC_REVERB_CLUSTER || "mt1";

async function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.L) return;

  await new Promise<void>((resolve, reject) => {
    const existingCss = document.querySelector('link[data-leaflet="1"]');
    if (!existingCss) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.setAttribute("data-leaflet", "1");
      document.head.appendChild(css);
    }

    const existingScript = document.querySelector('script[data-leaflet="1"]') as HTMLScriptElement | null;
    if (existingScript) {
      if (window.L) resolve();
      else existingScript.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-leaflet", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load map library."));
    document.body.appendChild(script);
  });
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address.trim()) return null;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as GeocodeHit[];
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

async function fetchRoadRoute(
  rider: { lat: number; lon: number },
  customer: { lat: number; lon: number }
): Promise<Array<[number, number]> | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${rider.lon},${rider.lat};${customer.lon},${customer.lat}` +
    `?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok") return null;
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  return coords.map(([lon, lat]) => [lat, lon]);
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-emerald-500/10 border-emerald-500/35 text-emerald-700";
  if (status === "cancelled" || status === "failed" || status === "undeliverable") {
    return "bg-destructive/10 border-destructive/30 text-destructive";
  }
  return "bg-primary/10 border-primary/25 text-primary";
}

function formatEventLabel(eventType: string): string {
  return eventType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function timelineEventTone(eventType: string, toStatus?: string | null): string {
  if (toStatus === "completed") {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-700";
  }
  if (eventType.includes("rider")) {
    return "border-blue-200 bg-blue-50/80 text-blue-700";
  }
  if (eventType.includes("partner") || eventType.includes("restaurant")) {
    return "border-amber-200 bg-amber-50/80 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function TimelineEventIcon({ eventType, toStatus }: { eventType: string; toStatus?: string | null }) {
  if (toStatus === "completed") {
    return <CheckCircle2 className="size-4" />;
  }
  if (eventType.includes("rider")) {
    return <Truck className="size-4" />;
  }
  if (eventType.includes("partner") || eventType.includes("restaurant")) {
    return <Store className="size-4" />;
  }
  return <Clock3 className="size-4" />;
}

function riderBikeIcon(L: LeafletRuntime): unknown {
  return L.divIcon({
    className: "tk-rider-bike-icon",
    html: '<div style="position:relative;height:40px;width:40px;display:flex;align-items:center;justify-content:center;"><span style="position:absolute;inset:2px;border-radius:9999px;background:rgba(16,185,129,0.22);filter:blur(0.2px);"></span><span style="position:relative;height:32px;width:32px;border-radius:9999px;background:linear-gradient(160deg,#047857,#065f46);color:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 10px 18px rgba(6,95,70,0.35);border:2px solid #ffffff;">&#128692;</span></div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function destinationPinIcon(L: LeafletRuntime): unknown {
  return L.divIcon({
    className: "tk-destination-pin-icon",
    html: '<div style="position:relative;height:40px;width:32px;display:flex;align-items:flex-start;justify-content:center;"><span style="margin-top:2px;height:26px;width:26px;border-radius:9999px;background:linear-gradient(180deg,#f97316,#ea580c);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 8px 16px rgba(234,88,12,0.35);border:2px solid #ffffff;">C</span><span style="position:absolute;top:24px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #ea580c;"></span></div>',
    iconSize: [32, 40],
    iconAnchor: [16, 38],
  });
}

export default function CustomerOrderTrackPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const riderMarkerRef = useRef<LeafletMarker | null>(null);
  const destinationMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lon: number } | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [routePath, setRoutePath] = useState<Array<[number, number]> | null>(null);
  const [usingRoadRoute, setUsingRoadRoute] = useState(false);

  useEffect(() => {
    const applyAuth = () => {
      const u = getStoredUser();
      if (!u) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (u.role === "admin") {
        router.replace("/dashboard");
        return;
      }
      if (u.role === "restaurant_owner") {
        router.replace("/partner/dashboard");
        return;
      }
      if (u.role === "rider") {
        router.replace("/rider/dashboard");
        return;
      }
      setUser(u);
    };

    applyAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, applyAuth);
    window.addEventListener("storage", applyAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, applyAuth);
      window.removeEventListener("storage", applyAuth);
    };
  }, [router]);

  useEffect(() => {
    if (!user || Number.isNaN(orderId)) return;
    const token = getStoredToken();
    if (!token) return;

    let cancelled = false;
    let refreshTimer: number | null = null;

    async function load(initial = false) {
      if (initial) setLoading(true);
      try {
        const res = await fetchCustomerOrder(orderId);
        if (cancelled) return;
        setOrder(res.order);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CustomerApiError && err.status === 401) {
          router.replace("/login");
        }
        setError(err instanceof Error ? err.message : "Could not load order tracking.");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    const pusher = new Pusher(REVERB_APP_KEY, {
      cluster: REVERB_CLUSTER,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_SCHEME === "https",
      enabledTransports: REVERB_SCHEME === "https" ? ["wss"] : ["ws", "wss"],
      channelAuthorization: {
        endpoint: `${API_URL}/broadcasting/auth`,
        transport: "ajax",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const scheduleRefresh = () => {
      if (cancelled || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void load(false);
      }, 120);
    };

    const customerChannel = pusher.subscribe(`private-customer.${user.id}`);
    const onRealtimeEvent = (payload: CustomerOrderRealtimeEvent) => {
      if (payload.order_id && Number(payload.order_id) !== orderId) return;
      if (payload.reason === "rider_location_updated" && payload.live_location) {
        setOrder((current) =>
          current
            ? {
                ...current,
                live_location: {
                  latitude: payload.live_location?.latitude ?? current.live_location?.latitude ?? 0,
                  longitude: payload.live_location?.longitude ?? current.live_location?.longitude ?? 0,
                  accuracy_meters: payload.live_location?.accuracy_meters ?? null,
                  recorded_at: payload.live_location?.recorded_at ?? new Date().toISOString(),
                },
              }
            : current
        );
        setError(null);
        return;
      }
      scheduleRefresh();
    };
    customerChannel.bind("customer.order.updated", onRealtimeEvent);

    pusher.connection.bind("connected", () => {
      if (cancelled) return;
      setLiveConnected(true);
      scheduleRefresh();
    });
    pusher.connection.bind("disconnected", () => {
      if (cancelled) return;
      setLiveConnected(false);
    });
    pusher.connection.bind("error", () => {
      if (cancelled) return;
      setLiveConnected(false);
    });

    void load(true);

    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      customerChannel.unbind("customer.order.updated", onRealtimeEvent);
      pusher.unsubscribe(`private-customer.${user.id}`);
      pusher.disconnect();
      setLiveConnected(false);
    };
  }, [user, orderId, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!order?.delivery_address) {
        setDestination(null);
        return;
      }
      const geo = await geocodeAddress(order.delivery_address);
      if (!cancelled) setDestination(geo);
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.delivery_address]);

  const center = useMemo(() => {
    if (order?.live_location) return [order.live_location.latitude, order.live_location.longitude] as [number, number];
    if (destination) return [destination.lat, destination.lon] as [number, number];
    return [14.5995, 120.9842] as [number, number];
  }, [order?.live_location, destination]);

  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize({ pan: false });
    });
    observer.observe(mapRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!order?.live_location || !destination) {
        setRoutePath(null);
        setUsingRoadRoute(false);
        return;
      }
      const rider = { lat: order.live_location.latitude, lon: order.live_location.longitude };
      const customer = { lat: destination.lat, lon: destination.lon };
      const roadRoute = await fetchRoadRoute(rider, customer);
      if (cancelled) return;
      if (roadRoute && roadRoute.length > 1) {
        setRoutePath(roadRoute);
        setUsingRoadRoute(true);
      } else {
        setRoutePath([
          [rider.lat, rider.lon],
          [customer.lat, customer.lon],
        ]);
        setUsingRoadRoute(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.live_location, destination]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current) return;
      try {
        await loadLeaflet();
        if (cancelled || !mapRef.current || !window.L) return;
        const L = window.L;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current, {
            center,
            zoom: 13,
            zoomControl: true,
            preferCanvas: true,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: "abc",
            detectRetina: true,
          }).addTo(mapInstanceRef.current);
        } else {
          mapInstanceRef.current.setView(center, 13);
        }
        // Prevent tile seam / misalignment glitches after layout shifts.
        mapInstanceRef.current.invalidateSize({ pan: false });
        window.setTimeout(() => {
          mapInstanceRef.current?.invalidateSize({ pan: false });
        }, 160);

        if (riderMarkerRef.current) riderMarkerRef.current.remove();
        if (destinationMarkerRef.current) destinationMarkerRef.current.remove();
        if (routeLineRef.current) routeLineRef.current.remove();

        if (order?.live_location) {
          const bikeIcon = riderBikeIcon(L);
          riderMarkerRef.current = L.marker([
            order.live_location.latitude,
            order.live_location.longitude,
          ], { icon: bikeIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("Rider live location");
        }

        if (destination) {
          const customerIcon = destinationPinIcon(L);
          destinationMarkerRef.current = L.marker([destination.lat, destination.lon], { icon: customerIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("Delivery destination");
        }

        if (routePath && routePath.length > 1) {
          routeLineRef.current = L.polyline(routePath, {
            color: "#2563eb",
            weight: 4,
            opacity: 0.9,
            ...(usingRoadRoute ? {} : { dashArray: "8 6" }),
          }).addTo(mapInstanceRef.current);
          mapInstanceRef.current.fitBounds(routePath, { padding: [40, 40] });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render map.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order?.live_location, destination, center, routePath, usingRoadRoute]);

  useEffect(() => {
    return () => {
      routeLineRef.current?.remove();
      destinationMarkerRef.current?.remove();
      riderMarkerRef.current?.remove();
      mapInstanceRef.current?.remove();
      routeLineRef.current = null;
      destinationMarkerRef.current = null;
      riderMarkerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading tracking...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-destructive">{error ?? "Order not found."}</p>
              <Button asChild variant="outline">
                <Link href="/orders">Back to orders</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopBanner />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-slate-100 shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-8 h-48 w-48 rounded-full bg-brand-yellow/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300/90">Order tracking</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Track order #{order.order_number}</h1>
              <p className="mt-1 text-sm text-slate-300">
                {order.restaurant?.name ?? "Restaurant"} - {order.delivery_mode === "pickup" ? "Pickup" : "Delivery"}
              </p>
            </div>
            <Badge className={`border ${statusBadgeClass(order.status)}`}>{formatStatus(order.status)}</Badge>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live connection</p>
              <p className="mt-1 text-sm font-semibold">{liveConnected ? "Connected" : "Reconnecting"}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rider</p>
              <p className="mt-1 text-sm font-semibold">{order.rider?.name ?? "Not assigned"}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold">{order.delivery_address || "No delivery address"}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Live map and route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative isolate z-0 overflow-hidden rounded-2xl border border-slate-200">
              <div ref={mapRef} className="relative z-0 h-[360px] w-full bg-slate-100" />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" />
                {order.delivery_address || "No delivery address"}
              </p>
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <Navigation className="size-4" />
                {order.live_location?.recorded_at
                  ? `Last rider update: ${new Date(order.live_location.recorded_at).toLocaleString("en-PH")}`
                  : "Waiting for rider location update"}
              </p>
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                Rider: {order.rider?.name ?? "Not assigned"} {order.rider?.phone ? `(${order.rider.phone})` : ""}
              </p>
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <Navigation className="size-4" />
                {usingRoadRoute ? "Road route line" : "Approximate direct line"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Status timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
                No updates yet.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Delivery progress</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Latest movement from the restaurant, rider, and system.
                    </p>
                  </div>
                  <Badge className={`border ${statusBadgeClass(order.status)}`}>{formatStatus(order.status)}</Badge>
                </div>

                <div className="space-y-3">
                  {order.timeline
                .slice()
                .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
                .map((event) => (
                    <div key={event.id} className="relative pl-11">
                      <div className="absolute left-[17px] top-11 h-[calc(100%+16px)] w-px bg-gradient-to-b from-slate-200 to-transparent last:hidden" />
                      <div
                        className={`absolute left-0 top-1 flex size-9 items-center justify-center rounded-2xl border shadow-sm ${timelineEventTone(event.event_type, event.to_status)}`}
                      >
                        <TimelineEventIcon eventType={event.event_type} toStatus={event.to_status} />
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatEventLabel(event.event_type)}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {event.actor?.name ?? "System"} • {event.created_at ? new Date(event.created_at).toLocaleString("en-PH") : "Now"}
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                            {event.to_status
                              ? `${event.from_status ? `${formatStatus(event.from_status)} -> ` : ""}${formatStatus(event.to_status)}`
                              : "No status change"}
                          </Badge>
                        </div>

                        {event.note ? (
                          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                            {event.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
