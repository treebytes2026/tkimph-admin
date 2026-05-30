import type { Metadata } from "next";
import { Navbar, Footer } from "@/components/landing";

export const metadata: Metadata = {
  title: "Legal · TKimph",
  description: "Terms, privacy, and cookie policies for TKimph.",
};

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/[0.07] via-background to-muted/30">
      <Navbar />
      <main className="flex flex-1 flex-col px-4 py-10 md:py-14">{children}</main>
      <Footer />
    </div>
  );
}
