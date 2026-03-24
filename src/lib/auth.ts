const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/login`, {
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
  return data;
}

export async function getUser(): Promise<User | null> {
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
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("user");
  return data ? JSON.parse(data) : null;
}
