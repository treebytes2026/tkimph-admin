"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_CHANGED_EVENT, getStoredUser } from "@/lib/auth";
import type { PublicMenuItem, PublicRestaurant } from "@/lib/public-api";

export type CartLine = { item: PublicMenuItem; qty: number };

/** Legacy single key — migrated to `:guest` once. */
const LEGACY_CART_KEY = "tkimph:cart-v1";

function storageKeyForUser(userId: number | null): string {
  return userId != null ? `tkimph:cart-v1:user:${userId}` : "tkimph:cart-v1:guest";
}

type PersistedCartPayload = {
  v: 1;
  cart: CartLine[];
  cartRestaurant: PublicRestaurant | null;
};

function parsePayload(raw: string): PersistedCartPayload | null {
  try {
    const data = JSON.parse(raw) as PersistedCartPayload;
    if (data.v !== 1 || !Array.isArray(data.cart)) return null;
    return data;
  } catch {
    return null;
  }
}

function loadCartFromStorage(key: string): PersistedCartPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return parsePayload(raw);
  } catch {
    return null;
  }
}

/** Guest: also migrate legacy undifferentiated cart once. */
function loadGuestCartWithMigration(): PersistedCartPayload | null {
  const guestKey = storageKeyForUser(null);
  const fromGuest = loadCartFromStorage(guestKey);
  if (fromGuest) return fromGuest;

  const legacy = loadCartFromStorage(LEGACY_CART_KEY);
  if (!legacy) return null;
  try {
    localStorage.setItem(guestKey, JSON.stringify({ v: 1, cart: legacy.cart, cartRestaurant: legacy.cartRestaurant }));
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    // ignore
  }
  return legacy;
}

function loadCartForAuthUserId(userId: number | null): PersistedCartPayload | null {
  if (userId != null) {
    return loadCartFromStorage(storageKeyForUser(userId));
  }
  return loadGuestCartWithMigration();
}

function saveCartToStorage(
  cart: CartLine[],
  cartRestaurant: PublicRestaurant | null,
  userId: number | null
) {
  if (typeof window === "undefined") return;
  try {
    const key = storageKeyForUser(userId);
    const payload: PersistedCartPayload = {
      v: 1,
      cart,
      cartRestaurant,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

type CartContextValue = {
  cartRestaurant: PublicRestaurant | null;
  /** Call when a restaurant menu page loads; clears cart if switching restaurants. */
  registerCartRestaurant: (r: PublicRestaurant) => void;
  cart: CartLine[];
  addToCart: (item: PublicMenuItem) => void;
  setQty: (itemId: number, qty: number) => void;
  setLineQuantity: (item: PublicMenuItem, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartRestaurant, setCartRestaurant] = useState<PublicRestaurant | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** `undefined` until we know guest vs user id (avoids saving to wrong key). */
  const [authUserId, setAuthUserId] = useState<number | null | undefined>(undefined);
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    const syncAuth = () => setAuthUserId(getStoredUser()?.id ?? null);
    queueMicrotask(syncAuth);
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  // Layout: apply stored cart for this user/guest before the save effect runs (avoids writing the previous user's cart into the new bucket).
  useLayoutEffect(() => {
    if (authUserId === undefined) return;
    const saved = loadCartForAuthUserId(authUserId);
    queueMicrotask(() => {
      setCart(saved?.cart ?? []);
      setCartRestaurant(saved?.cartRestaurant ?? null);
      setCartHydrated(true);
    });
  }, [authUserId]);

  useEffect(() => {
    if (authUserId === undefined || !cartHydrated) return;
    saveCartToStorage(cart, cartRestaurant, authUserId);
  }, [cart, cartRestaurant, authUserId, cartHydrated]);

  const registerCartRestaurant = useCallback((r: PublicRestaurant) => {
    setCartRestaurant((prev) => {
      if (prev && prev.id !== r.id) {
        setCart([]);
      }
      return r;
    });
  }, []);

  const addToCart = useCallback((item: PublicMenuItem) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.item.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((itemId: number, qty: number) => {
    if (qty < 1) {
      setCart((prev) => prev.filter((l) => l.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.item.id === itemId ? { ...l, qty } : l))
    );
  }, []);

  const setLineQuantity = useCallback((item: PublicMenuItem, qty: number) => {
    if (qty < 1) {
      setCart((prev) => prev.filter((l) => l.item.id !== item.id));
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((l) => l.item.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty };
        return next;
      }
      return [...prev, { item, qty }];
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartRestaurant(null);
    setDrawerOpen(false);
    if (authUserId !== undefined) {
      saveCartToStorage([], null, authUserId);
    }
  }, [authUserId]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + parseFloat(l.item.price) * l.qty, 0),
    [cart]
  );

  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cartRestaurant,
      registerCartRestaurant,
      cart,
      addToCart,
      setQty,
      setLineQuantity,
      clearCart,
      cartTotal,
      cartCount,
      drawerOpen,
      setDrawerOpen,
    }),
    [
      cartRestaurant,
      registerCartRestaurant,
      cart,
      addToCart,
      setQty,
      setLineQuantity,
      clearCart,
      cartTotal,
      cartCount,
      drawerOpen,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

/** Safe for Navbar when provider might not wrap (should not happen if layout is correct). */
export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}
