"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Navbar, Footer } from "@/components/landing";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitRiderApplication, PublicApiError } from "@/lib/public-api";
import { Loader2, ArrowLeft, Bike } from "lucide-react";

const textareaClass =
  "min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default function RiderRegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [notes, setNotes] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await submitRiderApplication({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        vehicle_type: vehicleType.trim() || null,
        license_number: licenseNumber.trim() || null,
        notes: notes.trim() || null,
      });
      setDoneMessage(res.message);
    } catch (err) {
      setFormError(err instanceof PublicApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/[0.06] to-background">
      <Navbar />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10 md:py-14">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Bike className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Ride with us
            </h1>
            <p className="text-sm text-muted-foreground">
              Apply to deliver with TKimph. We&apos;ll contact you after review.
            </p>
          </div>
        </div>

        <Card className="border-border/80 shadow-md">
          <CardHeader>
            <CardTitle>Rider application</CardTitle>
            <CardDescription>Complete the form below. Fields marked * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            {doneMessage ? (
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
                  <Label htmlFor="name">Full name *</Label>
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
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
                  <Label htmlFor="phone">Phone *</Label>
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
                    className={textareaClass}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vehicle_type">Vehicle type</Label>
                  <Input
                    id="vehicle_type"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="e.g. Motorcycle"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="license_number">License number</Label>
                  <Input
                    id="license_number"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    rows={2}
                    className={textareaClass}
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
        </Card>
      </main>

      <Footer />
    </div>
  );
}
