const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/** Laravel app base URL (no `/api`) — use for `/storage/...` so images match `NEXT_PUBLIC_API_URL`. */
export function publicApiOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").trim();
  const noTrailing = raw.replace(/\/+$/, "");
  if (noTrailing.endsWith("/api")) {
    return noTrailing.slice(0, -4) || "http://127.0.0.1:8000";
  }
  return noTrailing || "http://127.0.0.1:8000";
}

export function publicStoragePublicUrl(storagePath: string): string {
  let clean = storagePath.replace(/^\/+/, "");
  if (clean.startsWith("storage/")) {
    clean = clean.slice("storage/".length);
  }
  return `${publicApiOrigin()}/storage/${clean}`;
}

export function publicFileUrl(
  path: string | null | undefined,
  fallbackAbsoluteUrl?: string | null
): string | null {
  const p = path?.trim();
  if (p) return publicStoragePublicUrl(p);
  const u = fallbackAbsoluteUrl?.trim();
  return u || null;
}

export class PublicApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.body = body;
  }
}

function messageFromParsed(data: {
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}): string | null {
  if (data.message) return data.message;
  if (data.error) return data.error;
  if (data.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  return null;
}

async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    let msg = res.statusText || "Request failed";
    try {
      const data = JSON.parse(text) as Parameters<typeof messageFromParsed>[0];
      body = data;
      const m = messageFromParsed(data);
      if (m) msg = m;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PublicApiError(msg, res.status, body);
  }

  return res.json() as Promise<T>;
}

export interface RegistrationCategory {
  id: number;
  name: string;
  sort_order: number;
}

export interface RegistrationBusinessType {
  id: number;
  name: string;
  slug: string;
  requires_category: boolean;
  requires_cuisine: boolean;
  categories: RegistrationCategory[];
}

export interface RegistrationCuisine {
  id: number;
  name: string;
  sort_order: number;
}

export interface RegistrationOptionsResponse {
  business_types: RegistrationBusinessType[];
  cuisines: RegistrationCuisine[];
}

export function fetchRegistrationOptions(): Promise<RegistrationOptionsResponse> {
  return publicFetch<RegistrationOptionsResponse>("/public/registration-options");
}

export interface PartnerApplicationPayload {
  business_name: string;
  owner_first_name: string;
  owner_last_name: string;
  email: string;
  phone: string;
  business_type_id: number;
  business_category_id?: number | null;
  cuisine_id?: number | null;
  address?: string | null;
  notes?: string | null;
}

export function submitPartnerApplication(
  payload: PartnerApplicationPayload
): Promise<{ message: string; id: number }> {
  return publicFetch("/partner-applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface RiderApplicationPayload {
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  vehicle_type?: string | null;
  license_number?: string | null;
  id_document?: File | null;
  license_document?: File | null;
  id_document_url?: string | null;
  license_document_url?: string | null;
  notes?: string | null;
}

export function submitRiderApplication(
  payload: RiderApplicationPayload
): Promise<{ message: string; id: number }> {
  const body = new FormData();
  body.append("name", payload.name);
  body.append("email", payload.email);
  body.append("phone", payload.phone);
  if (payload.address) body.append("address", payload.address);
  if (payload.vehicle_type) body.append("vehicle_type", payload.vehicle_type);
  if (payload.license_number) body.append("license_number", payload.license_number);
  if (payload.id_document) body.append("id_document", payload.id_document);
  if (payload.license_document) body.append("license_document", payload.license_document);
  if (payload.id_document_url) body.append("id_document_url", payload.id_document_url);
  if (payload.license_document_url) body.append("license_document_url", payload.license_document_url);
  if (payload.notes) body.append("notes", payload.notes);

  return publicFetch("/rider-applications", {
    method: "POST",
    body,
  });
}

export function requestPasswordResetEmail(email: string): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  });
}

export function resetPasswordWithToken(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PublicCuisine {
  id: number;
  name: string;
  sort_order: number;
}

/** Same shape as partner dashboard (day 0 = Sunday … 6 = Saturday). */
export interface PublicOpeningHoursDay {
  day: number;
  closed: boolean;
  open: string | null;
  close: string | null;
}

/** Partner-uploaded location photos (public detail + modal). */
export interface PublicLocationImage {
  id: number;
  path: string;
  url: string | null;
  sort_order: number;
}

export interface PublicRestaurant {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  phone?: string | null;
  address: string | null;
  opening_hours?: PublicOpeningHoursDay[] | null;
  location_images?: PublicLocationImage[];
  profile_image_path: string | null;
  profile_image_url: string | null;
  cuisine: { id: number; name: string } | null;
  business_type?: { id: number; name: string } | null;
  /** Listing UI — from API (deterministic placeholders until real metrics exist). */
  rating?: number;
  review_count?: number;
  delivery_min_minutes?: number;
  delivery_max_minutes?: number;
  delivery_fee_php?: number;
  standard_delivery_fee_php?: number;
  free_delivery_min_spend_php?: number;
  price_level?: number;
  promo_label?: string | null;
  promotions?: Array<{
    id: number;
    code: string;
    name: string;
    min_spend: number;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    max_discount_amount: number | null;
    stackable: boolean;
    auto_apply: boolean;
    first_order_only: boolean;
    ends_at: string | null;
    display_label: string;
  }>;
  is_ad?: boolean;
  /** Partner menus (e.g. Pizza, rice meal) — listing “All restaurants” only. */
  menus?: { id: number; name: string }[];
}

export interface PublicMenuItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  original_price?: number;
  has_discount?: boolean;
  discount_percent?: number;
  image_path: string | null;
  image_url: string | null;
  rating?: number;
  review_count?: number;
}

/** One partner menu (e.g. “Lunch”, “All day”) with its dishes — not global food categories. */
export interface PublicMenuGroup {
  menu: { id: number; name: string; sort_order: number };
  items: PublicMenuItem[];
}

export interface PublicRestaurantDetailResponse {
  restaurant: PublicRestaurant;
  menus: PublicMenuGroup[];
  reviews?: Array<{
    id: number;
    restaurant_rating: number;
    comment: string | null;
    customer_name: string | null;
    created_at: string | null;
  }>;
}

export function fetchPublicRestaurantBySlug(slug: string): Promise<PublicRestaurantDetailResponse> {
  return publicFetch<PublicRestaurantDetailResponse>(
    `/public/restaurants/${encodeURIComponent(slug)}`
  );
}

export function fetchPublicCuisines(): Promise<{ data: PublicCuisine[] }> {
  return publicFetch<{ data: PublicCuisine[] }>("/public/cuisines");
}

export interface PublicRestaurantsMeta {
  total: number;
  limit: number;
}

export function fetchPublicRestaurants(params?: {
  cuisine_id?: number;
  limit?: number;
}): Promise<{ data: PublicRestaurant[]; meta?: PublicRestaurantsMeta }> {
  const q = new URLSearchParams();
  if (params?.cuisine_id != null) q.set("cuisine_id", String(params.cuisine_id));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return publicFetch<{ data: PublicRestaurant[]; meta?: PublicRestaurantsMeta }>(
    `/public/restaurants${qs ? `?${qs}` : ""}`
  );
}

/** Landing “All restaurants”: each block = restaurant + full menus + dishes (same as restaurant detail). */
export interface RestaurantWithMenusFeed {
  restaurant: PublicRestaurant;
  menus: PublicMenuGroup[];
}

export function fetchPublicRestaurantsMenuFeed(params?: {
  cuisine_id?: number;
  limit?: number;
}): Promise<{ data: RestaurantWithMenusFeed[]; meta?: PublicRestaurantsMeta }> {
  const q = new URLSearchParams();
  if (params?.cuisine_id != null) q.set("cuisine_id", String(params.cuisine_id));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return publicFetch<{ data: RestaurantWithMenusFeed[]; meta?: PublicRestaurantsMeta }>(
    `/public/restaurants-menu-feed${qs ? `?${qs}` : ""}`
  );
}
