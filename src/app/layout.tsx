import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TKimph Admin",
  description: "TKimph Admin Dashboard",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260405b", type: "image/x-icon" },
      { url: "/tkimlogo.png?v=20260405b", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=20260405b", type: "image/x-icon" }],
    apple: [{ url: "/tkimlogo.png?v=20260405b", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <TooltipProvider>
          <Providers>{children}</Providers>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
