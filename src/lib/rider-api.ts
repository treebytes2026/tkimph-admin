import { getStoredToken, notifyAuthChanged } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export class RiderApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "RiderApiError";
    this.status = status;
    this.body = body;
  }
}

function parseErrorMessage(data: { message?: string; error?: string; errors?: Record<string, string[]> }): string {
  if (data.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  return data.message || data.error || "Request failed";
}

async function riderRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      notifyAuthChanged();
    }
    throw new RiderApiError("Session expired. Please sign in again.", 401);
  }

  if (res.status === 403) {
    throw new RiderApiError("Rider access required.", 403);
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText || "Request failed";
    let body: unknown = text;
    try {
      const data = JSON.parse(text) as { message?: string; error?: string; errors?: Record<string, string[]> };
      body = data;
      msg = parseErrorMessage(data);
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new RiderApiError(msg, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RiderOverviewResponse {
  rider: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
  };
  active_orders_count: number;
  completed_today_count: number;
}

export interface RiderProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
}

export interface RiderOrder {
  id: number;
  order_number: string;
  status: string;
  delivery_mode: string;
  delivery_address: string;
  delivery_floor: string | null;
  delivery_note: string | null;
  placed_at: string | null;
  total: number;
  customer: { id: number; name: string; phone: string | null } | null;
  restaurant: { id: number; name: string; phone: string | null } | null;
}

export interface RiderOrdersResponse {
  data: RiderOrder[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export function fetchRiderOverview(): Promise<RiderOverviewResponse> {
  return riderRequest<RiderOverviewResponse>("/rider/overview");
}

export function fetchRiderProfile(): Promise<RiderProfile> {
  return riderRequest<RiderProfile>("/rider/profile");
}

export function updateRiderProfile(payload: {
  name: string;
  email: string;
  phone: string;
  address?: string | null;
}): Promise<{ message: string; user: RiderProfile }> {
  return riderRequest<{ message: string; user: RiderProfile }>("/rider/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changeRiderPassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return riderRequest<{ message: string }>("/rider/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchRiderOrders(status?: string): Promise<RiderOrdersResponse> {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  const qs = q.toString();
  return riderRequest<RiderOrdersResponse>(`/rider/orders${qs ? `?${qs}` : ""}`);
}

export function fetchAvailableRiderOrders(): Promise<RiderOrdersResponse> {
  return riderRequest<RiderOrdersResponse>("/rider/orders/available");
}

export function setRiderAvailability(isActive: boolean): Promise<{ id: number; is_active: boolean }> {
  return riderRequest<{ id: number; is_active: boolean }>("/rider/availability", {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function updateRiderOrderStatus(orderId: number, status: string, note?: string | null): Promise<{
  message: string;
  order: RiderOrder;
}> {
  return riderRequest<{ message: string; order: RiderOrder }>(`/rider/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note: note ?? null }),
  });
}

export function sendRiderLocationPing(
  orderId: number,
  payload: { latitude: number; longitude: number; accuracy_meters?: number | null }
): Promise<{ message: string }> {
  return riderRequest<{ message: string }>(`/rider/orders/${orderId}/location`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function claimRiderOrder(orderId: number): Promise<{ message: string; order: RiderOrder }> {
  return riderRequest<{ message: string; order: RiderOrder }>(`/rider/orders/${orderId}/claim`, {
    method: "POST",
  });
}
