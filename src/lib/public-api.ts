const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

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
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
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
  notes?: string | null;
}

export function submitRiderApplication(
  payload: RiderApplicationPayload
): Promise<{ message: string; id: number }> {
  return publicFetch("/rider-applications", {
    method: "POST",
    body: JSON.stringify(payload),
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
