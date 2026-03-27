const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/** Fired when token/user in localStorage change in this tab (logout, login, 401). Same-tab `storage` events do not exist in browsers. */
export const AUTH_CHANGED_EVENT = "tkimph:auth-changed";

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  address?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

async function authRequest(path: string, credentials: LoginCredentials): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Login failed");
  }

  const data: AuthResponse = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  notifyAuthChanged();
  return data;
}

export function loginCustomer(credentials: LoginCredentials): Promise<AuthResponse> {
  return authRequest("/login", credentials);
}

export function loginAdmin(credentials: LoginCredentials): Promise<AuthResponse> {
  return authRequest("/admin/login", credentials);
}

export async function getUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const res = await fetch(`${API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    notifyAuthChanged();
    return null;
  }

  return res.json();
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem("token");
  if (token) {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }).catch(() => {});
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  notifyAuthChanged();
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("user");
  return data ? JSON.parse(data) : null;
}
