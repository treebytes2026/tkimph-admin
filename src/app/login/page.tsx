"use client";

import Home from "../page";
import { AuthModal } from "@/components/auth/auth-modal";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen">
      {/* Real landing page, visible through scrim (non-interactive) */}
      <div
        className="fixed inset-0 z-0 overflow-y-auto overscroll-none"
        aria-hidden
        inert
      >
        <div className="pointer-events-none min-h-full select-none [&_*]:pointer-events-none [&_a]:cursor-default [&_button]:cursor-default">
          <div className="opacity-[0.72]">
            <Home />
          </div>
        </div>
      </div>

      {/* Dark but readable: light dim + very soft blur so headings/body copy stay legible */}
      <div
        className="fixed inset-0 z-[1] bg-black/48 backdrop-blur-[2px]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        <AuthModal />
      </div>
    </div>
  );
}
