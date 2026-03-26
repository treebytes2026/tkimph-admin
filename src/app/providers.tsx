"use client";

import { CartProvider } from "@/contexts/cart-context";
import { CartDrawer } from "@/components/cart-drawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
