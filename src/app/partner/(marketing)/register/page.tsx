"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchRegistrationOptions,
  submitPartnerApplication,
  PublicApiError,
  type RegistrationBusinessType,
  type RegistrationOptionsResponse,
} from "@/lib/public-api";
import { Loader2, ArrowLeft, Store } from "lucide-react";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export default function PartnerRegisterPage() {
  const [options, setOptions] = useState<RegistrationOptionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [cuisineId, setCuisineId] = useState<number | "">("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchRegistrationOptions();
        if (!cancelled) {
          setOptions(o);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof PublicApiError ? e.message : "Could not load form options.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType: RegistrationBusinessType | undefined = useMemo(() => {
    if (!options || businessTypeId === "") return undefined;
    return options.business_types.find((t) => t.id === businessTypeId);
  }, [options, businessTypeId]);

  useEffect(() => {
    setCategoryId("");
  }, [businessTypeId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (businessTypeId === "") {
      setFormError("Select a business type.");
      return;
    }
    if (!selectedType) return;

    const payload = {
      business_name: businessName.trim(),
      owner_first_name: ownerFirstName.trim(),
      owner_last_name: ownerLastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      business_type_id: Number(businessTypeId),
      business_category_id:
        selectedType.requires_category && categoryId !== "" ? Number(categoryId) : null,
      cuisine_id: selectedType.requires_cuisine && cuisineId !== "" ? Number(cuisineId) : null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await submitPartnerApplication(payload);
      setDoneMessage(res.message);
    } catch (err) {
      setFormError(err instanceof PublicApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <Store className="size-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Register your restaurant
          </h1>
          <p className="text-sm text-muted-foreground">
            Partner with TKimph — we&apos;ll review your application shortly.
          </p>
        </div>
      </div>

      <Card className="border-border/80 shadow-md">
        <CardHeader>
          <CardTitle>Restaurant partner application</CardTitle>
          <CardDescription>
            Tell us about your business. Fields marked * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !options ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : doneMessage ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Image src="/tkimlogo.png" alt="" width={40} height={40} className="rounded-lg" />
              </div>
              <p className="text-sm font-medium text-foreground">{doneMessage}</p>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline", size: "default" }), "rounded-full")}
              >
                Return home
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="business_name">Your business name *</Label>
                <Input
                  id="business_name"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="owner_first_name">Business owner first name *</Label>
                  <Input
                    id="owner_first_name"
                    required
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="owner_last_name">Business owner last name *</Label>
                  <Input
                    id="owner_last_name"
                    required
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="business_type">Business type *</Label>
                <select
                  id="business_type"
                  required
                  className={selectClass}
                  value={businessTypeId === "" ? "" : String(businessTypeId)}
                  onChange={(e) =>
                    setBusinessTypeId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select type</option>
                  {options.business_types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedType?.requires_category ? (
                <div className="grid gap-2">
                  <Label htmlFor="category">Business category *</Label>
                  <select
                    id="category"
                    required
                    className={selectClass}
                    value={categoryId === "" ? "" : String(categoryId)}
                    onChange={(e) =>
                      setCategoryId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Select category</option>
                    {selectedType.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {selectedType?.requires_cuisine ? (
                <div className="grid gap-2">
                  <Label htmlFor="cuisine">Cuisine *</Label>
                  <select
                    id="cuisine"
                    required
                    className={selectClass}
                    value={cuisineId === "" ? "" : String(cuisineId)}
                    onChange={(e) =>
                      setCuisineId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Select cuisine</option>
                    {options.cuisines.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="email">Business email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Business owner phone number *</Label>
                <Input
                  id="phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  rows={3}
                  className="min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={2}
                  className="min-h-[64px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-brand-yellow font-bold text-brand-yellow-foreground hover:brightness-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit application"
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Already approved?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in to your partner hub
          </Link>
        </div>
      </Card>
    </div>
  );
}
