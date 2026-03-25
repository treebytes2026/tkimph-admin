"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Search,
  MapPin,
  ShoppingBag,
  Globe,
  ChevronDown,
  Bike,
  Store,
  ShoppingBasket,
  X,
} from "lucide-react";
import { useState } from "react";

export function TopBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="relative bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide sm:gap-4 sm:text-xs">
        <Link
          href="/partner/register"
          className="rounded-full border border-white/35 px-3 py-1.5 transition hover:bg-white/10 sm:px-4"
        >
          Sign up to be a restaurant partner
        </Link>
        <Link
          href="/partner/business-account"
          className="rounded-full border border-white/35 px-3 py-1.5 transition hover:bg-white/10 sm:px-4"
        >
          Sign up for a business account
        </Link>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-secondary-foreground/80 transition hover:bg-white/10 hover:text-secondary-foreground sm:right-4"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

const serviceTabs = [
  { label: "Delivery", icon: Bike, active: true },
  { label: "Pick-up", icon: Store, active: false },
  { label: "Mart", icon: ShoppingBasket, active: false },
  { label: "Shops", icon: Store, active: false },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white shadow-[0_1px_0_oklch(0.48_0.16_145/0.07)]">
      {/* Row 1 */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/tkimlogo.png"
              alt="TKimph"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span className="hidden text-xl font-bold tracking-tight text-primary sm:inline">
              tkimph
            </span>
          </Link>
          <button
            type="button"
            className="hidden min-w-0 items-center gap-2 text-left text-sm transition md:flex"
          >
            <MapPin className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              <span className="block text-muted-foreground">Deliver to</span>
              <span className="flex items-center gap-0.5 font-semibold text-foreground">
                Select your address
                <ChevronDown className="size-4 text-muted-foreground" />
              </span>
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted lg:flex"
          >
            <Globe className="size-4 text-muted-foreground" />
            EN
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-primary/25 font-semibold text-primary hover:bg-primary/5"
            >
              Log in
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="sm"
              className="rounded-full border-0 bg-brand-yellow px-3 font-semibold text-brand-yellow-foreground shadow-sm hover:brightness-95 sm:px-4"
            >
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Sign up for free delivery</span>
            </Button>
          </Link>
          <button
            type="button"
            className="relative rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Cart"
          >
            <ShoppingBag className="size-5" />
          </button>
        </div>
      </div>

      {/* Row 2: tabs + search */}
      <div className="border-t border-border/60 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <nav className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {serviceTabs.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                  item.active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="size-4 opacity-80" />
                {item.label}
              </button>
            ))}
          </nav>
          <label className="flex w-full min-w-0 flex-1 items-center gap-3 rounded-full border border-border bg-muted/80 px-4 py-2.5 shadow-inner transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 sm:max-w-xl lg:max-w-2xl">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search for restaurants, cuisines, and dishes"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <Image
                src="/tkimlogo.png"
                alt="TKimph"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold">tkimph</span>
            </div>
            <p className="text-sm text-secondary-foreground/75">
              Your favorite food, delivered fast to your door.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  About us
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Contact
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Help center
                </Link>
              </li>
              <li>
                <Link href="/partner/register" className="transition hover:text-secondary-foreground">
                  Partner with us
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-secondary-foreground">
                  Partner sign in
                </Link>
              </li>
              <li>
                <Link href="/rider/register" className="transition hover:text-secondary-foreground">
                  Ride with us
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/75">
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-secondary-foreground">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row">
          <p className="text-sm text-secondary-foreground/60">
            &copy; {new Date().getFullYear()} TKimph. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs text-secondary-foreground/50">Available on</span>
            <span className="rounded-full border border-white/25 px-3 py-1 text-sm font-medium">
              App Store
            </span>
            <span className="rounded-full border border-white/25 px-3 py-1 text-sm font-medium">
              Play Store
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
