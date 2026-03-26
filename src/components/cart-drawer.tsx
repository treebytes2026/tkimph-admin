"use client";

import { useEffect, useId, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/contexts/cart-context";
import { publicFileUrl } from "@/lib/public-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatPhpSpaced(amount: number): string {
  if (Number.isNaN(amount)) return "₱ 0";
  const s = amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `₱ ${s}`;
}

export function CartDrawer() {
  const router = useRouter();
  const {
    drawerOpen,
    setDrawerOpen,
    cartRestaurant,
    cart,
    setQty,
    addToCart,
    clearCart,
    cartTotal,
  } = useCart();

  const titleId = useId();
  const mounted = useIsClient();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!drawerOpen) {
      queueMicrotask(() => setVisible(false));
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!mounted || !drawerOpen) return null;

  const profileSrc = cartRestaurant
    ? publicFileUrl(cartRestaurant.profile_image_path, cartRestaurant.profile_image_url)
    : null;

  const dMin = cartRestaurant?.delivery_min_minutes ?? 20;
  const dMax = cartRestaurant?.delivery_max_minutes ?? 40;

  const node = (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/45 transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        aria-label="Close cart"
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-4 py-3">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            Your cart
          </h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {cartRestaurant && cart.length > 0 ? (
          <div className="shrink-0 border-b border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted">
                {profileSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profileSrc} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Image src="/tkimlogo.png" alt="" width={28} height={28} className="rounded-md opacity-50" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">{cartRestaurant.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  {dMin}–{dMax} min
                </p>
              </div>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => clearCart()}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Clear cart"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="size-14 text-muted-foreground/40" strokeWidth={1.25} />
              <p className="mt-4 text-sm font-medium text-foreground">Your cart is empty</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Add items from a restaurant menu — they will show up here.
              </p>
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-xl")}
              >
                Browse restaurants
              </Link>
            </div>
          ) : (
            <ul className="space-y-0 divide-y divide-border/60">
              {cart.map((line) => {
                const thumb = publicFileUrl(line.item.image_path, line.item.image_url);
                const lineTotal = parseFloat(line.item.price) * line.qty;
                return (
                  <li key={line.item.id} className="flex gap-3 py-4 first:pt-0">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <ShoppingBag className="size-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight text-foreground">{line.item.name}</p>
                      <p className="text-xs font-semibold text-primary">{formatPhpSpaced(lineTotal)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1 shadow-sm">
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
                            onClick={() => setQty(line.item.id, line.qty - 1)}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-full hover:bg-muted"
                            onClick={() => addToCart(line.item)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart.length > 0 ? (
          <div className="shrink-0 border-t border-border/80 bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{formatPhpSpaced(cartTotal)}</span>
            </div>
            <Button
              type="button"
              className="mt-4 h-12 w-full rounded-xl border-2 border-foreground bg-background text-[15px] font-semibold text-foreground shadow-sm hover:bg-muted/80"
              onClick={() => {
                setDrawerOpen(false);
                router.push("/checkout");
              }}
            >
              Go to checkout
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );

  return createPortal(node, document.body);
}
