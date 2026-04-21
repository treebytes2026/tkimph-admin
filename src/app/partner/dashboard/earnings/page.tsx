"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchPartnerCommissionCollections,
  fetchPartnerEarnings,
  partnerPublicFileUrl,
  submitPartnerCommissionPaymentProof,
  type PartnerCommissionCollectionRow,
} from "@/lib/partner-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, ExternalLink, Loader2, Receipt, Upload, Wallet } from "lucide-react";

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekRange(today = new Date()): { start: string; end: string } {
  return getWeekRange(today, 0);
}

function getWeekRange(today = new Date(), offsetWeeks = 0): { start: string; end: string } {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday + offsetWeeks * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

type SummaryRangeKey = "this_week" | "last_week" | "all_time";

export default function PartnerEarningsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerEarnings>> | null>(null);
  const [collections, setCollections] = useState<PartnerCommissionCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [referenceDraft, setReferenceDraft] = useState<Record<number, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [proofFiles, setProofFiles] = useState<Record<number, File | null>>({});
  const [previewRow, setPreviewRow] = useState<PartnerCommissionCollectionRow | null>(null);
  const [summaryRange, setSummaryRange] = useState<SummaryRangeKey>("this_week");
  const thisWeekRange = useMemo(() => getCurrentWeekRange(), []);
  const lastWeekRange = useMemo(() => getWeekRange(new Date(), -1), []);
  const activeRange = useMemo(() => {
    if (summaryRange === "last_week") return lastWeekRange;
    if (summaryRange === "all_time") return null;
    return thisWeekRange;
  }, [lastWeekRange, summaryRange, thisWeekRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [earnings, commissionRows] = await Promise.all([
        fetchPartnerEarnings(
          activeRange
            ? {
                date_from: activeRange.start,
                date_to: activeRange.end,
              }
            : undefined
        ),
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
  }, [activeRange]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingTotal = useMemo(
    () => collections.filter((row) => row.status === "pending").reduce((sum, row) => sum + row.commission_amount, 0),
    [collections]
  );
  const receivedWeeks = useMemo(() => collections.filter((row) => row.status === "received").length, [collections]);
  const pendingWeeks = useMemo(() => collections.filter((row) => row.status === "pending").length, [collections]);
  const previewUrl = previewRow
    ? partnerPublicFileUrl(previewRow.payment_proof_path, previewRow.payment_proof_url)
    : null;
  const previewIsPdf = Boolean(previewUrl && previewUrl.toLowerCase().endsWith(".pdf"));
  const summaryDescription = activeRange ? `${activeRange.start} to ${activeRange.end}` : "All completed orders";
  const ordersLabel =
    summaryRange === "last_week" ? "Last week orders" : summaryRange === "all_time" ? "All-time orders" : "This week orders";
  const grossSalesLabel =
    summaryRange === "last_week" ? "Last week gross sales" : summaryRange === "all_time" ? "All-time gross sales" : "This week gross sales";
  const commissionLabel =
    summaryRange === "last_week"
      ? "Last week platform commission"
      : summaryRange === "all_time"
        ? "All-time platform commission"
        : "This week platform commission";

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
          TKimph keeps an automatic {formatRate(data.commission_rate)} commission from dish sales. Use the range buttons below to switch the summary cards, while the records section keeps your paid and unpaid commission history by week.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={summaryRange === "this_week" ? "default" : "outline"} className="rounded-xl" onClick={() => setSummaryRange("this_week")}>
          This week
        </Button>
        <Button type="button" variant={summaryRange === "last_week" ? "default" : "outline"} className="rounded-xl" onClick={() => setSummaryRange("last_week")}>
          Last week
        </Button>
        <Button type="button" variant={summaryRange === "all_time" ? "default" : "outline"} className="rounded-xl" onClick={() => setSummaryRange("all_time")}>
          All time
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{ordersLabel}</CardTitle>
            <CardDescription>{summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.order_count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{grossSalesLabel}</CardTitle>
            <CardDescription>{summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(data.gross_sales)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{commissionLabel}</CardTitle>
            <CardDescription>{summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(data.platform_commission)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending commission to pay</CardTitle>
            <CardDescription>{pendingWeeks} unpaid week{pendingWeeks === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(pendingTotal)}</CardContent>
        </Card>
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
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-4" />Weekly commission history</CardTitle>
          <CardDescription>
            Each record below is one weekly commission period, so you can quickly see whether that week has already been paid and received by admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Weeks in history</p>
              <p className="mt-1 font-semibold">{collections.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Weeks paid</p>
              <p className="mt-1 font-semibold">{receivedWeeks}</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">Weeks still unpaid</p>
              <p className="mt-1 font-semibold">{pendingWeeks}</p>
            </div>
          </div>
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
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button type="button" size="sm" className="rounded-xl" onClick={() => setPreviewRow(row)}>
                              View uploaded receipt
                            </Button>
                            <a
                              className="inline-flex items-center gap-1 text-sm font-semibold underline"
                              href={partnerPublicFileUrl(row.payment_proof_path, row.payment_proof_url) ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open in new tab
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
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

      <Sheet open={previewRow != null} onOpenChange={(open) => !open && setPreviewRow(null)}>
        <SheetContent side="right" className="w-[min(100vw,64rem)] overflow-y-auto p-0 sm:max-w-none">
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Uploaded receipt</SheetTitle>
            </SheetHeader>
            {previewRow ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                  <p className="font-semibold text-foreground">
                    {previewRow.period_from ?? "N/A"} to {previewRow.period_to ?? "N/A"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {previewRow.partner_reference_number ? `Reference: ${previewRow.partner_reference_number}` : "No reference provided"}
                  </p>
                </div>

                {previewUrl ? (
                  previewIsPdf ? (
                    <iframe
                      src={previewUrl}
                      title="Uploaded receipt PDF"
                      className="h-[75vh] w-full rounded-2xl border border-border/70 bg-white"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/5 p-3">
                      <div className="relative h-[75vh] w-full">
                        <Image
                          src={previewUrl}
                          alt="Uploaded receipt"
                          fill
                          unoptimized
                          className="rounded-xl object-contain"
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    Receipt preview is not available for this file.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
