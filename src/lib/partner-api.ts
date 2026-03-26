import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/**
 * Laravel app base URL (no `/api`). Use for `/storage/...` links so image previews match the same host
 * as `NEXT_PUBLIC_API_URL` (avoids broken previews when `APP_URL` in `.env` differs, e.g. localhost vs 127.0.0.1).
 */
export function partnerApiOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").trim();
  const noTrailing = raw.replace(/\/+$/, "");
  if (noTrailing.endsWith("/api")) {
    return noTrailing.slice(0, -4) || "http://127.0.0.1:8000";
  }
  return noTrailing || "http://127.0.0.1:8000";
}

/** Full URL to a file on the `public` disk (path from API, e.g. `menus/1/2/photo.jpg`). */
export function partnerStoragePublicUrl(storagePath: string): string {
  let clean = storagePath.replace(/^\/+/, "");
  if (clean.startsWith("storage/")) {
    clean = clean.slice("storage/".length);
  }
  return `${partnerApiOrigin()}/storage/${clean}`;
}

/**
 * Prefer `path` + {@link partnerStoragePublicUrl} for display. Laravel's absolute `*_url` fields use
 * `APP_URL`, which often mismatches `NEXT_PUBLIC_API_URL` (e.g. localhost vs 127.0.0.1) and breaks images.
 */
export function partnerPublicFileUrl(
  path: string | null | undefined,
  fallbackAbsoluteUrl?: string | null
): string | null {
  const p = path?.trim();
  if (p) return partnerStoragePublicUrl(p);
  const u = fallbackAbsoluteUrl?.trim();
  return u || null;
}

export class PartnerApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "PartnerApiError";
    this.status = status;
    this.body = body;
  }
}

export interface PartnerOverviewUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

/** Day 0 = Sunday … 6 = Saturday (matches API). */
export type PartnerOpeningHoursDay = {
  day: number;
  closed: boolean;
  open: string | null;
  close: string | null;
};

/** Default Mon–Fri 09:00–21:00, weekends closed — used when the API has no hours yet. */
export function defaultPartnerOpeningWeek(): PartnerOpeningHoursDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    closed: day === 0 || day === 6,
    open: day >= 1 && day <= 5 ? "09:00" : null,
    close: day >= 1 && day <= 5 ? "21:00" : null,
  }));
}

export type PartnerLocationImage = {
  id: number;
  path: string;
  url: string | null;
  sort_order: number;
};

export interface PartnerOverviewRestaurant {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  /** Storage path on the `public` disk — prefer this with {@link partnerPublicFileUrl} for display. */
  profile_image_path: string | null;
  /** May use a different host than the app; prefer `profile_image_path` + partner URL helpers. */
  profile_image_url: string | null;
  opening_hours: PartnerOpeningHoursDay[] | null;
  location_images: PartnerLocationImage[];
  business_type: { id: number; name: string } | null;
  business_category: { id: number; name: string } | null;
  cuisine: { id: number; name: string } | null;
}

export interface PartnerOverviewResponse {
  user: PartnerOverviewUser;
  restaurants: PartnerOverviewRestaurant[];
}

export async function fetchPartnerOverview(): Promise<PartnerOverviewResponse> {
  return partnerRequest<PartnerOverviewResponse>("/partner/overview");
}

export async function updatePartnerProfile(body: {
  name?: string;
  phone?: string | null;
}): Promise<PartnerOverviewUser> {
  return partnerRequest<PartnerOverviewUser>("/partner/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updatePartnerRestaurant(
  restaurantId: number,
  body: {
    name?: string;
    description?: string | null;
    phone?: string | null;
    address?: string | null;
    opening_hours?: PartnerOpeningHoursDay[] | null;
  }
): Promise<PartnerOverviewRestaurant> {
  return partnerRequest<PartnerOverviewRestaurant>(`/partner/restaurants/${restaurantId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function changePartnerPassword(body: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return partnerRequest<{ message: string }>("/partner/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadPartnerLocationImage(restaurantId: number, file: File): Promise<PartnerLocationImage> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("image", file);
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}/partner/restaurants/${restaurantId}/location-images`, {
    method: "POST",
    body: formData,
    headers,
  });
  if (res.status === 401) throw new PartnerApiError("Please sign in again.", 401);
  if (res.status === 403) throw new PartnerApiError("Partner access only.", 403);
  if (!res.ok) {
    const text = await res.text();
    let msg = "Upload failed";
    try {
      const data = JSON.parse(text) as { message?: string };
      if (data.message) msg = data.message;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }
  return res.json() as Promise<PartnerLocationImage>;
}

export async function deletePartnerLocationImage(restaurantId: number, imageId: number): Promise<void> {
  await partnerRequest<void>(`/partner/restaurants/${restaurantId}/location-images/${imageId}`, {
    method: "DELETE",
  });
}

export async function uploadPartnerRestaurantProfileImage(
  restaurantId: number,
  file: File
): Promise<PartnerOverviewRestaurant> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("image", file);
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}/partner/restaurants/${restaurantId}/profile-image`, {
    method: "POST",
    body: formData,
    headers,
  });
  if (res.status === 401) throw new PartnerApiError("Please sign in again.", 401);
  if (res.status === 403) throw new PartnerApiError("Partner access only.", 403);
  if (!res.ok) {
    const text = await res.text();
    let msg = "Upload failed";
    try {
      const data = JSON.parse(text) as { message?: string };
      if (data.message) msg = data.message;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }
  return res.json() as Promise<PartnerOverviewRestaurant>;
}

export async function deletePartnerRestaurantProfileImage(
  restaurantId: number
): Promise<PartnerOverviewRestaurant> {
  return partnerRequest<PartnerOverviewRestaurant>(`/partner/restaurants/${restaurantId}/profile-image`, {
    method: "DELETE",
  });
}

async function partnerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(!isFormData && options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    throw new PartnerApiError("Please sign in again.", 401);
  }

  if (res.status === 403) {
    throw new PartnerApiError("Partner access only.", 403);
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText || "Request failed";
    let body: unknown = text;
    try {
      const data = JSON.parse(text) as {
        message?: string;
        error?: string;
        errors?: Record<string, string[]>;
      };
      body = data;
      if (data.message) msg = data.message;
      else if (data.error) msg = data.error;
      else if (data.errors) {
        const first = Object.values(data.errors)[0];
        if (Array.isArray(first) && first[0]) msg = first[0];
      }
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface PartnerMenuCategoryOption {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export async function fetchPartnerMenuCategories(): Promise<PartnerMenuCategoryOption[]> {
  const json = await partnerRequest<{ data: PartnerMenuCategoryOption[] }>("/partner/menu-categories");
  return json.data;
}

export interface PartnerMenuListRow {
  id: number;
  restaurant_id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  items_count?: number;
}

export async function fetchRestaurantMenus(restaurantId: number): Promise<PartnerMenuListRow[]> {
  const json = await partnerRequest<{ data: PartnerMenuListRow[] }>(
    `/partner/restaurants/${restaurantId}/menus`
  );
  return json.data;
}

export interface PartnerMenuItemRow {
  id: number;
  menu_id: number;
  menu_category_id: number;
  name: string;
  description: string | null;
  image_path?: string | null;
  image_url?: string | null;
  price: string;
  sort_order: number;
  is_available: boolean;
  menu_category?: { id: number; name: string };
}

export interface PartnerMenuDetail extends PartnerMenuListRow {
  items: PartnerMenuItemRow[];
}

export async function fetchPartnerMenu(restaurantId: number, menuId: number): Promise<PartnerMenuDetail> {
  return partnerRequest<PartnerMenuDetail>(`/partner/restaurants/${restaurantId}/menus/${menuId}`);
}

export async function createPartnerMenu(
  restaurantId: number,
  body: { name: string; sort_order?: number; is_active?: boolean }
): Promise<PartnerMenuListRow> {
  return partnerRequest<PartnerMenuListRow>(`/partner/restaurants/${restaurantId}/menus`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePartnerMenu(
  restaurantId: number,
  menuId: number,
  body: { name?: string; sort_order?: number; is_active?: boolean }
): Promise<PartnerMenuListRow> {
  return partnerRequest<PartnerMenuListRow>(`/partner/restaurants/${restaurantId}/menus/${menuId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePartnerMenu(restaurantId: number, menuId: number): Promise<void> {
  await partnerRequest<void>(`/partner/restaurants/${restaurantId}/menus/${menuId}`, { method: "DELETE" });
}

export async function createPartnerMenuItem(
  restaurantId: number,
  menuId: number,
  body: {
    menu_category_id: number;
    name: string;
    description?: string | null;
    price: number;
    sort_order?: number;
    is_available?: boolean;
  }
): Promise<PartnerMenuItemRow> {
  return partnerRequest<PartnerMenuItemRow>(
    `/partner/restaurants/${restaurantId}/menus/${menuId}/items`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function updatePartnerMenuItem(
  restaurantId: number,
  menuId: number,
  itemId: number,
  body: Partial<{
    menu_category_id: number;
    name: string;
    description: string | null;
    price: number;
    sort_order: number;
    is_available: boolean;
  }>
): Promise<PartnerMenuItemRow> {
  return partnerRequest<PartnerMenuItemRow>(
    `/partner/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export async function deletePartnerMenuItem(
  restaurantId: number,
  menuId: number,
  itemId: number
): Promise<void> {
  await partnerRequest<void>(
    `/partner/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`,
    { method: "DELETE" }
  );
}

export async function uploadPartnerMenuItemImage(
  restaurantId: number,
  menuId: number,
  itemId: number,
  file: File
): Promise<PartnerMenuItemRow> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("image", file);
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(
    `${API_URL}/partner/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}/image`,
    { method: "POST", body: formData, headers }
  );
  if (res.status === 401) throw new PartnerApiError("Please sign in again.", 401);
  if (res.status === 403) throw new PartnerApiError("Partner access only.", 403);
  if (!res.ok) {
    const text = await res.text();
    let msg = "Upload failed";
    try {
      const data = JSON.parse(text) as { message?: string };
      if (data.message) msg = data.message;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }
  return res.json() as Promise<PartnerMenuItemRow>;
}

export async function deletePartnerMenuItemImage(
  restaurantId: number,
  menuId: number,
  itemId: number
): Promise<PartnerMenuItemRow> {
  return partnerRequest<PartnerMenuItemRow>(
    `/partner/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}/image`,
    { method: "DELETE" }
  );
}
