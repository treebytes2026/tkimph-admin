import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Sparkles, Building2 } from "lucide-react";

export default function BusinessAccountComingSoonPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <Link
        href="/"
        className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>

      <div className="mb-10 flex flex-col items-center text-center sm:mb-12">
        <div className="mb-6 flex size-16 items-center justify-center rounded-3xl bg-primary/10 shadow-inner ring-1 ring-primary/10">
          <Building2 className="size-8 text-primary" strokeWidth={2} />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Business accounts
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Sign up for a business account
        </h1>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-yellow/40 bg-brand-yellow/15 px-5 py-2.5 text-sm font-bold text-foreground shadow-sm">
          <Sparkles className="size-4 text-brand-yellow-foreground" />
          Coming soon!
        </div>
        <p className="mt-6 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
          Self‑serve business accounts aren&apos;t available yet. Restaurant partners can still apply
          today — use &quot;Sign up to be a restaurant partner&quot; on the home banner.
        </p>
      </div>

      <div className="rounded-3xl border border-border/80 bg-card/80 p-8 shadow-lg shadow-primary/5 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <Image
              src="/tkimlogo.png"
              alt=""
              width={48}
              height={48}
              className="rounded-xl shadow-sm ring-2 ring-border/50"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Running a restaurant?</p>
            <p className="text-sm text-muted-foreground">
              Apply as a restaurant partner — separate from business accounts.
            </p>
            <Link
              href="/partner/register"
              className="inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline"
            >
              Sign up to be a restaurant partner →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
