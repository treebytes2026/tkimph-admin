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
  operating_status: "open" | "paused" | "temporarily_closed" | "suspended";
  operating_note: string | null;
  paused_until: string | null;
  publicly_orderable: boolean;
  readiness_status: "ready" | "incomplete";
  readiness_checks: Array<{ key: string; label: string; passed: boolean }>;
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
  settings: {
    partner_self_pause_enabled: boolean;
    partner_cancel_window_minutes: number;
  };
}

export async function fetchPartnerOverview(): Promise<PartnerOverviewResponse> {
  return partnerRequest<PartnerOverviewResponse>("/partner/overview");
}

export interface PartnerPromotion {
  id: number;
  restaurant_id: number | null;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  min_spend: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  max_discount_amount: string | null;
  global_usage_limit: number | null;
  per_user_usage_limit: number;
  stackable: boolean;
  auto_apply: boolean;
  first_order_only: boolean;
  priority: number;
  eligible_user_ids: number[] | null;
}

export interface PartnerPromotionCreateInput {
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  min_spend: number;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount_amount?: number | null;
  global_usage_limit?: number | null;
  per_user_usage_limit: number;
  stackable: boolean;
  auto_apply: boolean;
  first_order_only: boolean;
  priority?: number;
  eligible_user_ids?: number[] | null;
}

export type PartnerPromotionUpdateInput = Partial<PartnerPromotionCreateInput>;

export async function fetchPartnerPromotions(restaurantId: number): Promise<PartnerPromotion[]> {
  const json = await partnerRequest<{ data: PartnerPromotion[] }>(`/partner/restaurants/${restaurantId}/promotions`);
  return json.data;
}

export async function createPartnerPromotion(
  restaurantId: number,
  body: PartnerPromotionCreateInput
): Promise<PartnerPromotion> {
  return partnerRequest<PartnerPromotion>(`/partner/restaurants/${restaurantId}/promotions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePartnerPromotion(
  restaurantId: number,
  promotionId: number,
  body: PartnerPromotionUpdateInput
): Promise<PartnerPromotion> {
  return partnerRequest<PartnerPromotion>(`/partner/restaurants/${restaurantId}/promotions/${promotionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePartnerPromotion(restaurantId: number, promotionId: number): Promise<void> {
  await partnerRequest<void>(`/partner/restaurants/${restaurantId}/promotions/${promotionId}`, {
    method: "DELETE",
  });
}

export interface PartnerOrderItem {
  id: number;
  menu_item_id: number | null;
  name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface PartnerOrder {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_mode: string;
  delivery_address: string;
  delivery_floor: string | null;
  delivery_note: string | null;
  location_label: string | null;
  subtotal: string;
  service_fee: string;
  delivery_fee: string;
  gross_sales: string;
  restaurant_net: string;
  total: string;
  placed_at: string | null;
  cancelled_by_role: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  customer: { id: number; name: string; phone: string | null } | null;
  restaurant: { id: number; name: string } | null;
  items: PartnerOrderItem[];
  timeline: Array<{
    id: number;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    actor: { id: number; name: string; role?: string | null } | null;
    created_at: string | null;
  }>;
}

export interface PartnerOrdersResponse {
  data: PartnerOrder[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export async function fetchPartnerOrders(params?: {
  status?: string;
  per_page?: number;
}): Promise<PartnerOrdersResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return partnerRequest<PartnerOrdersResponse>(`/partner/orders${qs ? `?${qs}` : ""}`);
}

export async function updatePartnerOrderStatus(
  orderId: number,
  status: string,
  reason?: string | null
): Promise<{ message: string; order: PartnerOrder }> {
  return partnerRequest<{ message: string; order: PartnerOrder }>(`/partner/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export async function fetchPartnerEarnings(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<{
  restaurant_id: number;
  restaurant_name: string;
  order_count: number;
  gross_sales: number;
  commission_rate: number;
  platform_commission: number;
  delivery_fees: number;
  restaurant_net: number;
  payment_details: {
    gcash_name: string;
    gcash_number: string;
  };
}> {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return partnerRequest(`/partner/earnings${qs ? `?${qs}` : ""}`);
}

export interface PartnerCommissionCollectionRow {
  id: number;
  restaurant_id: number;
  restaurant: { id: number; name: string } | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  is_overdue: boolean;
  order_count: number;
  gross_sales: number;
  commission_amount: number;
  restaurant_net: number;
  status: "pending" | "received";
  partner_payment_method: "gcash" | null;
  partner_reference_number: string | null;
  partner_payment_note: string | null;
  payment_proof_path: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  collection_reference: string | null;
  notes: string | null;
  received_at: string | null;
}

export interface PartnerCommissionCollectionsResponse {
  data: PartnerCommissionCollectionRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  payment_details: {
    gcash_name: string;
    gcash_number: string;
  };
}

export async function fetchPartnerCommissionCollections(params?: {
  page?: number;
  per_page?: number;
  status?: "pending" | "received";
}): Promise<PartnerCommissionCollectionsResponse> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return partnerRequest<PartnerCommissionCollectionsResponse>(`/partner/commission-collections${qs ? `?${qs}` : ""}`);
}

export async function submitPartnerCommissionPaymentProof(
  collectionId: number,
  payload: {
    partner_payment_method: "gcash";
    partner_reference_number?: string | null;
    partner_payment_note?: string | null;
    payment_proof: File;
  }
): Promise<{ message: string; collection: PartnerCommissionCollectionRow }> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("partner_payment_method", payload.partner_payment_method);
  if (payload.partner_reference_number?.trim()) formData.append("partner_reference_number", payload.partner_reference_number.trim());
  if (payload.partner_payment_note?.trim()) formData.append("partner_payment_note", payload.partner_payment_note.trim());
  formData.append("payment_proof", payload.payment_proof);

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/partner/commission-collections/${collectionId}/payment-proof`, {
    method: "POST",
    body: formData,
    headers,
  });

  if (res.status === 401) throw new PartnerApiError("Please sign in again.", 401);
  if (res.status === 403) throw new PartnerApiError("Partner access only.", 403);
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText || "Request failed";
    try {
      const data = JSON.parse(text) as { message?: string; error?: string; errors?: Record<string, string[]> };
      if (data.message) msg = data.message;
      else if (data.error) msg = data.error;
      else if (data.errors) {
        const first = Object.values(data.errors)[0];
        if (Array.isArray(first) && first[0]) msg = first[0];
      }
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }

  return res.json() as Promise<{ message: string; collection: PartnerCommissionCollectionRow }>;
}

export async function fetchPartnerUnreadNotificationsCount(): Promise<{ count: number }> {
  return partnerRequest<{ count: number }>("/partner/notifications/unread-count");
}

export async function markAllPartnerNotificationsRead(): Promise<{ message: string }> {
  return partnerRequest<{ message: string }>("/partner/notifications/read-all", {
    method: "POST",
  });
}

export interface PartnerNotificationRow {
  id: string;
  type: string;
  data: {
    category?: string;
    kind?: string;
    message?: string;
    order_id?: number;
    order_number?: string;
    settlement_id?: number;
    due_date?: string;
    total?: number;
    placed_at?: string;
    [key: string]: unknown;
  };
  read_at: string | null;
  created_at: string;
}

export interface PartnerSettlementRow {
  id: number;
  restaurant_id: number;
  restaurant: { id: number; name: string } | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  status: "pending" | "settled";
  platform_revenue: number;
  partner_reference_number: string | null;
  partner_payment_note: string | null;
  payment_proof_path: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  last_overdue_notified_at: string | null;
}

export interface PartnerSettlementsResponse {
  data: PartnerSettlementRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PartnerNotificationsResponse {
  data: PartnerNotificationRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export async function fetchPartnerNotifications(params?: {
  page?: number;
  per_page?: number;
}): Promise<PartnerNotificationsResponse> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return partnerRequest<PartnerNotificationsResponse>(`/partner/notifications${qs ? `?${qs}` : ""}`);
}

export async function fetchPartnerSettlements(params?: { page?: number; per_page?: number; status?: "pending" | "settled" }): Promise<PartnerSettlementsResponse> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return partnerRequest<PartnerSettlementsResponse>(`/partner/settlements${qs ? `?${qs}` : ""}`);
}

export async function submitPartnerSettlementPaymentProof(
  settlementId: number,
  payload: { partner_reference_number: string; partner_payment_note?: string | null; payment_proof: File }
): Promise<{ message: string; settlement: PartnerSettlementRow }> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("partner_reference_number", payload.partner_reference_number);
  if (payload.partner_payment_note?.trim()) formData.append("partner_payment_note", payload.partner_payment_note.trim());
  formData.append("payment_proof", payload.payment_proof);

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/partner/settlements/${settlementId}/payment-proof`, {
    method: "POST",
    body: formData,
    headers,
  });

  if (res.status === 401) throw new PartnerApiError("Please sign in again.", 401);
  if (res.status === 403) throw new PartnerApiError("Partner access only.", 403);
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText || "Request failed";
    try {
      const data = JSON.parse(text) as { message?: string; error?: string; errors?: Record<string, string[]> };
      if (data.message) msg = data.message;
      else if (data.error) msg = data.error;
      else if (data.errors) {
        const first = Object.values(data.errors)[0];
        if (Array.isArray(first) && first[0]) msg = first[0];
      }
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }

  return res.json() as Promise<{ message: string; settlement: PartnerSettlementRow }>;
}

export async function markPartnerNotificationRead(id: string): Promise<{ message: string }> {
  return partnerRequest<{ message: string }>(`/partner/notifications/${id}/read`, {
    method: "POST",
  });
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

export async function updatePartnerRestaurantAvailability(
  restaurantId: number,
  body: {
    operating_status: "open" | "paused";
    operating_note?: string | null;
    paused_until?: string | null;
  }
): Promise<PartnerOverviewRestaurant> {
  return partnerRequest<PartnerOverviewRestaurant>(`/partner/restaurants/${restaurantId}/availability`, {
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
  discount_enabled: boolean;
  discount_percent: string;
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
  commission_rate: string;
  platform_commission: string;
  restaurant_net: string;
  discount_enabled: boolean;
  discount_percent: string;
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
  body: { name: string; sort_order?: number; is_active?: boolean; discount_enabled?: boolean; discount_percent?: number }
): Promise<PartnerMenuListRow> {
  return partnerRequest<PartnerMenuListRow>(`/partner/restaurants/${restaurantId}/menus`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePartnerMenu(
  restaurantId: number,
  menuId: number,
  body: { name?: string; sort_order?: number; is_active?: boolean; discount_enabled?: boolean; discount_percent?: number }
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
    discount_enabled?: boolean;
    discount_percent?: number;
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
    discount_enabled: boolean;
    discount_percent: number;
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
