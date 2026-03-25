import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business account · TKimph",
  description: "Sign up for a TKimph business account — coming soon.",
};

export default function BusinessAccountSegmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
