"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Footer, Navbar, TopBanner } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import {
  fetchPublicCuisines,
  fetchPublicRestaurantBySlug,
  fetchPublicRestaurants,
  publicFileUrl,
  type PublicCuisine,
  type PublicMenuGroup,
  type PublicRestaurant,
} from "@/lib/public-api";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    L?: LeafletRuntime;
  }
}

type LeafletMap = {
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void;
  setView: (center: [number, number], zoom: number) => void;
  flyTo: (center: [number, number], zoom: number, options?: { duration?: number }) => void;
};

type LeafletMarker = {
  bindPopup: (html: string) => LeafletMarker;
  on: (event: string, callback: () => void) => void;
  remove: () => void;
  addTo: (map: LeafletMap) => LeafletMarker;
  openPopup: () => void;
};

type LeafletRuntime = {
  map: (
    element: HTMLElement,
    options: { center: [number, number]; zoom: number; zoomControl: boolean }
  ) => LeafletMap;
  tileLayer: (
    url: string,
    options: { maxZoom: number; attribution: string }
  ) => { addTo: (map: LeafletMap) => void };
  marker: (coords: [number, number]) => LeafletMarker;
  latLngBounds: (coords: Array<[number, number]>) => unknown;
};

type GeocodeHit = {
  lat: string;
  lon: string;
};

type PickupPoint = {
  restaurant: PublicRestaurant;
  lat: number | null;
  lon: number | null;
};

function formatReviews(n: number) {
  if (n >= 1000) return `${Math.floor(n / 1000)}k+`;
  return String(n);
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as GeocodeHit[];
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();

  return new Promise((resolve, reject) => {
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

export default function PickupMapPage() {
  const searchParams = useSearchParams();
  const initialLat = Number(searchParams.get("lat"));
  const initialLng = Number(searchParams.get("lng"));

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<PublicCuisine[]>([]);
  const [selectedCuisineId, setSelectedCuisineId] = useState<number | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [mappedOnly, setMappedOnly] = useState(false);
  const [selectedMenus, setSelectedMenus] = useState<PublicMenuGroup[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Record<number, LeafletMarker>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPublicCuisines();
        if (!cancelled) setCuisines(res.data);
      } catch {
        if (!cancelled) setCuisines([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPoints = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return points.filter((point) => {
      if (mappedOnly && (point.lat == null || point.lon == null)) return false;
      if (selectedCuisineId !== "all" && point.restaurant.cuisine?.id !== selectedCuisineId) return false;
      if (!q) return true;
      const name = point.restaurant.name.toLowerCase();
      const address = point.restaurant.address?.toLowerCase() ?? "";
      const cuisine = point.restaurant.cuisine?.name.toLowerCase() ?? "";
      return name.includes(q) || address.includes(q) || cuisine.includes(q);
    });
  }, [points, mappedOnly, selectedCuisineId, searchText]);

  const mappablePoints = useMemo(
    () => filteredPoints.filter((point) => point.lat != null && point.lon != null),
    [filteredPoints]
  );
  const selectedPoint =
    filteredPoints.find((point) => point.restaurant.id === selectedId) ??
    points.find((point) => point.restaurant.id === selectedId) ??
    null;
  const visiblePoints = showSelectedOnly && selectedPoint ? [selectedPoint] : filteredPoints;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMapError(null);
      try {
        const restaurantsRes = await fetchPublicRestaurants({ limit: 60 });
        const restaurants = restaurantsRes.data.filter((r) => Boolean(r.address?.trim()));

        const cacheKey = "tkimph:pickup-geocode-cache:v1";
        let cache: Record<string, { lat: number; lon: number }> = {};
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) cache = JSON.parse(raw) as Record<string, { lat: number; lon: number }>;
        } catch {
          cache = {};
        }

        const nextPoints: PickupPoint[] = [];
        for (const restaurant of restaurants) {
          if (cancelled) return;
          const address = restaurant.address!.trim();
          let coords = cache[address] ?? null;
          if (!coords) {
            coords = await geocodeAddress(address);
            if (coords) cache[address] = coords;
          }
          nextPoints.push({
            restaurant,
            lat: coords?.lat ?? null,
            lon: coords?.lon ?? null,
          });
        }

        localStorage.setItem(cacheKey, JSON.stringify(cache));
        if (cancelled) return;
        setPoints(nextPoints);
        const firstMappable = nextPoints.find((p) => p.lat != null && p.lon != null);
        setSelectedId(firstMappable?.restaurant.id ?? nextPoints[0]?.restaurant.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "Could not load pickup map.");
          setPoints([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (filteredPoints.length === 0) {
      setSelectedId(null);
      setShowSelectedOnly(false);
      return;
    }
    if (selectedId == null || !filteredPoints.some((p) => p.restaurant.id === selectedId)) {
      const firstMappable = filteredPoints.find((p) => p.lat != null && p.lon != null);
      setSelectedId(firstMappable?.restaurant.id ?? filteredPoints[0].restaurant.id);
      setShowSelectedOnly(false);
    }
  }, [filteredPoints, selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current) return;
      try {
        await loadLeaflet();
        if (cancelled || !mapRef.current || !window.L) return;

        const L = window.L;
        const defaultCenter =
          !Number.isNaN(initialLat) && !Number.isNaN(initialLng)
            ? [initialLat, initialLng]
            : mappablePoints[0]
              ? [mappablePoints[0].lat!, mappablePoints[0].lon!]
              : [14.5995, 120.9842];

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current, {
            center: defaultCenter,
            zoom: 13,
            zoomControl: true,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapInstanceRef.current);
        }

        const map = mapInstanceRef.current;
        Object.values(markerRefs.current).forEach((marker) => marker.remove());
        markerRefs.current = {};

        for (const point of mappablePoints) {
          const marker = L.marker([point.lat, point.lon]).addTo(map);
          marker.bindPopup(`<strong>${point.restaurant.name}</strong><br/>${point.restaurant.address ?? ""}`);
          marker.on("click", () => {
            setSelectedId(point.restaurant.id);
            setShowSelectedOnly(true);
          });
          markerRefs.current[point.restaurant.id] = marker;
        }

        if (mappablePoints.length > 1) {
          const bounds = L.latLngBounds(
            mappablePoints.map((p) => [p.lat as number, p.lon as number])
          );
          map.fitBounds(bounds, { padding: [40, 40] });
        } else if (mappablePoints[0]) {
          map.setView([mappablePoints[0].lat!, mappablePoints[0].lon!], 14);
        }
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "Could not render map.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mappablePoints, initialLat, initialLng]);

  useEffect(() => {
    const point = points.find((p) => p.restaurant.id === selectedId);
    if (!point || point.lat == null || point.lon == null || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([point.lat, point.lon], 15, { duration: 0.6 });
    const marker = markerRefs.current[point.restaurant.id];
    if (marker) marker.openPopup();
  }, [selectedId, points]);

  useEffect(() => {
    const selected = points.find((p) => p.restaurant.id === selectedId)?.restaurant;
    if (!selected?.slug) {
      setSelectedMenus([]);
      setMenuLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setMenuLoading(true);
      try {
        const res = await fetchPublicRestaurantBySlug(selected.slug!);
        if (!cancelled) setSelectedMenus(res.menus);
      } catch {
        if (!cancelled) setSelectedMenus([]);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, points]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Pick-up map</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse pickup restaurants on a full map view.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/?expedition=pickup">Back to pickup</Link>
          </Button>
        </div>

        <div className="grid h-[calc(100vh-240px)] min-h-[560px] gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
            <div className="max-h-full space-y-2 overflow-y-auto p-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
                <div className="space-y-2">
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search restaurant"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <select
                    value={String(selectedCuisineId)}
                    onChange={(e) =>
                      setSelectedCuisineId(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <option value="all">All cuisines</option>
                    {cuisines.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={mappedOnly}
                      onChange={(e) => setMappedOnly(e.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                    Show mapped restaurants only
                  </label>
                  {showSelectedOnly && selectedPoint ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full rounded-lg text-xs font-semibold"
                      onClick={() => setShowSelectedOnly(false)}
                    >
                      Show all restaurants
                    </Button>
                  ) : null}
                </div>
              </div>

              {loading ? (
                <p className="inline-flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading restaurants...
                </p>
              ) : visiblePoints.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  No restaurants match your filters.
                </p>
              ) : (
                visiblePoints.map((point) => {
                  const active = point.restaurant.id === selectedId;
                  const imageSrc = publicFileUrl(
                    point.restaurant.profile_image_path,
                    point.restaurant.profile_image_url
                  );
                  const rating = point.restaurant.rating ?? 4.5;
                  const reviews = point.restaurant.review_count ?? 100;
                  const cuisine = point.restaurant.cuisine?.name ?? "Restaurant";
                  const etaMin = point.restaurant.delivery_min_minutes ?? 15;
                  const etaMax = point.restaurant.delivery_max_minutes ?? 35;
                  return (
                    <div
                      key={point.restaurant.id}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-white transition",
                        active
                          ? "border-primary ring-2 ring-primary/25"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(point.restaurant.id);
                          setShowSelectedOnly(true);
                        }}
                        className="w-full text-left"
                      >
                        <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                          {imageSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-[15px] font-semibold text-foreground">
                              {point.restaurant.name}
                            </p>
                            <p className="shrink-0 text-sm font-semibold text-foreground">
                              <span className="text-amber-500">★</span> {rating.toFixed(1)}({formatReviews(reviews)})
                            </p>
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{cuisine}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {etaMin}–{etaMax} min
                          </p>
                          {point.lat == null || point.lon == null ? (
                            <p className="mt-1 text-[11px] font-medium text-amber-700">
                              No map pin yet for this address
                            </p>
                          ) : null}
                        </div>
                      </button>
                      {point.restaurant.slug ? (
                        <Link
                          href={`/restaurant/${encodeURIComponent(point.restaurant.slug)}?expedition=pickup`}
                          className="mx-3 mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Navigation className="size-3.5" />
                          Open for pickup
                        </Link>
                      ) : null}
                    </div>
                  );
                })
              )}

              {selectedId != null ? (
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Menu items</p>
                  {menuLoading ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading menu...
                    </p>
                  ) : selectedMenus.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No menu items found for this restaurant.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedMenus
                        .flatMap((group) => group.items.map((item) => ({ group: group.menu.name, item })))
                        .slice(0, 8)
                        .map(({ group, item }) => (
                          <li key={item.id} className="flex gap-2 rounded-lg border border-border/70 bg-white p-2">
                            <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                              {publicFileUrl(item.image_path, item.image_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={publicFileUrl(item.image_path, item.image_url) ?? ""}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                                  No photo
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-1 text-xs font-semibold text-foreground">{item.name}</p>
                              <p className="line-clamp-1 text-[11px] text-muted-foreground">{group}</p>
                              <p className="text-xs font-medium text-primary">PHP {Number(item.price).toFixed(2)}</p>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
            {mapError ? (
              <div className="flex size-full items-center justify-center px-6 text-sm text-destructive">
                {mapError}
              </div>
            ) : (
              <div ref={mapRef} className="size-full min-h-[560px]" />
            )}
            {!loading && mappablePoints.length > 1 ? (
              <div className="border-t border-border/70 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                Showing {mappablePoints.length} restaurant pins
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
