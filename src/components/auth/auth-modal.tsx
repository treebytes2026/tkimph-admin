"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loginCustomer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Apple,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  QrCode,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

type AuthTab = "login" | "register";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function AuthModal() {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await loginCustomer({ email, password });
      if (res.user.role === "restaurant_owner") {
        router.push("/partner/dashboard");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setInfo(
      "Account creation is not enabled for the admin portal. Please use credentials from your organization or contact support."
    );
  }

  function handleSocial(label: string) {
    setError("");
    setInfo(`${label} is not connected yet. Use email and password to sign in.`);
  }

  return (
    <div
      className="relative z-10 flex w-full max-w-[56rem] flex-col-reverse overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 md:max-h-[min(90vh,640px)] md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-desc"
    >
      {/* Left — app promo */}
      <div className="relative flex flex-col justify-between bg-zinc-900 px-8 py-10 text-white md:w-[42%] md:min-h-[520px] md:py-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-brand-yellow/10" />
        <div className="relative">
          <div className="mx-auto flex w-fit flex-col items-center">
            <div className="rounded-xl bg-white p-4 shadow-lg">
              <QrCode className="size-36 text-primary sm:size-40" strokeWidth={1} />
              <div className="mt-2 flex justify-center">
                <Image
                  src="/tkimlogo.png"
                  alt="TKimph"
                  width={28}
                  height={28}
                  className="rounded-md opacity-90"
                />
              </div>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1 text-sm text-white/90">
              <Star className="size-4 fill-brand-yellow text-brand-yellow" />
              <span className="font-semibold">4.8</span>
              <span className="text-white/60">on 10k+ ratings</span>
            </p>
          </div>
          <p className="mx-auto mt-8 max-w-[16rem] text-center text-lg font-semibold leading-snug md:text-xl">
            Download the app for{" "}
            <span className="text-brand-yellow">free delivery</span> on your first order.
          </p>
        </div>
        <div className="relative mt-8 flex flex-col gap-2 md:mt-0">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-black/40 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-black/55"
          >
            <Apple className="size-5" />
            App Store
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-black/40 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-black/55"
          >
            <span className="text-lg leading-none">▶</span>
            Play Store
          </button>
        </div>
      </div>

      {/* Right — auth */}
      <div className="relative flex flex-1 flex-col bg-white md:w-[58%]">
        <Link
          href="/"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close and go home"
        >
          <X className="size-5" />
        </Link>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-8 pt-12 sm:px-10 sm:pt-14">
          <h1
            id="auth-modal-title"
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Welcome!
          </h1>
          <p id="auth-modal-desc" className="mt-1 text-sm text-muted-foreground sm:text-base">
            Sign up or log in to continue.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full gap-2 border-0 bg-[#1877F2] font-semibold text-white hover:bg-[#1877F2]/90"
              onClick={() => handleSocial("Facebook")}
            >
              <FacebookMark className="size-5 shrink-0 text-white" />
              Continue with Facebook
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 border-border font-semibold"
              onClick={() => handleSocial("Google")}
            >
              <GoogleMark className="size-5 shrink-0" />
              Continue with Google
            </Button>
            <Button
              type="button"
              className="h-11 w-full gap-2 border-0 bg-zinc-900 font-semibold text-white hover:bg-zinc-800"
              onClick={() => handleSocial("Apple")}
            >
              <Apple className="size-5 shrink-0" />
              Continue with Apple
            </Button>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide">
              <span className="bg-white px-3 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="flex gap-2 rounded-full bg-muted/80 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError("");
                setInfo("");
              }}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === "login"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setError("");
                setInfo("");
              }}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === "register"
                  ? "bg-brand-yellow text-brand-yellow-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
                  {info}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-xl font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {info && (
                <div className="rounded-lg border border-brand-yellow/40 bg-brand-yellow/15 px-3 py-2 text-sm text-foreground">
                  {info}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="auth-name">Full name</Label>
                <Input
                  id="auth-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-confirm">Confirm password</Label>
                <Input
                  id="reg-confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-xl border-0 bg-brand-yellow font-semibold text-brand-yellow-foreground hover:brightness-95"
              >
                <UserPlus className="size-4" />
                Create account
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            By signing up, you agree to our{" "}
            <Link href="#" className="font-medium text-primary hover:underline">
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link href="#" className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
