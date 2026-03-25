import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant partner registration · TKimph",
  description: "Apply to list your restaurant and partner with TKimph.",
};

export default function PartnerRegisterSegmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
