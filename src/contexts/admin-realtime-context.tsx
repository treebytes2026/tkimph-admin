"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchRegistrationStats,
  fetchUnreadNotificationCount,
  type RegistrationStats,
} from "@/lib/admin-api";

const POLL_MS = 12_000;

type AdminRealtimeContextValue = {
  registrationStats: RegistrationStats | null;
  unreadNotificationCount: number;
  refresh: () => Promise<void>;
  lastUpdatedAt: number | null;
};

const AdminRealtimeContext = createContext<AdminRealtimeContextValue | null>(null);

export function AdminRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [registrationStats, setRegistrationStats] = useState<RegistrationStats | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [stats, unread] = await Promise.all([
        fetchRegistrationStats(),
        fetchUnreadNotificationCount(),
      ]);
      setRegistrationStats(stats);
      setUnreadNotificationCount(unread.count);
      setLastUpdatedAt(Date.now());
    } catch {
      // Session may be invalid; adminFetch redirects on 401.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
    const interval = window.setInterval(() => void refresh(), POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      registrationStats,
      unreadNotificationCount,
      refresh,
      lastUpdatedAt,
    }),
    [registrationStats, unreadNotificationCount, refresh, lastUpdatedAt]
  );

  return <AdminRealtimeContext.Provider value={value}>{children}</AdminRealtimeContext.Provider>;
}

export function useAdminRealtime(): AdminRealtimeContextValue {
  const ctx = useContext(AdminRealtimeContext);
  if (!ctx) {
    throw new Error("useAdminRealtime must be used within AdminRealtimeProvider");
  }
  return ctx;
}
