"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBanner, Navbar, Footer } from "@/components/landing";
import { CustomerPromoCarousel } from "@/components/customer-promo-carousel";
import { PublicApiError, fetchPublicRestaurants, type PublicRestaurant } from "@/lib/public-api";
import { AUTH_CHANGED_EVENT, getStoredUser, type AuthUser } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState<string | null>(null);

  useEffect(() => {
    const applyAuth = () => {
      const u = getStoredUser();
      if (!u) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (u.role === "restaurant_owner") {
        router.replace("/partner/dashboard");
        return;
      }
      if (u.role === "admin") {
        router.replace("/dashboard");
        return;
      }
      setUser(u);
    };
    applyAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, applyAuth);
    window.addEventListener("storage", applyAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, applyAuth);
      window.removeEventListener("storage", applyAuth);
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingRestaurants(true);
      setRestaurantsError(null);
      try {
        const res = await fetchPublicRestaurants({ limit: 60 });
        if (!cancelled) {
          setRestaurants(res.data);
        }
      } catch (e) {
        if (!cancelled) {
          setRestaurantsError(e instanceof PublicApiError ? e.message : "Could not load restaurants.");
          setRestaurants([]);
        }
      } finally {
        if (!cancelled) setLoadingRestaurants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sortedForCarousel = useMemo(() => {
    const list = [...restaurants];
    list.sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
    );
    return list;
  }, [restaurants]);

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </div>

        <section id="offers" className="mb-4 scroll-mt-28">
          <h2 className="text-lg font-semibold text-foreground">Limited-time offers</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Get 25% off and featured restaurants — only on this page when you&apos;re signed in.
          </p>
        </section>

        {restaurantsError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {restaurantsError}
          </p>
        ) : (
          <CustomerPromoCarousel
            restaurants={sortedForCarousel}
            loading={loadingRestaurants}
            className="mt-4"
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
