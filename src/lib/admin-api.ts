import { ADMIN_LOGIN_PATH } from "@/lib/routes";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

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
  owner: { id: number; name: string; email: string; role: string } | null;
  business_type: { id: number; name: string; slug: string } | null;
  business_category: { id: number; name: string } | null;
  cuisine: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
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
  type?: string;
  id?: number;
  business_name?: string;
  owner_name?: string;
  email?: string;
  name?: string;
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
