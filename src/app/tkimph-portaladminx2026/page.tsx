import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { ShieldCheck, Sparkles } from "lucide-react";

export default function PortalAdminLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8f6] px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(41,138,76,0.20),transparent_38%),radial-gradient(circle_at_88%_10%,rgba(255,193,7,0.16),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,0.94),rgba(245,248,246,0.98))]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full border border-primary/25 bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-72 w-72 rounded-full border border-brand-yellow/35 bg-brand-yellow/15 blur-3xl" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm backdrop-blur">
              <Sparkles className="size-3.5" />
              TKimph Operations Console
            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground xl:text-5xl">
              Command Center for
              <span className="block text-primary">Real-time Platform Control</span>
            </h1>

            <p className="text-base leading-relaxed text-muted-foreground">
              Review orders, monitor applications, and manage users from one secure workspace built
              for your internal operations team.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coverage</p>
                <p className="mt-1 text-lg font-bold text-foreground">Admin, Partner, Rider</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-bold text-foreground">
                  <ShieldCheck className="size-5 text-primary" /> Protected Access
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="relative">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
