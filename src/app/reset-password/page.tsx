import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/[0.06] to-background px-4 py-12">
      <Link
        href="/"
        className="mb-8 text-sm font-semibold text-primary hover:underline"
      >
        ← Back to home
      </Link>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Loading…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
