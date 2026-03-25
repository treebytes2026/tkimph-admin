import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

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

export interface PartnerOverviewRestaurant {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  business_type: { id: number; name: string } | null;
  business_category: { id: number; name: string } | null;
  cuisine: { id: number; name: string } | null;
}

export interface PartnerOverviewResponse {
  user: PartnerOverviewUser;
  restaurants: PartnerOverviewRestaurant[];
}

export async function fetchPartnerOverview(): Promise<PartnerOverviewResponse> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/partner/overview`, { headers });

  if (res.status === 401) {
    throw new PartnerApiError("Please sign in again.", 401);
  }

  if (res.status === 403) {
    throw new PartnerApiError("Partner access only.", 403);
  }

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText || "Request failed";
    try {
      const data = JSON.parse(text) as { message?: string };
      if (data.message) msg = data.message;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new PartnerApiError(msg, res.status);
  }

  return res.json() as Promise<PartnerOverviewResponse>;
}
