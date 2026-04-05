"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AUTH_CHANGED_EVENT, getStoredToken, getStoredUser, type AuthUser } from "@/lib/auth";
import {
  claimRiderOrder,
  fetchAvailableRiderOrders,
  fetchRiderOrders,
  fetchRiderOverview,
  sendRiderLocationPing,
  setRiderAvailability,
  updateRiderOrderStatus,
  type RiderOrder,
} from "@/lib/rider-api";
import { Bike, Clock3, Loader2, MapPin, Navigation, Phone, Power, Store, Truck } from "lucide-react";

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
type RiderGpsSample = { latitude: number; longitude: number; accuracy_meters: number | null };
type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

const GPS_MIN_SEND_INTERVAL_MS = 8000;
const GPS_MIN_DISTANCE_METERS = 8;

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

function riderBikeIcon(L: LeafletRuntime): unknown {
  return L.divIcon({
    className: "tk-rider-bike-icon",
    html: '<div style="position:relative;height:40px;width:40px;display:flex;align-items:center;justify-content:center;"><span style="position:absolute;inset:2px;border-radius:9999px;background:rgba(16,185,129,0.22);"></span><span style="position:relative;height:32px;width:32px;border-radius:9999px;background:linear-gradient(160deg,#047857,#065f46);color:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 10px 18px rgba(6,95,70,0.35);border:2px solid #ffffff;">&#128692;</span></div>',
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

function distanceBetweenMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const latDelta = toRadians(b.latitude - a.latitude);
  const lonDelta = toRadians(b.longitude - a.longitude);
  const latA = toRadians(a.latitude);
  const latB = toRadians(b.latitude);
  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

function formatMoney(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusToneClass(status: string): string {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "out_for_delivery") return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  if (status === "preparing") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (status === "accepted") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700";
  if (status === "pending") return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-muted/20 text-foreground";
}

function nextStatusOptions(status: string): Array<{ status: string; label: string }> {
  if (status === "pending") return [{ status: "accepted", label: "Accept order" }];
  if (status === "accepted") return [{ status: "preparing", label: "Picked up order" }];
  if (status === "preparing") return [{ status: "out_for_delivery", label: "Start delivery" }];
  if (status === "out_for_delivery") return [{ status: "completed", label: "Delivered" }];
  return [];
}

export default function RiderDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<{ isActive: boolean; activeOrdersCount: number; completedTodayCount: number } | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<RiderOrder[]>([]);
  const [actingOrderId, setActingOrderId] = useState<number | null>(null);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [locationPending, setLocationPending] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [gpsTrackingState, setGpsTrackingState] = useState<"idle" | "starting" | "live" | "blocked">("idle");
  const [selectedMapOrderId, setSelectedMapOrderId] = useState<number | null>(null);
  const [mapDestination, setMapDestination] = useState<{ lat: number; lon: number } | null>(null);
  const [mapRiderLocation, setMapRiderLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [routePath, setRoutePath] = useState<Array<[number, number]> | null>(null);
  const [usingRoadRoute, setUsingRoadRoute] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const destinationMarkerRef = useRef<LeafletMarker | null>(null);
  const riderMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsSendInFlightRef = useRef(false);
  const queuedGpsRef = useRef<RiderGpsSample | null>(null);
  const lastSentGpsRef = useRef<(RiderGpsSample & { sentAt: number }) | null>(null);

  const activeOrders = useMemo(
    () => orders.filter((order) => ["pending", "accepted", "preparing", "out_for_delivery"].includes(order.status)),
    [orders]
  );
  const liveTrackedOrders = useMemo(
    () => activeOrders.filter((order) => order.status === "out_for_delivery"),
    [activeOrders]
  );
  const liveTrackedOrderIds = useMemo(() => liveTrackedOrders.map((order) => order.id), [liveTrackedOrders]);
  const liveTrackedOrderIdsRef = useRef<number[]>([]);
  const selectedMapOrder = useMemo(() => {
    if (activeOrders.length === 0) return null;
    return activeOrders.find((order) => order.id === selectedMapOrderId) ?? activeOrders[0];
  }, [activeOrders, selectedMapOrderId]);
  const canClaimNewOrder = activeOrders.length === 0;

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetchRiderOverview();
      setOverview({
        isActive: res.rider.is_active,
        activeOrdersCount: res.active_orders_count,
        completedTodayCount: res.completed_today_count,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rider overview.");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetchRiderOrders();
      setOrders(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assigned orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadAvailableOrders = useCallback(async () => {
    try {
      const res = await fetchAvailableRiderOrders();
      setAvailableOrders(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load available orders.");
    }
  }, []);

  const loadRealtimeSnapshot = useCallback(async () => {
    await Promise.all([loadOverview(), loadOrders(), loadAvailableOrders()]);
  }, [loadOverview, loadOrders, loadAvailableOrders]);

  useEffect(() => {
    const applyAuth = () => {
      const u = getStoredUser();
      if (!u) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (u.role !== "rider") {
        router.replace("/");
        return;
      }
      setUser(u);
      setLoading(false);
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
    if (!user || user.role !== "rider") return;
    const token = getStoredToken();
    if (!token) return;

    let isDisposed = false;
    let refreshTimer: number | null = null;

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

    const scheduleSnapshotRefresh = () => {
      if (isDisposed || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadRealtimeSnapshot();
      }, 120);
    };

    const poolChannel = pusher.subscribe("private-rider.pool");
    const riderChannel = pusher.subscribe(`private-rider.${user.id}`);
    const onRealtimeEvent = () => {
      setError(null);
      scheduleSnapshotRefresh();
    };
    poolChannel.bind("rider.realtime.updated", onRealtimeEvent);
    riderChannel.bind("rider.realtime.updated", onRealtimeEvent);

    pusher.connection.bind("connected", () => {
      if (isDisposed) return;
      setLiveConnected(true);
      setError(null);
      scheduleSnapshotRefresh();
    });
    pusher.connection.bind("disconnected", () => {
      if (isDisposed) return;
      setLiveConnected(false);
      setError("Live updates are reconnecting...");
    });
    pusher.connection.bind("error", () => {
      if (isDisposed) return;
      setLiveConnected(false);
      setError("Live updates are reconnecting...");
    });

    void loadRealtimeSnapshot();

    return () => {
      isDisposed = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      poolChannel.unbind("rider.realtime.updated", onRealtimeEvent);
      riderChannel.unbind("rider.realtime.updated", onRealtimeEvent);
      pusher.unsubscribe("private-rider.pool");
      pusher.unsubscribe(`private-rider.${user.id}`);
      pusher.disconnect();
      setLiveConnected(false);
    };
  }, [user, loadRealtimeSnapshot]);

  useEffect(() => {
    liveTrackedOrderIdsRef.current = liveTrackedOrderIds;
  }, [liveTrackedOrderIds]);

  useEffect(() => {
    if (activeOrders.length === 0) {
      setSelectedMapOrderId(null);
      return;
    }
    const selectedStillExists = selectedMapOrderId !== null && activeOrders.some((order) => order.id === selectedMapOrderId);
    if (!selectedStillExists) {
      setSelectedMapOrderId(activeOrders[0].id);
    }
  }, [activeOrders, selectedMapOrderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedMapOrder?.delivery_address) {
        setMapDestination(null);
        return;
      }
      const geo = await geocodeAddress(selectedMapOrder.delivery_address);
      if (!cancelled) setMapDestination(geo);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMapOrder?.delivery_address]);

  const mapCenter = useMemo(() => {
    if (mapRiderLocation) return [mapRiderLocation.lat, mapRiderLocation.lon] as [number, number];
    if (mapDestination) return [mapDestination.lat, mapDestination.lon] as [number, number];
    return [14.5995, 120.9842] as [number, number];
  }, [mapRiderLocation, mapDestination]);

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
      if (!mapRiderLocation || !mapDestination) {
        setRoutePath(null);
        setUsingRoadRoute(false);
        return;
      }
      const roadRoute = await fetchRoadRoute(
        { lat: mapRiderLocation.lat, lon: mapRiderLocation.lon },
        { lat: mapDestination.lat, lon: mapDestination.lon }
      );
      if (cancelled) return;
      if (roadRoute && roadRoute.length > 1) {
        setRoutePath(roadRoute);
        setUsingRoadRoute(true);
      } else {
        setRoutePath([
          [mapRiderLocation.lat, mapRiderLocation.lon],
          [mapDestination.lat, mapDestination.lon],
        ]);
        setUsingRoadRoute(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapRiderLocation, mapDestination]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current) return;
      if (!selectedMapOrder) return;
      try {
        await loadLeaflet();
        if (cancelled || !mapRef.current || !window.L) return;
        const L = window.L;

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current, {
            center: mapCenter,
            zoom: 13,
            zoomControl: true,
            preferCanvas: true,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
            subdomains: "abc",
            detectRetina: true,
          }).addTo(mapInstanceRef.current);
        } else {
          mapInstanceRef.current.setView(mapCenter, 13);
        }

        mapInstanceRef.current.invalidateSize({ pan: false });
        window.setTimeout(() => {
          mapInstanceRef.current?.invalidateSize({ pan: false });
        }, 160);

        if (destinationMarkerRef.current) destinationMarkerRef.current.remove();
        if (riderMarkerRef.current) riderMarkerRef.current.remove();
        if (routeLineRef.current) routeLineRef.current.remove();

        if (mapDestination) {
          destinationMarkerRef.current = L.marker([mapDestination.lat, mapDestination.lon], {
            icon: destinationPinIcon(L),
          })
            .addTo(mapInstanceRef.current)
            .bindPopup("Customer destination");
        }

        if (mapRiderLocation) {
          riderMarkerRef.current = L.marker([mapRiderLocation.lat, mapRiderLocation.lon], {
            icon: riderBikeIcon(L),
          })
            .addTo(mapInstanceRef.current)
            .bindPopup("Your current location");
        }

        if (routePath && routePath.length > 1) {
          routeLineRef.current = L.polyline(routePath, {
            color: "#2563eb",
            weight: 4,
            opacity: 0.9,
            ...(usingRoadRoute ? {} : { dashArray: "8 6" }),
          }).addTo(mapInstanceRef.current);
          mapInstanceRef.current.fitBounds(routePath, { padding: [32, 32] });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render delivery map.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMapOrder, mapCenter, mapDestination, mapRiderLocation, routePath, usingRoadRoute]);

  useEffect(() => {
    return () => {
      destinationMarkerRef.current?.remove();
      riderMarkerRef.current?.remove();
      routeLineRef.current?.remove();
      mapInstanceRef.current?.remove();
      destinationMarkerRef.current = null;
      riderMarkerRef.current = null;
      routeLineRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  const pushLiveLocation = useCallback(async (sample: RiderGpsSample, force = false) => {
    setMapRiderLocation({
      lat: sample.latitude,
      lon: sample.longitude,
    });

    const targetOrderIds = liveTrackedOrderIdsRef.current;
    if (targetOrderIds.length === 0) return;

    const now = Date.now();
    const lastSent = lastSentGpsRef.current;
    const movedEnough =
      !lastSent ||
      distanceBetweenMeters(
        { latitude: lastSent.latitude, longitude: lastSent.longitude },
        { latitude: sample.latitude, longitude: sample.longitude }
      ) >= GPS_MIN_DISTANCE_METERS;
    const waitedLongEnough = !lastSent || now - lastSent.sentAt >= GPS_MIN_SEND_INTERVAL_MS;

    if (!force && !movedEnough && !waitedLongEnough) return;

    if (gpsSendInFlightRef.current) {
      queuedGpsRef.current = sample;
      return;
    }

    gpsSendInFlightRef.current = true;
    setLocationPending(true);
    try {
      const results = await Promise.allSettled(
        targetOrderIds.map((orderId) =>
          sendRiderLocationPing(orderId, {
            latitude: sample.latitude,
            longitude: sample.longitude,
            accuracy_meters: sample.accuracy_meters,
          })
        )
      );
      const succeeded = results.some((result) => result.status === "fulfilled");
      if (succeeded) {
        lastSentGpsRef.current = { ...sample, sentAt: now };
        setGpsTrackingState("live");
        setError(null);
      } else {
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      }
    } catch (err) {
      setGpsTrackingState("blocked");
      setError(err instanceof Error ? err.message : "Could not send live GPS location.");
    } finally {
      gpsSendInFlightRef.current = false;
      setLocationPending(false);

      const queued = queuedGpsRef.current;
      queuedGpsRef.current = null;
      if (queued) {
        void pushLiveLocation(queued, true);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (liveTrackedOrderIds.length === 0) {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      gpsWatchIdRef.current = null;
      queuedGpsRef.current = null;
      gpsSendInFlightRef.current = false;
      lastSentGpsRef.current = null;
      setLocationPending(false);
      setGpsTrackingState("idle");
      return;
    }

    if (!navigator.geolocation) {
      setGpsTrackingState("blocked");
      setError("Live GPS tracking requires browser geolocation.");
      return;
    }

    setGpsTrackingState("starting");

    const handlePosition = (coords: GeolocationCoordinates, force = false) => {
      void pushLiveLocation(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: coords.accuracy,
        },
        force
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => handlePosition(pos.coords, true),
      (err) => {
        setGpsTrackingState("blocked");
        setError(err.message || "GPS permission is required for live rider tracking.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handlePosition(pos.coords),
      (err) => {
        setGpsTrackingState("blocked");
        setError(err.message || "GPS permission is required for live rider tracking.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );

    return () => {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, [liveTrackedOrderIds, pushLiveLocation]);

  async function onToggleAvailability() {
    if (!overview) return;
    setAvailabilityPending(true);
    setMessage(null);
    try {
      const next = !overview.isActive;
      await setRiderAvailability(next);
      setOverview((prev) => (prev ? { ...prev, isActive: next } : prev));
      setMessage(next ? "You are now online and available for orders." : "You are now offline.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update availability.");
    } finally {
      setAvailabilityPending(false);
    }
  }

  async function onUpdateOrderStatus(order: RiderOrder, status: string) {
    setActingOrderId(order.id);
    setMessage(null);
    try {
      await updateRiderOrderStatus(order.id, status);
      setMessage(`Order ${order.order_number} updated to ${formatStatus(status)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order status.");
    } finally {
      setActingOrderId(null);
    }
  }

  async function onClaimOrder(order: RiderOrder) {
    setActingOrderId(order.id);
    setMessage(null);
    try {
      await claimRiderOrder(order.id);
      setMessage(`Order ${order.order_number} claimed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim order.");
    } finally {
      setActingOrderId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-slate-100 shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-yellow/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300/90">Rider operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Delivery command center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Accept available orders, update delivery status, and contact customers or restaurants from one place.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <span className={`size-2 rounded-full ${overview?.isActive ? "bg-emerald-400" : "bg-amber-300"}`} />
              {overview?.isActive ? "Online and ready" : "Offline"}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <span className={`size-2 rounded-full ${liveConnected ? "bg-emerald-400" : "bg-red-300"}`} />
              {liveConnected ? "Live updates connected" : "Reconnecting live updates"}
            </div>
          </div>
          <Button
            type="button"
            className="border-0 bg-brand-yellow font-bold text-brand-yellow-foreground hover:brightness-95"
            onClick={() => void onToggleAvailability()}
            disabled={availabilityPending || !overview}
          >
            <Power className="size-4" />
            {availabilityPending ? "Updating..." : overview?.isActive ? "Go offline" : "Go online"}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2">
              <Bike className="size-4 text-primary" />
              Availability
            </CardDescription>
            <CardTitle className="text-xl">{overviewLoading ? "..." : overview?.isActive ? "Online" : "Offline"}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              Active deliveries
            </CardDescription>
            <CardTitle className="text-xl">{overviewLoading ? "..." : overview?.activeOrdersCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              Completed today
            </CardDescription>
            <CardTitle className="text-xl">{overviewLoading ? "..." : overview?.completedTodayCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              Queue now
            </CardDescription>
            <CardTitle className="text-xl">{ordersLoading ? "..." : availableOrders.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Delivery map</CardTitle>
          <CardDescription>Live GPS follows the rider and pushes fresh coordinates to the customer map.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeOrders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              Claim or accept an order to open the map for customer delivery markers.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {activeOrders.map((order) => (
                  <Button
                    key={order.id}
                    type="button"
                    variant={selectedMapOrder?.id === order.id ? "default" : "outline"}
                    onClick={() => setSelectedMapOrderId(order.id)}
                    className="text-xs"
                  >
                    #{order.order_number}
                  </Button>
                ))}
              </div>
              <div className="relative isolate z-0 overflow-hidden rounded-xl border border-border/70">
                <div ref={mapRef} className="relative z-0 h-[300px] w-full bg-muted/30" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Destination: {selectedMapOrder?.delivery_address || "No delivery address"}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground">
                  <span
                    className={`size-2 rounded-full ${
                      gpsTrackingState === "live"
                        ? "bg-emerald-500"
                        : gpsTrackingState === "starting"
                          ? "bg-amber-400"
                          : gpsTrackingState === "blocked"
                            ? "bg-red-400"
                            : "bg-slate-300"
                    }`}
                  />
                  {gpsTrackingState === "live"
                    ? "Live GPS tracking"
                    : gpsTrackingState === "starting"
                      ? "Starting GPS"
                      : gpsTrackingState === "blocked"
                        ? "GPS blocked"
                        : "Waiting for delivery"}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Assigned orders</CardTitle>
            <CardDescription>Your live deliveries. Updates stream in real-time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ordersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading assigned orders...
              </div>
            ) : activeOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                No active orders assigned right now.
              </p>
            ) : (
              <div className="space-y-3">
                {activeOrders.map((order) => {
                  const actions = nextStatusOptions(order.status);
                  return (
                    <div key={order.id} className="space-y-3 rounded-xl border border-border/80 bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.restaurant?.name ?? "Restaurant"} - {order.customer?.name ?? "Customer"}
                          </p>
                        </div>
                        <Badge className={`border ${statusToneClass(order.status)}`}>{formatStatus(order.status)}</Badge>
                      </div>

                      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4" />
                        <span>{order.delivery_address || "No delivery address"}</span>
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{formatMoney(order.total)}</p>
                        <div className="flex flex-wrap gap-2">
                          {order.customer?.phone ? (
                            <Button type="button" variant="outline" asChild>
                              <a href={`tel:${order.customer.phone}`}>
                                <Phone className="size-4" />
                                Call customer
                              </a>
                            </Button>
                          ) : null}
                          {order.restaurant?.phone ? (
                            <Button type="button" variant="outline" asChild>
                              <a href={`tel:${order.restaurant.phone}`}>
                                <Store className="size-4" />
                                Call restaurant
                              </a>
                            </Button>
                          ) : null}
                          {actions.map((action) => (
                            <Button
                              key={action.status}
                              type="button"
                              variant="outline"
                              onClick={() => void onUpdateOrderStatus(order, action.status)}
                              disabled={actingOrderId === order.id}
                            >
                              {actingOrderId === order.id ? "Updating..." : action.label}
                            </Button>
                          ))}
                          {order.status === "out_for_delivery" ? (
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                              <Navigation className="size-4" />
                              {locationPending ? "Sending live GPS..." : "Live GPS active"}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Available orders</CardTitle>
            <CardDescription>
              {canClaimNewOrder
                ? "Claim one unassigned order from dispatch queue."
                : "Claiming is locked until your current delivery is completed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canClaimNewOrder ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You already have an active order. Complete it first before claiming another booking.
              </div>
            ) : null}
            {ordersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading available orders...
              </div>
            ) : availableOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                No available orders right now.
              </p>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div key={order.id} className="space-y-3 rounded-xl border border-border/80 bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.restaurant?.name ?? "Restaurant"} - {order.customer?.name ?? "Customer"}
                        </p>
                      </div>
                      <Badge className={`border ${statusToneClass(order.status)}`}>{formatStatus(order.status)}</Badge>
                    </div>
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      {order.delivery_address || "No delivery address"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{formatMoney(order.total)}</p>
                      <Button
                        type="button"
                        className="border-0 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => void onClaimOrder(order)}
                        disabled={actingOrderId === order.id || !canClaimNewOrder}
                      >
                        {!canClaimNewOrder
                          ? "Finish current order first"
                          : actingOrderId === order.id
                            ? "Claiming..."
                            : "Claim order"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
