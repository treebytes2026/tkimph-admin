import { ADMIN_LOGIN_PATH } from "@/lib/routes";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export function adminApiOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").trim();
  const noTrailing = raw.replace(/\/+$/, "");
  if (noTrailing.endsWith("/api")) {
    return noTrailing.slice(0, -4) || "http://127.0.0.1:8000";
  }
  return noTrailing || "http://127.0.0.1:8000";
}

export function adminStoragePublicUrl(storagePath: string): string {
  let clean = storagePath.replace(/^\/+/, "");
  if (clean.startsWith("storage/")) clean = clean.slice("storage/".length);
  return `${adminApiOrigin()}/storage/${clean}`;
}

export function adminPublicFileUrl(path: string | null | undefined, fallbackAbsoluteUrl?: string | null): string | null {
  const p = path?.trim();
  if (p) return adminStoragePublicUrl(p);
  const u = fallbackAbsoluteUrl?.trim();
  return u || null;
}

export class AdminApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
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

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/admin${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = ADMIN_LOGIN_PATH;
    }
    throw new AdminApiError("Session expired. Please sign in again.", 401);
  }

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
    throw new AdminApiError(msg, res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export type UserRole = "customer" | "restaurant_owner" | "rider";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole | string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminRestaurant {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  user_id: number;
  business_type_id: number | null;
  business_category_id: number | null;
  cuisine_id: number | null;
  is_active: boolean;
  operating_status: "open" | "paused" | "temporarily_closed" | "suspended";
  operating_note: string | null;
  paused_until: string | null;
  publicly_orderable: boolean;
  force_publicly_orderable: boolean;
  readiness_status: "ready" | "incomplete";
  readiness_checks: Array<{ key: string; label: string; passed: boolean }>;
  owner: { id: number; name: string; email: string; role: string } | null;
  business_type: { id: number; name: string; slug: string } | null;
  business_category: { id: number; name: string } | null;
  cuisine: { id: number; name: string } | null;
  support_notes?: AdminSupportNote[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminSupportNote {
  id: number;
  note_type: "internal_note" | "contact_log" | "issue_tag";
  body: string;
  admin: { id: number; name: string; email: string } | null;
  created_at: string | null;
}

export interface PartnerOption {
  id: number;
  name: string;
  email: string;
}

export function fetchUsers(params: {
  page?: number;
  role?: string;
  search?: string;
}): Promise<Paginated<AdminUser>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.role) q.set("role", params.role);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<AdminUser>>(`/users${qs ? `?${qs}` : ""}`);
}

export function createUser(body: Record<string, unknown>): Promise<AdminUser> {
  return adminFetch<AdminUser>("/users", { method: "POST", body: JSON.stringify(body) });
}

export function updateUser(id: number, body: Record<string, unknown>): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteUser(id: number): Promise<void> {
  return adminFetch<void>(`/users/${id}`, { method: "DELETE" });
}

export function toggleUserActive(id: number): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/toggle-active`, { method: "PATCH" });
}

export function fetchRestaurants(params: {
  page?: number;
  search?: string;
}): Promise<Paginated<AdminRestaurant>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<AdminRestaurant>>(`/restaurants${qs ? `?${qs}` : ""}`);
}

export function fetchPartners(): Promise<PartnerOption[]> {
  return adminFetch<PartnerOption[]>("/restaurants/partners");
}

export function createRestaurant(body: Record<string, unknown>): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>("/restaurants", { method: "POST", body: JSON.stringify(body) });
}

export function updateRestaurant(id: number, body: Record<string, unknown>): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>(`/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function fetchRestaurant(id: number): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>(`/restaurants/${id}`);
}

export function updateRestaurantOperatingStatus(
  id: number,
  body: {
    operating_status: "open" | "paused" | "temporarily_closed" | "suspended";
    operating_note: string;
    paused_until?: string | null;
  }
): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>(`/restaurants/${id}/operating-status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateRestaurantPublicOrderOverride(
  id: number,
  force_publicly_orderable: boolean
): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>(`/restaurants/${id}/public-order-override`, {
    method: "PATCH",
    body: JSON.stringify({ force_publicly_orderable }),
  });
}

export function addRestaurantSupportNote(
  id: number,
  body: { note_type: AdminSupportNote["note_type"]; body: string }
): Promise<AdminSupportNote> {
  return adminFetch<AdminSupportNote>(`/restaurants/${id}/support-notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface AdminSettlementSummary {
  restaurant_id: number;
  restaurant_name: string;
  order_count: number;
  gross_sales: number;
  commission_rate: number;
  platform_commission: number;
  delivery_fees: number;
  restaurant_net: number;
}

export function fetchRestaurantSettlementSummary(
  id: number,
  params?: { date_from?: string; date_to?: string }
): Promise<AdminSettlementSummary> {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return adminFetch<AdminSettlementSummary>(`/restaurants/${id}/settlement-summary${qs ? `?${qs}` : ""}`);
}

export function deleteRestaurant(id: number): Promise<void> {
  return adminFetch<void>(`/restaurants/${id}`, { method: "DELETE" });
}

export function toggleRestaurantActive(id: number): Promise<AdminRestaurant> {
  return adminFetch<AdminRestaurant>(`/restaurants/${id}/toggle-active`, { method: "PATCH" });
}

export interface RegistrationStats {
  pending_partner_applications: number;
  pending_rider_applications: number;
}

export function fetchRegistrationStats(): Promise<RegistrationStats> {
  return adminFetch<RegistrationStats>("/registration-stats");
}

export interface AdminNotificationPayload {
  category?: string;
  message?: string;
  type?: string;
  id?: number;
  order_id?: number;
  order_number?: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  name?: string;
  customer_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string | null;
  subject?: string;
  message_body?: string;
  status?: string;
  reason?: string | null;
  [key: string]: unknown;
}

export interface AdminNotificationRow {
  id: string;
  type: string;
  data: AdminNotificationPayload;
  read_at: string | null;
  created_at: string | null;
}

export function fetchUnreadNotificationCount(): Promise<{ count: number }> {
  return adminFetch<{ count: number }>("/notifications/unread-count");
}

export function fetchAdminNotifications(params?: {
  page?: number;
  per_page?: number;
}): Promise<Paginated<AdminNotificationRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return adminFetch<Paginated<AdminNotificationRow>>(
    `/notifications${qs ? `?${qs}` : ""}`
  );
}

export function markNotificationRead(id: string): Promise<void> {
  return adminFetch<void>(`/notifications/${id}/read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return adminFetch<void>("/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface AdminOrderRow {
  id: number;
  order_number: string;
  status: string;
  gross_sales: number;
  service_fee: number;
  delivery_fee: number;
  restaurant_net: number;
  total: number;
  delivery_mode: string;
  delivery_address: string;
  placed_at: string | null;
  assigned_at: string | null;
  cancelled_by_role: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  is_stalled: boolean;
  updated_at: string | null;
  customer: { id: number; name: string; phone: string | null; email?: string | null } | null;
  restaurant: { id: number; name: string } | null;
  rider: { id: number; name: string; phone: string | null } | null;
}

export interface AdminOrderNote {
  id: number;
  note: string;
  admin: { id: number; name: string; email: string } | null;
  created_at: string | null;
}

export interface AdminOrderDetail extends AdminOrderRow {
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  notes: AdminOrderNote[];
  timeline: Array<{
    id: number;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    actor: { id: number; name: string; email?: string | null; role?: string | null } | null;
    created_at: string | null;
  }>;
  support_notes: AdminSupportNote[];
}

export interface AdminOrderSummary {
  total_orders: number;
  pending: number;
  accepted: number;
  preparing: number;
  out_for_delivery: number;
  completed: number;
  failed: number;
  undeliverable: number;
  unassigned_active_orders: number;
  stalled_orders: number;
  active_riders: number;
  gross_sales: number;
  platform_income: number;
  restaurant_net: number;
  sla_stalled_minutes: number;
}

export interface AdminRiderOption {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  active_orders_count: number;
  completed_orders_count: number;
  created_at: string | null;
}

export interface AdminRiderDetail extends AdminRiderOption {
  recent_orders: Array<{
    id: number;
    order_number: string;
    status: string;
    total: number;
    placed_at: string | null;
    customer: { id: number; name: string; phone: string | null } | null;
    restaurant: { id: number; name: string } | null;
  }>;
}

export interface AdminOperationalSettings {
  order_transition_guardrails: boolean;
  rider_auto_assignment: boolean;
  sla_stalled_minutes: number;
  partner_self_pause_enabled: boolean;
  partner_cancel_window_minutes: number;
  customer_cancel_window_minutes: number;
  platform_commission_rate: number;
  settlements_enabled: boolean;
  delivery_fee_enabled: boolean;
  standard_delivery_fee: number;
  commission_payment_gcash_name: string;
  commission_payment_gcash_number: string;
}

export interface AdminSettlementRow {
  id: number;
  restaurant_id: number;
  restaurant: { id: number; name: string } | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  is_overdue: boolean;
  overdue_days: number;
  order_count: number;
  gross_sales: number;
  service_fees: number;
  delivery_fees: number;
  restaurant_net: number;
  platform_revenue: number;
  status: "pending" | "settled";
  reference_number: string | null;
  partner_reference_number: string | null;
  partner_payment_note: string | null;
  payment_proof_path: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_submitted_by_partner: { id: number; name: string; email: string } | null;
  notes: string | null;
  settled_at: string | null;
  last_overdue_notified_at: string | null;
  created_at: string | null;
  created_by_admin: { id: number; name: string; email: string } | null;
  settled_by_admin: { id: number; name: string; email: string } | null;
}

export interface AdminCommissionCollectionRow {
  id: number;
  restaurant_id: number;
  restaurant: { id: number; name: string } | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  is_overdue: boolean;
  overdue_days: number;
  order_count: number;
  gross_sales: number;
  commission_amount: number;
  restaurant_net: number;
  status: "pending" | "received";
  collection_reference: string | null;
  partner_payment_method: "gcash" | null;
  partner_reference_number: string | null;
  partner_payment_note: string | null;
  payment_proof_path: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_submitted_by_partner: { id: number; name: string; email: string } | null;
  notes: string | null;
  received_at: string | null;
  last_overdue_notified_at: string | null;
  created_at: string | null;
  created_by_admin: { id: number; name: string; email: string } | null;
  received_by_admin: { id: number; name: string; email: string } | null;
}

export function fetchAdminOrders(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  restaurant_id?: number;
  rider_id?: number | "unassigned";
  search?: string;
}): Promise<Paginated<AdminOrderRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.status) q.set("status", params.status);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.restaurant_id != null) q.set("restaurant_id", String(params.restaurant_id));
  if (params?.rider_id != null) q.set("rider_id", String(params.rider_id));
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<AdminOrderRow>>(`/orders${qs ? `?${qs}` : ""}`);
}

export function fetchAdminOrder(id: number): Promise<AdminOrderDetail> {
  return adminFetch<AdminOrderDetail>(`/orders/${id}`);
}

export function updateAdminOrderStatus(
  id: number,
  body: { status: string; note?: string | null; cancellation_reason?: string | null }
): Promise<{ message: string; order: AdminOrderDetail }> {
  return adminFetch<{ message: string; order: AdminOrderDetail }>(`/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function addAdminOrderSupportNote(
  id: number,
  body: { note_type: AdminSupportNote["note_type"]; body: string }
): Promise<AdminSupportNote> {
  return adminFetch<AdminSupportNote>(`/orders/${id}/support-notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function assignAdminOrderRider(
  id: number,
  body: { rider_id: number | null; note?: string | null }
): Promise<{ message: string; order: AdminOrderDetail }> {
  return adminFetch<{ message: string; order: AdminOrderDetail }>(`/orders/${id}/assign-rider`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function addAdminOrderNote(
  id: number,
  note: string
): Promise<{ message: string; note: AdminOrderNote }> {
  return adminFetch<{ message: string; note: AdminOrderNote }>(`/orders/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function fetchAdminOrderSummary(): Promise<AdminOrderSummary> {
  return adminFetch<AdminOrderSummary>("/orders/summary");
}

export function fetchAdminRiders(params?: {
  page?: number;
  per_page?: number;
  active?: boolean;
  search?: string;
}): Promise<Paginated<AdminRiderOption>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.active != null) q.set("active", params.active ? "1" : "0");
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<AdminRiderOption>>(`/riders${qs ? `?${qs}` : ""}`);
}

export function fetchAdminRider(id: number): Promise<AdminRiderDetail> {
  return adminFetch<AdminRiderDetail>(`/riders/${id}`);
}

export function setAdminRiderActive(id: number, is_active: boolean): Promise<AdminRiderOption> {
  return adminFetch<AdminRiderOption>(`/riders/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active }),
  });
}

export function fetchAdminSettings(): Promise<AdminOperationalSettings> {
  return adminFetch<AdminOperationalSettings>("/settings");
}

export function updateAdminSettings(
  body: AdminOperationalSettings
): Promise<AdminOperationalSettings> {
  return adminFetch<AdminOperationalSettings>("/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchAdminSettlements(params?: {
  page?: number;
  per_page?: number;
  restaurant_id?: number;
  status?: "pending" | "settled";
  date_from?: string;
  date_to?: string;
}): Promise<Paginated<AdminSettlementRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.restaurant_id) q.set("restaurant_id", String(params.restaurant_id));
  if (params?.status) q.set("status", params.status);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return adminFetch<Paginated<AdminSettlementRow>>(`/settlements${qs ? `?${qs}` : ""}`);
}

export function generateAdminSettlement(payload: {
  restaurant_id: number;
  period_from: string;
  period_to: string;
  notes?: string | null;
}): Promise<{ message: string; settlement: AdminSettlementRow }> {
  return adminFetch<{ message: string; settlement: AdminSettlementRow }>("/settlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markAdminSettlementStatus(
  id: number,
  payload: {
    status?: "pending" | "settled";
    reference_number?: string | null;
    notes?: string | null;
  }
): Promise<{ message: string; settlement: AdminSettlementRow }> {
  return adminFetch<{ message: string; settlement: AdminSettlementRow }>(`/settlements/${id}/mark-settled`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runAdminSettlementOverdueAction(
  id: number,
  payload: {
    action: "notify" | "pause" | "suspend";
    note?: string | null;
  }
): Promise<{ message: string; settlement: AdminSettlementRow }> {
  return adminFetch<{ message: string; settlement: AdminSettlementRow }>(`/settlements/${id}/overdue-action`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminCommissionCollections(params?: {
  page?: number;
  per_page?: number;
  restaurant_id?: number;
  status?: "pending" | "received";
  date_from?: string;
  date_to?: string;
}): Promise<Paginated<AdminCommissionCollectionRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.restaurant_id) q.set("restaurant_id", String(params.restaurant_id));
  if (params?.status) q.set("status", params.status);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return adminFetch<Paginated<AdminCommissionCollectionRow>>(`/commission-collections${qs ? `?${qs}` : ""}`);
}

export function createAdminCommissionCollection(payload: {
  restaurant_id: number;
  period_from: string;
  period_to: string;
  notes?: string | null;
}): Promise<{ message: string; collection: AdminCommissionCollectionRow }> {
  return adminFetch<{ message: string; collection: AdminCommissionCollectionRow }>("/commission-collections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createAdminCommissionCollectionsForAll(payload: {
  period_from: string;
  period_to: string;
  notes?: string | null;
}): Promise<{ message: string; collections: AdminCommissionCollectionRow[] }> {
  return adminFetch<{ message: string; collections: AdminCommissionCollectionRow[] }>("/commission-collections/generate-all", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markAdminCommissionCollection(
  id: number,
  payload: {
    status?: "pending" | "received";
    collection_reference?: string | null;
    notes?: string | null;
  }
): Promise<{ message: string; collection: AdminCommissionCollectionRow }> {
  return adminFetch<{ message: string; collection: AdminCommissionCollectionRow }>(`/commission-collections/${id}/mark-received`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface PartnerApplicationRow {
  id: number;
  owner_first_name: string;
  owner_last_name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type_id: number;
  business_category_id: number | null;
  cuisine_id: number | null;
  address: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  business_type: { id: number; name: string; slug: string } | null;
  business_category: { id: number; name: string } | null;
  cuisine: { id: number; name: string } | null;
  reviewer: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

export function fetchPartnerApplications(params: {
  page?: number;
  status?: string;
  search?: string;
}): Promise<Paginated<PartnerApplicationRow>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<PartnerApplicationRow>>(
    `/partner-applications${qs ? `?${qs}` : ""}`
  );
}

export function fetchPartnerApplication(id: number): Promise<PartnerApplicationRow> {
  return adminFetch<PartnerApplicationRow>(`/partner-applications/${id}`);
}

export function approvePartnerApplication(
  id: number,
  body?: { admin_notes?: string | null }
): Promise<PartnerApplicationRow> {
  return adminFetch<PartnerApplicationRow>(`/partner-applications/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function rejectPartnerApplication(
  id: number,
  body?: { admin_notes?: string | null }
): Promise<PartnerApplicationRow> {
  return adminFetch<PartnerApplicationRow>(`/partner-applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export interface RiderApplicationRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  id_document_url: string | null;
  license_document_url: string | null;
  id_document_signed_url: string | null;
  license_document_signed_url: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewer: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

export function fetchRiderApplications(params: {
  page?: number;
  status?: string;
  search?: string;
}): Promise<Paginated<RiderApplicationRow>> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return adminFetch<Paginated<RiderApplicationRow>>(`/rider-applications${qs ? `?${qs}` : ""}`);
}

export function approveRiderApplication(
  id: number,
  body?: { admin_notes?: string | null }
): Promise<RiderApplicationRow> {
  return adminFetch<RiderApplicationRow>(`/rider-applications/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function rejectRiderApplication(
  id: number,
  body?: { admin_notes?: string | null }
): Promise<RiderApplicationRow> {
  return adminFetch<RiderApplicationRow>(`/rider-applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export interface BusinessTypeRow {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  requires_category: boolean;
  requires_cuisine: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export function fetchBusinessTypes(params?: {
  page?: number;
  per_page?: number;
  active_only?: boolean;
}): Promise<Paginated<BusinessTypeRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.active_only) q.set("active_only", "1");
  const qs = q.toString();
  return adminFetch<Paginated<BusinessTypeRow>>(`/business-types${qs ? `?${qs}` : ""}`);
}

export function createBusinessType(body: Record<string, unknown>): Promise<BusinessTypeRow> {
  return adminFetch<BusinessTypeRow>("/business-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBusinessType(id: number, body: Record<string, unknown>): Promise<BusinessTypeRow> {
  return adminFetch<BusinessTypeRow>(`/business-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteBusinessType(id: number): Promise<void> {
  return adminFetch<void>(`/business-types/${id}`, { method: "DELETE" });
}

export interface BusinessCategoryRow {
  id: number;
  business_type_id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  business_type?: { id: number; name: string; slug: string };
  created_at: string | null;
  updated_at: string | null;
}

export function fetchBusinessCategories(params?: {
  page?: number;
  per_page?: number;
  business_type_id?: number;
  active_only?: boolean;
}): Promise<Paginated<BusinessCategoryRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.business_type_id) q.set("business_type_id", String(params.business_type_id));
  if (params?.active_only) q.set("active_only", "1");
  const qs = q.toString();
  return adminFetch<Paginated<BusinessCategoryRow>>(
    `/business-categories${qs ? `?${qs}` : ""}`
  );
}

export function createBusinessCategory(body: Record<string, unknown>): Promise<BusinessCategoryRow> {
  return adminFetch<BusinessCategoryRow>("/business-categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBusinessCategory(
  id: number,
  body: Record<string, unknown>
): Promise<BusinessCategoryRow> {
  return adminFetch<BusinessCategoryRow>(`/business-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteBusinessCategory(id: number): Promise<void> {
  return adminFetch<void>(`/business-categories/${id}`, { method: "DELETE" });
}

export interface CuisineRow {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export function fetchCuisines(params?: {
  page?: number;
  per_page?: number;
  active_only?: boolean;
}): Promise<Paginated<CuisineRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.active_only) q.set("active_only", "1");
  const qs = q.toString();
  return adminFetch<Paginated<CuisineRow>>(`/cuisines${qs ? `?${qs}` : ""}`);
}

export function createCuisine(body: Record<string, unknown>): Promise<CuisineRow> {
  return adminFetch<CuisineRow>("/cuisines", { method: "POST", body: JSON.stringify(body) });
}

export function updateCuisine(id: number, body: Record<string, unknown>): Promise<CuisineRow> {
  return adminFetch<CuisineRow>(`/cuisines/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteCuisine(id: number): Promise<void> {
  return adminFetch<void>(`/cuisines/${id}`, { method: "DELETE" });
}

export interface MenuCategoryRow {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export function fetchMenuCategories(params?: {
  page?: number;
  per_page?: number;
  active_only?: boolean;
}): Promise<Paginated<MenuCategoryRow>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  if (params?.active_only) q.set("active_only", "1");
  const qs = q.toString();
  return adminFetch<Paginated<MenuCategoryRow>>(`/menu-categories${qs ? `?${qs}` : ""}`);
}

export function createMenuCategory(body: Record<string, unknown>): Promise<MenuCategoryRow> {
  return adminFetch<MenuCategoryRow>("/menu-categories", { method: "POST", body: JSON.stringify(body) });
}

export function updateMenuCategory(id: number, body: Record<string, unknown>): Promise<MenuCategoryRow> {
  return adminFetch<MenuCategoryRow>(`/menu-categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteMenuCategory(id: number): Promise<void> {
  return adminFetch<void>(`/menu-categories/${id}`, { method: "DELETE" });
}
