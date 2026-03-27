"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer, Navbar, TopBanner } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_CHANGED_EVENT, getStoredUser, logout, notifyAuthChanged, type AuthUser } from "@/lib/auth";
import {
  CustomerApiError,
  changeCustomerPassword,
  deleteCustomerAccount,
  fetchCustomerProfile,
  sendCustomerEmailVerification,
  sendCustomerPhoneVerification,
  updateCustomerProfile,
  verifyCustomerEmailCode,
  verifyCustomerPhoneCode,
  type CustomerProfile,
} from "@/lib/customer-api";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [deletePassword, setDeletePassword] = useState("");

  function hydrateForm(p: CustomerProfile) {
    setForm({
      name: p.name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
    });
  }

  function persistUserProfile(p: CustomerProfile, emitEvent = true) {
    const existing = getStoredUser();
    if (!existing) return;
    const next: AuthUser = {
      ...existing,
      name: p.name,
      email: p.email,
      phone: p.phone,
      address: p.address,
      email_verified: p.email_verified,
      phone_verified: p.phone_verified,
    };
    localStorage.setItem("user", JSON.stringify(next));
    if (emitEvent) notifyAuthChanged();
  }

  useEffect(() => {
    const applyAuth = () => {
      const u = getStoredUser();
      if (!u) {
        setUser(null);
        router.replace("/login");
        return;
      }
      if (u.role === "restaurant_owner") {
        router.replace("/partner/dashboard");
        return;
      }
      if (u.role === "admin") {
        router.replace("/dashboard");
        return;
      }
      setUser(u);
    };
    applyAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, applyAuth);
    window.addEventListener("storage", applyAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, applyAuth);
      window.removeEventListener("storage", applyAuth);
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPageError(null);
      try {
        const p = await fetchCustomerProfile();
        if (cancelled) return;
        setProfile(p);
        hydrateForm(p);
        persistUserProfile(p, false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CustomerApiError && err.status === 401) {
          router.replace("/login");
        }
        setPageError(err instanceof Error ? err.message : "Could not load your account.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    setPageError(null);
    try {
      const res = await updateCustomerProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
      });
      setProfile(res.user);
      hydrateForm(res.user);
      persistUserProfile(res.user);
      setProfileMessage(res.message);
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSendEmailCode() {
    setEmailMessage(null);
    try {
      const res = await sendCustomerEmailVerification();
      setEmailMessage(res.message);
    } catch (err) {
      setEmailMessage(err instanceof Error ? err.message : "Could not send code.");
    }
  }

  async function onVerifyEmailCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);
    try {
      const res = await verifyCustomerEmailCode(emailCode.trim());
      setProfile(res.user);
      persistUserProfile(res.user);
      setEmailCode("");
      setEmailMessage(res.message);
    } catch (err) {
      setEmailMessage(err instanceof Error ? err.message : "Could not verify email.");
    }
  }

  async function onSendPhoneCode() {
    setPhoneMessage(null);
    try {
      const res = await sendCustomerPhoneVerification();
      setPhoneMessage(res.message);
    } catch (err) {
      setPhoneMessage(err instanceof Error ? err.message : "Could not send code.");
    }
  }

  async function onVerifyPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMessage(null);
    try {
      const res = await verifyCustomerPhoneCode(phoneCode.trim());
      setProfile(res.user);
      persistUserProfile(res.user);
      setPhoneCode("");
      setPhoneMessage(res.message);
    } catch (err) {
      setPhoneMessage(err instanceof Error ? err.message : "Could not verify phone.");
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    try {
      const res = await changeCustomerPassword({
        current_password: passwordForm.current_password,
        password: passwordForm.password,
        password_confirmation: passwordForm.password_confirmation,
      });
      setPasswordForm({
        current_password: "",
        password: "",
        password_confirmation: "",
      });
      setPasswordMessage(res.message);
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : "Could not change password.");
    }
  }

  async function onDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteMessage(null);
    try {
      const res = await deleteCustomerAccount(deletePassword);
      setDeleteMessage(res.message);
      await logout();
      router.replace("/");
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : "Could not delete account.");
    }
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <TopBanner />
        <Navbar />
        <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <TopBanner />
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, verification, password, and account security.
          </p>
        </div>

        {pageError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {pageError}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>Update your basic information and contact details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Phone number</Label>
                  <Input
                    id="profile-phone"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-address">Address</Label>
                <Input
                  id="profile-address"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              {profileMessage ? (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {profileMessage}
                </p>
              ) : null}

              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Email verification</CardTitle>
              <CardDescription>
                Status:{" "}
                <span className={profile?.email_verified ? "text-emerald-600" : "text-amber-600"}>
                  {profile?.email_verified ? "Verified" : "Not verified"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="outline" onClick={onSendEmailCode}>
                Send code to email
              </Button>
              <form onSubmit={onVerifyEmailCode} className="flex gap-2">
                <Input
                  placeholder="6-digit code"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  maxLength={6}
                />
                <Button type="submit">Verify</Button>
              </form>
              {emailMessage ? <p className="text-sm text-muted-foreground">{emailMessage}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phone verification</CardTitle>
              <CardDescription>
                Status:{" "}
                <span className={profile?.phone_verified ? "text-emerald-600" : "text-amber-600"}>
                  {profile?.phone_verified ? "Verified" : "Not verified"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="outline" onClick={onSendPhoneCode}>
                Send code
              </Button>
              <p className="text-xs text-muted-foreground">
                For now, phone verification code is delivered to your email while SMS is not yet connected.
              </p>
              <form onSubmit={onVerifyPhoneCode} className="flex gap-2">
                <Input
                  placeholder="6-digit code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  maxLength={6}
                />
                <Button type="submit">Verify</Button>
              </form>
              {phoneMessage ? <p className="text-sm text-muted-foreground">{phoneMessage}</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Use your current password to set a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onChangePassword} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.password_confirmation}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, password_confirmation: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="sm:col-span-3 flex items-center gap-3">
                <Button type="submit">Update password</Button>
                {passwordMessage ? <p className="text-sm text-muted-foreground">{passwordMessage}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Delete account</CardTitle>
            <CardDescription>
              This permanently deletes your customer account and signs you out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onDeleteAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:max-w-sm">
                <Label htmlFor="delete-password">Confirm your password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="destructive">
                Delete my account
              </Button>
            </form>
            {deleteMessage ? <p className="mt-3 text-sm text-muted-foreground">{deleteMessage}</p> : null}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
