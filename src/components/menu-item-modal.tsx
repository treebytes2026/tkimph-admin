"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, UtensilsCrossed, X } from "lucide-react";
import { publicFileUrl, type PublicMenuItem } from "@/lib/public-api";
import { cn } from "@/lib/utils";

/** Spaced peso like Foodpanda (₱ 195). */
function formatPriceLine(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "₱ 0";
  const s = n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `₱ ${s}`;
}

export type MenuItemModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PublicMenuItem | null;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToCart: () => void;
};

const ANIM_MS = 320;

export function MenuItemModal({
  open,
  onOpenChange,
  item,
  quantity,
  onQuantityChange,
  onAddToCart,
}: MenuItemModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  /** Keeps content mounted for exit animation after parent clears `item`. */
  const [activeItem, setActiveItem] = useState<PublicMenuItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && item) {
      setActiveItem(item);
      setIsVisible(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    if (!open) {
      setIsVisible(false);
    }
  }, [open, item]);

  useEffect(() => {
    if (!isVisible && activeItem) {
      const t = window.setTimeout(() => setActiveItem(null), ANIM_MS);
      return () => window.clearTimeout(t);
    }
  }, [isVisible, activeItem]);

  useEffect(() => {
    if (!activeItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeItem, onOpenChange]);

  if (!mounted || !activeItem) return null;

  const img = publicFileUrl(activeItem.image_path, activeItem.image_url);

  const node = (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ease-out",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[91] flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-h-[min(92vh,760px)] sm:rounded-2xl",
          isVisible
            ? "translate-y-0 opacity-100 sm:translate-y-0 sm:scale-100"
            : "translate-y-full opacity-0 sm:translate-y-6 sm:scale-[0.96]"
        )}
      >
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-muted sm:h-56">
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={img} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <UtensilsCrossed className="size-16 text-muted-foreground/30" strokeWidth={1.25} />
            </div>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md ring-1 ring-black/5 transition hover:bg-white"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-4">
          <h2 id={titleId} className="text-lg font-bold leading-snug text-foreground sm:text-xl">
            {activeItem.name}
          </h2>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {formatPriceLine(activeItem.price)}
          </p>
          {activeItem.description ? (
            <p className="mt-3 max-h-40 overflow-y-auto text-sm leading-relaxed text-muted-foreground [scrollbar-width:thin] sm:text-[15px]">
              {activeItem.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border/80 bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-0.5 rounded-full border border-border/80 bg-muted/40 p-0.5 shadow-inner">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-foreground transition hover:bg-background"
              aria-label="Decrease quantity"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            >
              <Minus className="size-4" strokeWidth={2} />
            </button>
            <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-foreground">
              {quantity}
            </span>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-foreground transition hover:bg-background"
              aria-label="Increase quantity"
              onClick={() => onQuantityChange(quantity + 1)}
            >
              <Plus className="size-4" strokeWidth={2} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onAddToCart();
              onOpenChange(false);
            }}
            className={cn(
              "h-11 min-w-0 flex-1 rounded-xl text-[15px] font-semibold text-white shadow-sm transition",
              "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
            )}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
