"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import { Button } from "@/components/ui/button";
import {
  Bike,
  Clock,
  MapPin,
  ShieldCheck,
  Store,
  UtensilsCrossed,
  Coffee,
  Sandwich,
  Pizza,
  Cake,
  IceCream,
  Salad,
  ChevronRight,
  Truck,
  QrCode,
  Apple,
  X,
} from "lucide-react";

const cuisines = [
  {
    name: "Filipino",
    icon: UtensilsCrossed,
    ring: "from-amber-400/90 to-orange-600/80",
  },
  {
    name: "Pizza",
    icon: Pizza,
    ring: "from-red-400/90 to-rose-700/80",
  },
  {
    name: "Chicken",
    icon: UtensilsCrossed,
    ring: "from-yellow-400/90 to-amber-700/80",
  },
  {
    name: "Burgers",
    icon: Sandwich,
    ring: "from-amber-500/90 to-yellow-800/80",
  },
  {
    name: "Coffee",
    icon: Coffee,
    ring: "from-stone-400/90 to-stone-700/80",
  },
  {
    name: "Cakes",
    icon: Cake,
    ring: "from-pink-300/90 to-fuchsia-600/80",
  },
  {
    name: "Dessert",
    icon: IceCream,
    ring: "from-sky-300/90 to-indigo-500/80",
  },
  {
    name: "Healthy",
    icon: Salad,
    ring: "from-lime-400/90 to-emerald-600/80",
  },
  {
    name: "Milk tea",
    icon: Coffee,
    ring: "from-orange-200/90 to-amber-900/70",
  },
  {
    name: "Japanese",
    icon: UtensilsCrossed,
    ring: "from-rose-300/90 to-red-800/80",
  },
];

const features = [
  {
    icon: Truck,
    title: "Fast delivery",
    description: "Get your food delivered in 30 minutes or less.",
  },
  {
    icon: Store,
    title: "Best restaurants",
    description: "We partner with the best local restaurants near you.",
  },
  {
    icon: ShieldCheck,
    title: "Secure payments",
    description: "Your transactions are safe and encrypted.",
  },
  {
    icon: Clock,
    title: "24/7 support",
    description: "Our support team is always here to help you.",
  },
];

const popularRestaurants = [
  { name: "Jollibee", category: "Filipino • Fast Food", time: "20-30 min", rating: "4.8" },
  { name: "McDonald's", category: "Burgers • Fast Food", time: "15-25 min", rating: "4.6" },
  { name: "KFC", category: "Chicken • Fast Food", time: "20-30 min", rating: "4.5" },
  { name: "Pizza Hut", category: "Pizza • Italian", time: "25-35 min", rating: "4.4" },
  { name: "Chowking", category: "Chinese • Filipino", time: "15-25 min", rating: "4.3" },
  { name: "Mang Inasal", category: "Filipino • Grill", time: "20-30 min", rating: "4.7" },
];

export default function Home() {
  const cuisineScroll = useRef<HTMLDivElement>(null);
  const [appQrVisible, setAppQrVisible] = useState(true);

  const scrollCuisines = (dir: "left" | "right") => {
    const el = cuisineScroll.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 360);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBanner />
      <Navbar />

      <div className="relative flex flex-1 flex-col">
        {/* Floating app strip — desktop */}
        {appQrVisible ? (
        <aside className="pointer-events-none fixed left-4 top-[calc(50%+3rem)] z-40 hidden -translate-y-1/2 xl:block">
          <div className="pointer-events-auto relative w-[200px] rounded-2xl border border-primary/25 bg-secondary p-4 pt-5 text-secondary-foreground shadow-xl">
            <button
              type="button"
              onClick={() => setAppQrVisible(false)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-secondary-foreground/70 transition hover:bg-white/10 hover:text-secondary-foreground"
              aria-label="Close app download"
            >
              <X className="size-4" />
            </button>
            <p className="px-1 text-center text-xs font-semibold leading-snug text-secondary-foreground/95">
              Unlock more app-only deals. Download now.
            </p>
            <div className="mt-3 flex justify-center rounded-lg bg-white p-2">
              <QrCode className="size-20 text-primary" aria-hidden />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <span className="flex items-center justify-center gap-1.5 rounded-full bg-brand-yellow/20 py-2 text-[11px] font-semibold text-brand-yellow">
                <Apple className="size-3.5" /> App Store
              </span>
              <span className="flex items-center justify-center gap-1.5 rounded-full bg-brand-yellow/20 py-2 text-[11px] font-semibold text-brand-yellow">
                <span className="font-bold text-[10px]">▶</span> Google Play
              </span>
            </div>
          </div>
        </aside>
        ) : null}

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/[0.07] via-background to-brand-yellow/18">
          <div className="mx-auto max-w-7xl px-4 py-12 md:py-16 lg:py-20">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
              <div>
                <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
                  Sign up for free delivery
                  <span className="mt-1 block text-primary">on your first order</span>
                </h1>
                <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
                  Order from your favorite local restaurants and get fresh food delivered in minutes.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/login">
                    <Button
                      size="lg"
                      className="h-11 rounded-full border-0 bg-brand-yellow px-8 text-base font-bold text-brand-yellow-foreground shadow-md hover:brightness-95"
                    >
                      Sign up
                    </Button>
                  </Link>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-sm sm:max-w-sm sm:flex-1">
                    <MapPin className="size-5 shrink-0 text-primary" />
                    <input
                      type="text"
                      placeholder="Enter your delivery address"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" />
                    30 min delivery
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bike className="size-4 text-primary" />
                    Live tracking
                  </span>
                </div>
              </div>

              <div className="relative hidden justify-center md:flex">
                <div className="relative flex size-72 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-white to-brand-yellow/12 shadow-inner ring-1 ring-primary/15 lg:size-80">
                  <div className="absolute inset-6 rounded-[2rem] bg-gradient-to-br from-primary/20 to-brand-yellow/10" />
                  <Image
                    src="/tkimlogo.png"
                    alt="TKimph"
                    width={160}
                    height={160}
                    className="relative z-10 drop-shadow-2xl"
                  />
                </div>
                <div className="absolute -right-2 top-6 flex items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-lg">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">15-30 min</p>
                    <p className="text-[10px] text-muted-foreground">Delivery</p>
                  </div>
                </div>
                <div className="absolute -left-2 bottom-8 flex items-center gap-2 rounded-2xl border border-border bg-white p-3 shadow-lg">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Store className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">500+</p>
                    <p className="text-[10px] text-muted-foreground">Restaurants</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main: filters + browse */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 pb-16 pt-2 lg:pt-4">
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-36 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground">Filters</h3>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sort by
              </p>
              <ul className="mt-3 space-y-2">
                {["Relevance", "Fastest delivery", "Top rated", "Distance"].map((label, i) => (
                  <li key={label}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                      <input
                        type="radio"
                        name="sort"
                        defaultChecked={i === 0}
                        className="size-4 accent-primary"
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Cuisines — horizontal strip */}
            <section className="py-8 md:py-10">
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  Cuisines
                </h2>
                <div className="hidden gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => scrollCuisines("left")}
                    className="flex size-10 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                    aria-label="Scroll cuisines left"
                  >
                    <ChevronRight className="size-5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCuisines("right")}
                    className="flex size-10 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:bg-muted"
                    aria-label="Scroll cuisines right"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div
                  ref={cuisineScroll}
                  className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
                >
                  {cuisines.map((cuisine) => (
                    <button
                      key={cuisine.name}
                      type="button"
                      className="group flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-2 sm:w-[5.25rem]"
                    >
                      <div
                        className={`flex size-[4.5rem] items-center justify-center rounded-full bg-gradient-to-br ${cuisine.ring} p-0.5 shadow-md ring-2 ring-white transition group-hover:scale-[1.04] group-hover:shadow-lg sm:size-20`}
                      >
                        <div className="flex size-full items-center justify-center rounded-full bg-white/95 text-primary shadow-inner">
                          <cuisine.icon className="size-8 sm:size-9" strokeWidth={1.5} />
                        </div>
                      </div>
                      <span className="max-w-[5rem] text-center text-xs font-semibold text-foreground sm:text-sm">
                        {cuisine.name}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => scrollCuisines("right")}
                  className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-lg transition hover:bg-muted sm:hidden"
                  aria-label="More cuisines"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </section>

            {/* Popular restaurants */}
            <section className="py-4 md:py-6">
              <div className="mb-8 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  Popular restaurants
                </h2>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary transition hover:underline"
                >
                  See all <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {popularRestaurants.map((restaurant) => (
                  <article
                    key={restaurant.name}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md"
                  >
                    <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-primary/[0.08] to-muted md:h-44">
                      <Store
                        className="size-14 text-primary/30 transition group-hover:scale-105 group-hover:text-primary/45"
                        strokeWidth={1.25}
                      />
                      <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-primary shadow-sm ring-1 ring-primary/10">
                        ★ {restaurant.rating}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{restaurant.category}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {restaurant.time}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-primary/90">
                          <Bike className="size-3.5" />
                          Free delivery
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Promo banner */}
            <section className="py-8 md:py-10">
              <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground shadow-lg ring-2 ring-brand-yellow/50 md:flex-row md:items-center md:p-10">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                    Free delivery on your first order
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-primary-foreground/85 md:text-base">
                    Create an account or download the app to unlock deals and faster checkout.
                  </p>
                </div>
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-11 rounded-full border-0 bg-brand-yellow px-8 font-bold text-brand-yellow-foreground shadow-md hover:brightness-95"
                  >
                    Get started
                  </Button>
                </Link>
              </div>
            </section>

            {/* Why TKimph */}
            <section className="py-8 md:py-12">
              <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Why order with TKimph?
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-sm transition hover:border-primary/20 hover:shadow-md"
                  >
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                      <feature.icon className="size-6 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
