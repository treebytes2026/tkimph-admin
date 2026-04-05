import { notifyAuthChanged } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export class CustomerApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "CustomerApiError";
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

type ParsedError = {
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
};

function messageFromParsed(data: ParsedError): string | null {
  if (data.errors) {
    const first = Object.values(data.errors)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  return null;
}

async function customerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      notifyAuthChanged();
    }
    throw new CustomerApiError("Session expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    let msg = res.statusText || "Request failed";
    try {
      const data = JSON.parse(text) as ParsedError;
      body = data;
      const parsed = messageFromParsed(data);
      if (parsed) msg = parsed;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new CustomerApiError(msg, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
}

export interface CustomerOrderItem {
  id: number;
  menu_item_id: number | null;
  name: string;
  image_path: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface CustomerOrderDiscount {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  audit_meta: Record<string, unknown> | null;
}

export interface CustomerOrderIssue {
  id: number;
  issue_type: "cancel_request" | "refund_request" | "dispute" | "help";
  status: "open" | "under_review" | "resolved" | "rejected";
  subject: string;
  description: string;
  resolution: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface CustomerOrderReview {
  id: number;
  restaurant_rating: number;
  rider_rating: number | null;
  comment: string | null;
  status: string;
  created_at: string | null;
}

export interface CustomerOrderItemReview {
  id: number;
  menu_item_id: number | null;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string | null;
}

export interface CustomerOrder {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  refund_status: string;
  refund_requested_at: string | null;
  refunded_at: string | null;
  refund_reference: string | null;
  refund_reason: string | null;
  delivery_mode: "delivery" | "pickup";
  delivery_address: string;
  delivery_floor: string | null;
  delivery_note: string | null;
  location_label: string | null;
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  discounts_total: number;
  total: number;
  placed_at: string | null;
  customer_cancel_requested_at: string | null;
  customer_cancel_reason: string | null;
  customer_cancel_eligible: boolean;
  restaurant: {
    id: number;
    name: string;
    slug: string | null;
    address: string | null;
    profile_image_path: string | null;
    profile_image_url: string | null;
  } | null;
  rider: {
    id: number;
    name: string;
    phone: string | null;
  } | null;
  items: CustomerOrderItem[];
  discounts: CustomerOrderDiscount[];
  issues: CustomerOrderIssue[];
  review: CustomerOrderReview | null;
  timeline: Array<{
    id: number;
    event_type: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    actor: { id: number; name: string; role: string } | null;
    meta: Record<string, unknown> | null;
    created_at: string | null;
  }>;
  live_location: {
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    recorded_at: string | null;
  } | null;
}

export function fetchCustomerProfile(): Promise<CustomerProfile> {
  return customerRequest<CustomerProfile>("/user");
}

export function updateCustomerProfile(payload: {
  name: string;
  email: string;
  phone: string;
  address?: string | null;
}): Promise<{ message: string; user: CustomerProfile }> {
  return customerRequest<{ message: string; user: CustomerProfile }>("/customer/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function sendCustomerEmailVerification(): Promise<{ message: string }> {
  return customerRequest<{ message: string }>("/customer/email/send-verification", {
    method: "POST",
  });
}

export function verifyCustomerEmailCode(code: string): Promise<{ message: string; user: CustomerProfile }> {
  return customerRequest<{ message: string; user: CustomerProfile }>("/customer/email/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function sendCustomerPhoneVerification(): Promise<{ message: string }> {
  return customerRequest<{ message: string }>("/customer/phone/send-verification", {
    method: "POST",
  });
}

export function verifyCustomerPhoneCode(code: string): Promise<{ message: string; user: CustomerProfile }> {
  return customerRequest<{ message: string; user: CustomerProfile }>("/customer/phone/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function changeCustomerPassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return customerRequest<{ message: string }>("/customer/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteCustomerAccount(password: string): Promise<{ message: string }> {
  return customerRequest<{ message: string }>("/customer/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

export function placeCustomerOrder(payload: {
  restaurant_id: number;
  delivery_mode: "delivery" | "pickup";
  payment_method: "cod" | "wallet" | "card";
  promo_code?: string | null;
  delivery_address: string;
  delivery_floor?: string | null;
  delivery_note?: string | null;
  location_label?: string | null;
  items: Array<{ item_id: number; qty: number }>;
}): Promise<{ message: string; order: CustomerOrder }> {
  return customerRequest<{ message: string; order: CustomerOrder }>("/customer/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function validateCustomerPromotion(payload: {
  code: string;
  subtotal: number;
  restaurant_id?: number;
}): Promise<{
  valid: boolean;
  code: string | null;
  discount_amount: number;
  audit_meta: Record<string, unknown> | null;
  invalid_reasons?: Record<string, unknown>;
  message: string;
}> {
  return customerRequest("/customer/promotions/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestCustomerOrderCancel(orderId: number, reason: string): Promise<{
  message: string;
  issue: CustomerOrderIssue;
  order: CustomerOrder;
}> {
  return customerRequest(`/customer/orders/${orderId}/cancel-request`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function createCustomerOrderIssue(
  orderId: number,
  payload: {
    issue_type: "refund_request" | "dispute" | "help";
    subject: string;
    description: string;
  }
): Promise<{ message: string; issue: CustomerOrderIssue }> {
  return customerRequest(`/customer/orders/${orderId}/issues`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitCustomerOrderReview(
  orderId: number,
  payload: {
    restaurant_rating: number;
    rider_rating?: number | null;
    comment?: string | null;
  }
): Promise<{ message: string; review: CustomerOrderReview }> {
  return customerRequest(`/customer/orders/${orderId}/reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reportCustomerReview(
  reviewId: number,
  payload: { reason: string; details?: string | null }
): Promise<{ message: string; report_id: number }> {
  return customerRequest(`/customer/reviews/${reviewId}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitCustomerOrderItemReview(
  orderId: number,
  payload: {
    menu_item_id: number;
    rating: number;
    comment?: string | null;
  }
): Promise<{ message: string; review: CustomerOrderItemReview }> {
  return customerRequest(`/customer/orders/${orderId}/item-reviews`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCustomerOrders(perPage = 10): Promise<{
  data: CustomerOrder[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}> {
  return customerRequest<{
    data: CustomerOrder[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }>(`/customer/orders?per_page=${perPage}`);
}

export function fetchCustomerOrder(orderId: number): Promise<{ order: CustomerOrder }> {
  return customerRequest<{ order: CustomerOrder }>(`/customer/orders/${orderId}`);
}

export function submitCustomerHelpCenterConcern(payload: { subject: string; message: string }): Promise<{ message: string }> {
  return customerRequest<{ message: string }>("/customer/help-center", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
