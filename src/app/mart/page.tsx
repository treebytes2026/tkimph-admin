"use client";

import { Footer, Navbar, TopBanner } from "@/components/landing";
import { ShoppingBasket } from "lucide-react";

export default function MartComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-16">
        <div className="w-full rounded-3xl border border-border/70 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-primary">
            <ShoppingBasket className="size-8" />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-foreground">Mart is coming soon</h1>
          <p className="mt-2 text-base text-muted-foreground">
            We are preparing groceries and essentials for this section.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
