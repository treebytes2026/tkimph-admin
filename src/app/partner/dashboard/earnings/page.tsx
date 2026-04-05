"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchPartnerCommissionCollections,
  fetchPartnerEarnings,
  submitPartnerCommissionPaymentProof,
  type PartnerCommissionCollectionRow,
} from "@/lib/partner-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Receipt, Upload, Wallet } from "lucide-react";

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default function PartnerEarningsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerEarnings>> | null>(null);
  const [collections, setCollections] = useState<PartnerCommissionCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [referenceDraft, setReferenceDraft] = useState<Record<number, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [proofFiles, setProofFiles] = useState<Record<number, File | null>>({});

  async function loadData() {
    setLoading(true);
    try {
      const [earnings, commissionRows] = await Promise.all([
        fetchPartnerEarnings(),
        fetchPartnerCommissionCollections({ per_page: 50 }),
      ]);
      setData(earnings);
      setCollections(commissionRows.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load earnings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const pendingTotal = useMemo(
    () => collections.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.commission_amount, 0),
    [collections]
  );

  async function handleSubmitProof(row: PartnerCommissionCollectionRow) {
    const file = proofFiles[row.id];
    if (!file) {
      toast.error("Please upload your receipt or proof of payment.");
      return;
    }

    setBusy(row.id);
    try {
      const result = await submitPartnerCommissionPaymentProof(row.id, {
        partner_payment_method: "gcash",
        partner_reference_number: referenceDraft[row.id] ?? "",
        partner_payment_note: noteDraft[row.id] ?? "",
        payment_proof: file,
      });
      toast.success(result.message);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit payment proof.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        Loading commission details...
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-sm text-destructive">{error ?? "Could not load earnings."}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Earnings and commission payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          TKimph keeps an automatic {formatRate(data.commission_rate)} commission from dish sales. Use the section below to pay pending platform commission manually and send your proof of receipt to admin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Orders</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.order_count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gross sales</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(data.gross_sales)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Platform commission</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(data.platform_commission)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending commission to pay</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(pendingTotal)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" />Admin payment details</CardTitle>
          <CardDescription>
            Send your manual payment first, then upload the receipt or proof here for admin review.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">GCash name</p>
            <p className="mt-1 text-xl font-semibold">{data.payment_details.gcash_name || "Not set yet"}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">GCash number</p>
            <p className="mt-1 text-xl font-semibold">{data.payment_details.gcash_number || "Not set yet"}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Accepted manual methods</p>
            <p className="mt-1 text-xl font-semibold">GCash only</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-4" />Commission records</CardTitle>
          <CardDescription>
            Each record below is based on completed-order commission from your menu and dish sales for that date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {collections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              No commission records have been generated for your restaurant yet.
            </div>
          ) : (
            collections.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {row.period_from ?? "N/A"} to {row.period_to ?? "N/A"}
                      </h3>
                      <Badge variant={row.status === "received" ? "default" : "secondary"}>
                        {row.status === "received" ? "Received by admin" : "Pending payment"}
                      </Badge>
                      {row.is_overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                      {row.payment_submitted_at ? (
                        <Badge variant="outline">Proof submitted</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Commission due: <span className="font-semibold text-foreground">{formatMoney(row.commission_amount)}</span> from {row.order_count} completed orders · Due date: {row.due_date ?? "N/A"}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Gross sales</p>
                        <p className="mt-1 font-semibold">{formatMoney(row.gross_sales)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Restaurant net</p>
                        <p className="mt-1 font-semibold">{formatMoney(row.restaurant_net)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">Admin confirmation</p>
                        <p className="mt-1 font-semibold">{row.received_at ? "Received" : "Waiting for review"}</p>
                      </div>
                    </div>
                    {row.payment_submitted_at ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Proof already sent via <span className="font-semibold">{row.partner_payment_method ?? "manual payment"}</span>.
                        {row.partner_reference_number ? ` Reference: ${row.partner_reference_number}.` : ""}
                        {row.payment_proof_url ? (
                          <> <a className="font-semibold underline" href={row.payment_proof_url} target="_blank" rel="noreferrer">View uploaded receipt</a></>
                        ) : null}
                      </div>
                    ) : null}
                    {row.is_overdue && row.status !== "received" ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        This commission is overdue. Admin has been notified and will decide whether any action should be taken on your restaurant account.
                      </div>
                    ) : null}
                  </div>

                  {row.status === "received" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 lg:min-w-[280px]">
                      <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" />Admin already marked this as received</div>
                      {row.collection_reference ? <p className="mt-2">Admin reference: {row.collection_reference}</p> : null}
                      {row.notes ? <p className="mt-2">{row.notes}</p> : null}
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:min-w-[340px]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                        Payment method: <span className="font-semibold text-foreground">GCash</span>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`reference_${row.id}`}>Reference or receipt number</Label>
                        <Input
                          id={`reference_${row.id}`}
                          value={referenceDraft[row.id] ?? ""}
                          onChange={(e) => setReferenceDraft((current) => ({ ...current, [row.id]: e.target.value }))}
                          placeholder="GCash reference number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`note_${row.id}`}>Payment note</Label>
                        <textarea
                          id={`note_${row.id}`}
                          className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                          value={noteDraft[row.id] ?? ""}
                          onChange={(e) => setNoteDraft((current) => ({ ...current, [row.id]: e.target.value }))}
                          placeholder="Optional note for admin"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`proof_${row.id}`}>Receipt or proof of payment</Label>
                        <Input
                          id={`proof_${row.id}`}
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => setProofFiles((current) => ({ ...current, [row.id]: e.target.files?.[0] ?? null }))}
                        />
                      </div>
                      <Button type="button" className="rounded-xl" disabled={busy === row.id} onClick={() => void handleSubmitProof(row)}>
                        {busy === row.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                        Send proof to admin
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
