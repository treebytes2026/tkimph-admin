"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { Check, MapPin, ShoppingBag } from "lucide-react";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import { CheckoutAuthPanel } from "@/components/checkout/checkout-auth-panel";
import { useCart } from "@/contexts/cart-context";
import { publicFileUrl } from "@/lib/public-api";
import { AUTH_CHANGED_EVENT, getStoredUser, type AuthUser } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatPhpSpaced(amount: number): string {
  if (Number.isNaN(amount)) return "₱ 0";
  const s = amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `₱ ${s}`;
}

const SERVICE_FEE_PHP = 5;
const DELIVERY_STRIKE_PHP = 19;

export default function CheckoutPage() {
  const { cart, cartRestaurant, cartTotal, cartCount } = useCart();
  const [user, setUser] = useState<AuthUser | null>(null);
  const mounted = useIsClient();
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    syncUser();
    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const grandTotal = useMemo(() => cartTotal + SERVICE_FEE_PHP, [cartTotal]);
  const strikeTotal = useMemo(() => grandTotal + DELIVERY_STRIKE_PHP, [grandTotal]);

  const dMin = cartRestaurant?.delivery_min_minutes ?? 5;
  const dMax = cartRestaurant?.delivery_max_minutes ?? 20;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <TopBanner />
        <Navbar />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <ShoppingBag className="size-16 text-muted-foreground/35" strokeWidth={1.25} />
          <h1 className="mt-6 text-xl font-bold text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add something from a restaurant menu before checkout.</p>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "default" }), "mt-8 rounded-xl font-semibold")}
          >
            Browse restaurants
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Left: auth or delivery step */}
          <div className="min-w-0">
            {!user ? (
              <CheckoutAuthPanel onSignedIn={(u) => setUser(u)} />
            ) : (
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Delivery details
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user.email}</span>
                </p>
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-4">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Delivery address</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Address selection will be available in a future update. For now you can continue to place your
                      order.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-8 h-12 w-full rounded-xl border-0 bg-primary text-[15px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Place order
                </Button>
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <aside className="min-w-0 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                <div className="flex w-full rounded-full border border-border/50 bg-muted/70 p-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("delivery")}
                    className={cn(
                      "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                      deliveryMode === "delivery"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("pickup")}
                    className={cn(
                      "flex-1 rounded-full py-2.5 text-sm font-semibold transition",
                      deliveryMode === "pickup"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    Pick-up
                  </button>
                </div>
                {deliveryMode === "delivery" ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Standard {dMin}–{dMax} mins
                  </p>
                ) : (
                  <p className="mt-2 text-center text-xs text-muted-foreground">Pick up at the restaurant</p>
                )}
              </div>

              {cartRestaurant ? (
                <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted">
                    {publicFileUrl(cartRestaurant.profile_image_path, cartRestaurant.profile_image_url) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={publicFileUrl(cartRestaurant.profile_image_path, cartRestaurant.profile_image_url)!}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Image src="/tkimlogo.png" alt="" width={24} height={24} className="rounded opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{cartRestaurant.name}</p>
                    <p className="text-xs text-muted-foreground">{cartCount} items</p>
                  </div>
                </div>
              ) : null}

              <div className="px-4 py-4">
                <h2 className="text-sm font-bold text-foreground">Your items</h2>
                <ul className="mt-3 space-y-4">
                  {cart.map((line) => {
                    const thumb = publicFileUrl(line.item.image_path, line.item.image_url);
                    const lineTotal = parseFloat(line.item.price) * line.qty;
                    return (
                      <li key={line.item.id} className="flex gap-3">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {thumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={thumb} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <ShoppingBag className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight text-foreground">{line.item.name}</p>
                          <p className="text-xs text-muted-foreground">{line.qty}×</p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatPhpSpaced(lineTotal)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border/60 px-4 py-4 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums text-foreground">{formatPhpSpaced(cartTotal)}</span>
                </div>
                {deliveryMode === "delivery" ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Standard delivery</span>
                    <span className="text-right">
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPhpSpaced(DELIVERY_STRIKE_PHP)}
                      </span>{" "}
                      <span className="font-semibold text-primary">Free</span>
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Service fee</span>
                  <span className="font-medium tabular-nums text-foreground">{formatPhpSpaced(SERVICE_FEE_PHP)}</span>
                </div>
              </div>

              <div className="border-t-4 border-primary bg-primary/10 px-4 py-3">
                <div className="flex gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    You&apos;ve got free delivery on your first order.
                  </p>
                </div>
              </div>

              <div className="border-t border-border/80 bg-muted/20 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-foreground">Total</p>
                    <p className="text-xs text-muted-foreground">(Incl. fees and tax)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-foreground">{formatPhpSpaced(grandTotal)}</p>
                    <p className="text-xs text-muted-foreground line-through">{formatPhpSpaced(strikeTotal)}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
