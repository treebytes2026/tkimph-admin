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
  is_active: boolean;
  owner: { id: number; name: string; email: string; role: string } | null;
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
