"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getStoredUser } from "@/lib/auth";
import {
  changePartnerPassword,
  deletePartnerLocationImage,
  deletePartnerRestaurantProfileImage,
  fetchPartnerOverview,
  PartnerApiError,
  partnerPublicFileUrl,
  updatePartnerProfile,
  updatePartnerRestaurant,
  uploadPartnerLocationImage,
  uploadPartnerRestaurantProfileImage,
  type PartnerLocationImage,
  type PartnerOverviewRestaurant,
  type PartnerOverviewUser,
} from "@/lib/partner-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Camera,
  Clock,
  ImageIcon,
  KeyRound,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  Store,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

const MAX_LOCATION_IMAGES = 12;

const PARTNER_PROFILE_PHOTO_UPDATED_EVENT = "tkimph:partner-profile-photo-updated";

function notifyPartnerHeaderProfilePhotoUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTNER_PROFILE_PHOTO_UPDATED_EVENT));
  }
}

const textareaClass =
  "min-h-[100px] w-full resize-y rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 dark:bg-input/25";

const textareaShortClass =
  "min-h-[88px] w-full resize-y rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 dark:bg-input/25";

export default function PartnerProfilePage() {
  const uploadInputId = useId();
  const profilePhotoInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<PartnerOverviewUser | null>(null);
  const [restaurant, setRestaurant] = useState<PartnerOverviewRestaurant | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [deletingProfilePhoto, setDeletingProfilePhoto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchPartnerOverview();
        if (cancelled) return;
        setUser(o.user);
        const r = o.restaurants[0] ?? null;
        setRestaurant(r);
        setAccountName(o.user.name);
        setAccountPhone(o.user.phone ?? "");
        if (r) {
          setStoreName(r.name);
          setStoreDescription(r.description ?? "");
          setStorePhone(r.phone ?? "");
          setStoreAddress(r.address ?? "");
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof PartnerApiError ? e.message : "Could not load your profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const u = await updatePartnerProfile({
        name: accountName.trim(),
        phone: accountPhone.trim() || null,
      });
      setUser(u);
      const stored = getStoredUser();
      if (stored && typeof window !== "undefined") {
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...stored,
            name: u.name,
            phone: u.phone ?? null,
          })
        );
      }

      if (restaurant) {
        const r = await updatePartnerRestaurant(restaurant.id, {
          name: storeName.trim(),
          description: storeDescription.trim() || null,
          phone: storePhone.trim() || null,
          address: storeAddress.trim() || null,
        });
        setRestaurant(r);
      }

      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePartnerPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handlePickLocationImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !restaurant) return;
    const images = restaurant.location_images ?? [];
    if (images.length >= MAX_LOCATION_IMAGES) {
      toast.error(`You can upload up to ${MAX_LOCATION_IMAGES} photos.`);
      return;
    }
    setUploadingImage(true);
    try {
      const created = await uploadPartnerLocationImage(restaurant.id, file);
      setRestaurant((prev) =>
        prev
          ? {
              ...prev,
              location_images: [...(prev.location_images ?? []), created].sort(
                (a, b) => a.sort_order - b.sort_order
              ),
            }
          : prev
      );
      toast.success("Photo added.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleProfilePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !restaurant) return;
    setUploadingProfilePhoto(true);
    try {
      const r = await uploadPartnerRestaurantProfileImage(restaurant.id, file);
      setRestaurant(r);
      notifyPartnerHeaderProfilePhotoUpdated();
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not upload photo.");
    } finally {
      setUploadingProfilePhoto(false);
    }
  }

  async function handleRemoveProfilePhoto() {
    if (!restaurant?.profile_image_path && !restaurant?.profile_image_url) return;
    if (!window.confirm("Remove your restaurant profile picture?")) return;
    setDeletingProfilePhoto(true);
    try {
      const r = await deletePartnerRestaurantProfileImage(restaurant.id);
      setRestaurant(r);
      notifyPartnerHeaderProfilePhotoUpdated();
      toast.success("Profile picture removed.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not remove photo.");
    } finally {
      setDeletingProfilePhoto(false);
    }
  }

  async function handleDeleteLocationImage(id: number) {
    if (!restaurant) return;
    if (!window.confirm("Remove this photo from your listing?")) return;
    setDeletingId(id);
    try {
      await deletePartnerLocationImage(restaurant.id, id);
      setRestaurant((prev) =>
        prev
          ? {
              ...prev,
              location_images: (prev.location_images ?? []).filter((img) => img.id !== id),
            }
          : prev
      );
      toast.success("Photo removed.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not remove photo.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="relative mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-4 px-1">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-brand-yellow/[0.12] blur-3xl" />
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/90 px-10 py-12 shadow-lg backdrop-blur-sm">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="mx-auto max-w-lg px-1">
        <div className="rounded-2xl border border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-card px-8 py-10 text-center shadow-lg">
          <p className="text-sm font-medium leading-relaxed text-destructive">{error ?? "Something went wrong."}</p>
          <Link
            href="/partner/dashboard"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "mt-6 rounded-xl font-semibold shadow-sm"
            )}
          >
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  const locationImages = restaurant?.location_images ?? [];
  const profilePhotoSrc = restaurant
    ? partnerPublicFileUrl(restaurant.profile_image_path, restaurant.profile_image_url)
    : null;

  return (
    <div className="relative mx-auto max-w-3xl pb-16 pt-1">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-none">
        <div className="absolute -right-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-brand-yellow/[0.11] blur-3xl" />
        <div className="absolute left-1/2 top-24 h-px w-[min(100%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </div>

      <header className="mb-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          {restaurant ? (
            <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-center">
              <input
                ref={profilePhotoInputRef}
                id={profilePhotoInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleProfilePhotoChange}
                disabled={uploadingProfilePhoto}
              />
              <div className="relative">
                <div
                  className={cn(
                    "relative flex size-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-muted to-muted/40 shadow-2xl ring-4 ring-background sm:size-[8.5rem]",
                    profilePhotoSrc ? "ring-primary/15" : "ring-border/60"
                  )}
                >
                  {profilePhotoSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profilePhotoSrc}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Store className="size-14 text-muted-foreground/55" strokeWidth={1.25} />
                  )}
                  {uploadingProfilePhoto ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                      <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  disabled={uploadingProfilePhoto}
                  className="absolute -bottom-1 -right-1 size-10 rounded-xl border border-border/80 shadow-lg"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  aria-label="Change profile picture"
                >
                  <Camera className="size-4" />
                </Button>
              </div>
              <div className="flex max-w-[11rem] flex-col items-center gap-2 sm:items-start lg:items-center">
                <p className="text-center text-[11px] leading-snug text-muted-foreground sm:text-left lg:text-center">
                  Restaurant profile photo — logo or storefront, shown on your listing.
                </p>
                {profilePhotoSrc ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium text-muted-foreground hover:text-destructive"
                    disabled={deletingProfilePhoto || uploadingProfilePhoto}
                    onClick={handleRemoveProfilePhoto}
                  >
                    {deletingProfilePhoto ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Trash2 className="mr-1.5 size-3.5" />}
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="min-w-0 flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5 opacity-90" />
              Partner settings
            </div>
            <div className="space-y-3">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Store profile</h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                Keep contact details, your listing, and photos current so customers know how to reach you and what to
                expect.
              </p>
            </div>
            {restaurant ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Listing</span>
                <Badge className="rounded-lg px-2.5 py-0.5 font-semibold shadow-sm">{restaurant.name}</Badge>
                {restaurant.is_active ? (
                  <Badge variant="secondary" className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-lg text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/partner/dashboard/hours"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "group h-9 gap-2 rounded-full px-4 text-xs font-semibold shadow-md shadow-primary/15"
                )}
              >
                <Clock className="size-3.5 opacity-90" />
                Opening hours
                <ArrowUpRight className="size-3.5 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/partner/dashboard/menu"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 rounded-full border-border/80 bg-background/80 px-4 text-xs font-semibold shadow-sm backdrop-blur-sm"
                )}
              >
                Edit menu
              </Link>
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="gap-0 overflow-hidden rounded-2xl border-border/55 py-0 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-muted/50 via-muted/25 to-transparent px-6 py-5 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 shadow-inner shadow-primary/5">
                <UserRound className="size-6 text-primary" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg font-semibold sm:text-xl">Your account</CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Name and phone for this partner login. Email is verified and cannot be changed here.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-6 py-7 sm:px-8">
            <div className="grid gap-2">
              <Label htmlFor="acct_email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                id="acct_email"
                value={user.email}
                disabled
                className="h-11 rounded-xl border-dashed bg-muted/40 font-medium"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="acct_name">Your name</Label>
                <Input
                  id="acct_name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  autoComplete="name"
                  required
                  className="h-11 rounded-xl shadow-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="acct_phone">Your phone</Label>
                <Input
                  id="acct_phone"
                  type="tel"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="e.g. +63 …"
                  className="h-11 rounded-xl shadow-sm"
                />
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              We may use this number if we need to reach you about your account or orders.
            </p>
          </CardContent>
        </Card>

        {restaurant ? (
          <>
            <Card className="gap-0 overflow-hidden rounded-2xl border-border/55 py-0 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-muted/50 via-muted/25 to-transparent px-6 py-5 sm:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 shadow-inner shadow-primary/5">
                    <Store className="size-6 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold sm:text-xl">Restaurant listing</CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      What customers see on your listing. Category and type are set by admin — contact support to change
                      them.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-7 sm:px-8">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {restaurant.cuisine ? (
                      <Badge className="rounded-md font-medium shadow-sm">{restaurant.cuisine.name}</Badge>
                    ) : null}
                    {restaurant.business_type ? (
                      <Badge variant="secondary" className="rounded-md font-medium">
                        {restaurant.business_type.name}
                      </Badge>
                    ) : null}
                    {restaurant.business_category ? (
                      <Badge variant="outline" className="rounded-md font-medium">
                        {restaurant.business_category.name}
                      </Badge>
                    ) : null}
                    {!restaurant.cuisine && !restaurant.business_type ? (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="store_name">Restaurant name</Label>
                  <Input
                    id="store_name"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    required
                    autoComplete="organization"
                    className="h-11 rounded-xl shadow-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="store_desc">Description</Label>
                  <textarea
                    id="store_desc"
                    rows={4}
                    className={textareaClass}
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    placeholder="Short intro, specialties, or what makes your place special."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="store_phone" className="flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground" strokeWidth={2} />
                      Restaurant phone
                    </Label>
                    <Input
                      id="store_phone"
                      type="tel"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      autoComplete="tel"
                      placeholder="Shown to customers"
                      className="h-11 rounded-xl shadow-sm"
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="store_address" className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground" strokeWidth={2} />
                      Address / location
                    </Label>
                    <textarea
                      id="store_address"
                      rows={3}
                      className={textareaShortClass}
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="Street, area, city — helps customers find you."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 overflow-hidden rounded-2xl border-border/55 py-0 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-sky-500/[0.07] via-transparent to-transparent px-6 py-5 sm:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 shadow-inner dark:text-sky-300">
                    <ImageIcon className="size-6" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold sm:text-xl">Location photos</CardTitle>
                    <CardDescription className="text-[13px] leading-relaxed">
                      Storefront, dining area, or parking — up to {MAX_LOCATION_IMAGES} images (JPEG, PNG, WebP, GIF,
                      max 5 MB each).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-7 sm:px-8">
                <input
                  ref={fileInputRef}
                  id={uploadInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handlePickLocationImage}
                  disabled={uploadingImage || locationImages.length >= MAX_LOCATION_IMAGES}
                />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-dashed border-primary/35 bg-primary/[0.03] font-semibold hover:bg-primary/[0.06] sm:w-auto"
                    disabled={uploadingImage || locationImages.length >= MAX_LOCATION_IMAGES}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4 opacity-80" />
                    )}
                    Upload photo
                  </Button>
                  <p className="text-center text-xs font-medium tabular-nums text-muted-foreground sm:text-right">
                    {locationImages.length} / {MAX_LOCATION_IMAGES} photos
                  </p>
                </div>

                {locationImages.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {locationImages.map((img) => (
                      <li
                        key={img.id}
                        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 bg-muted/20 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={partnerPublicFileUrl(img.path, img.url) ?? ""}
                          alt=""
                          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                        <button
                          type="button"
                          className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-xl bg-background/95 text-destructive shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleDeleteLocationImage(img.id)}
                          disabled={deletingId === img.id}
                          aria-label="Remove photo"
                        >
                          {deletingId === img.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center transition hover:border-primary/40 hover:bg-primary/[0.04] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-background shadow-md ring-1 ring-border/60">
                      <Camera className="size-7 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Add location photos</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Help customers recognize your place — click to choose a file from your device.
                      </p>
                    </div>
                  </button>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="rounded-2xl border-dashed border-border/80 bg-muted/20 py-0 shadow-none">
            <CardContent className="px-6 py-12 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                No restaurant is linked to your account yet. After approval, your store details will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-border/55 bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[13px] text-muted-foreground">Save changes to update your partner profile and listing.</p>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Link
              href="/partner/dashboard"
              className={cn(
                buttonVariants({ variant: "ghost", size: "default" }),
                "flex-1 rounded-xl font-semibold sm:flex-none"
              )}
            >
              Cancel
            </Link>
            <Button type="submit" disabled={saving} className="min-w-[10rem] flex-1 rounded-xl font-semibold shadow-md sm:flex-none">
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="mt-8">
        <Card className="gap-0 overflow-hidden rounded-2xl border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] via-card to-card py-0 shadow-md shadow-black/[0.04] ring-1 ring-amber-500/10 dark:from-amber-500/[0.06] dark:border-amber-500/15">
          <CardHeader className="border-b border-amber-500/15 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent px-6 py-5 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-800 shadow-inner dark:text-amber-200">
                <KeyRound className="size-6" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg font-semibold sm:text-xl">Password & security</CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Use a strong password you do not reuse on other sites.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-6 py-7 sm:px-8">
            <div className="grid max-w-xl gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pw_current">Current password</Label>
                <Input
                  id="pw_current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl shadow-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pw_new">New password</Label>
                  <Input
                    id="pw_new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-11 rounded-xl shadow-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pw_confirm">Confirm new password</Label>
                  <Input
                    id="pw_confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-11 rounded-xl shadow-sm"
                  />
                </div>
              </div>
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={passwordSaving}
              className="mt-2 rounded-xl font-semibold shadow-sm"
            >
              {passwordSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
