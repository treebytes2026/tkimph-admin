"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminPublicFileUrl,
  fetchRestaurants,
  createAdminCommissionCollection,
  createAdminCommissionCollectionsForAll,
  fetchAdminCommissionCollections,
  markAdminCommissionCollection,
  type AdminRestaurant,
  type AdminCommissionCollectionRow,
} from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, ExternalLink, Loader2, Wallet } from "lucide-react";

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadCsv(rows: AdminCommissionCollectionRow[]): void {
  const header = [
    "Restaurant",
    "Period From",
    "Period To",
    "Orders",
    "Gross Sales",
    "Commission Amount",
    "Restaurant Net",
    "Status",
    "Reference",
    "Notes",
  ];
  const lines = rows.map((row) => [
    row.restaurant?.name ?? "",
    row.period_from ?? "",
    row.period_to ?? "",
    String(row.order_count),
    row.gross_sales.toFixed(2),
    row.commission_amount.toFixed(2),
    row.restaurant_net.toFixed(2),
    row.status,
    row.collection_reference ?? "",
    (row.notes ?? "").replace(/\r?\n/g, " "),
  ]);
  const csv = [header, ...lines]
    .map((cols) => cols.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `commission-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminCommissionsPage() {
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [rows, setRows] = useState<AdminCommissionCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    restaurant_id: "",
    status: "",
    date_from: "",
    date_to: "",
  });
  const [generator, setGenerator] = useState({
    restaurant_id: "",
    period_from: "",
    period_to: "",
    notes: "",
  });
  const [actionDrafts, setActionDrafts] = useState<Record<number, { collection_reference: string; notes: string }>>({});
  const [previewRow, setPreviewRow] = useState<AdminCommissionCollectionRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [restaurantRows, collections] = await Promise.all([
        fetchRestaurants({ page: 1, search: "" }),
        fetchAdminCommissionCollections({
          per_page: 100,
          restaurant_id: filters.restaurant_id ? Number(filters.restaurant_id) : undefined,
          status: filters.status ? (filters.status as "pending" | "received") : undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        }),
      ]);
      setRestaurants(restaurantRows.data);
      setRows(collections.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load commission collections.");
    } finally {
      setLoading(false);
    }
  }, [filters.date_from, filters.date_to, filters.restaurant_id, filters.status]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += row.commission_amount;
        acc.gross += row.gross_sales;
        if (row.status === "received") acc.received += row.commission_amount;
        else acc.pending += row.commission_amount;
        acc.restaurants.add(row.restaurant?.name ?? `#${row.restaurant_id}`);
        return acc;
      },
      { total: 0, gross: 0, pending: 0, received: 0, restaurants: new Set<string>() }
    );
  }, [rows]);

  const previewUrl = previewRow
    ? adminPublicFileUrl(previewRow.payment_proof_path, previewRow.payment_proof_url)
    : null;
  const previewIsPdf = Boolean(previewUrl && previewUrl.toLowerCase().endsWith(".pdf"));

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!generator.period_from || !generator.period_to) {
      toast.error("Choose a commission period first.");
      return;
    }

    setBusy("generate");
    try {
      if (generator.restaurant_id) {
        const res = await createAdminCommissionCollection({
          restaurant_id: Number(generator.restaurant_id),
          period_from: generator.period_from,
          period_to: generator.period_to,
          notes: generator.notes.trim() || null,
        });
        toast.success(res.message);
      } else {
        const res = await createAdminCommissionCollectionsForAll({
          period_from: generator.period_from,
          period_to: generator.period_to,
          notes: generator.notes.trim() || null,
        });
        toast.success(res.message);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate commission collections.");
    } finally {
      setBusy(null);
    }
  }

  async function handleMark(row: AdminCommissionCollectionRow, status: "pending" | "received") {
    const draft = actionDrafts[row.id] ?? {
      collection_reference: row.collection_reference ?? "",
      notes: row.notes ?? "",
    };
    setBusy(`mark-${row.id}`);
    try {
      const res = await markAdminCommissionCollection(row.id, {
        status,
        collection_reference: draft.collection_reference.trim() || null,
        notes: draft.notes.trim() || null,
      });
      toast.success(res.message);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update commission status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-brand-yellow/[0.10] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Manual commission reserve</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Commission collections</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track how much each restaurant owes the platform based on completed-order menu and dish commission. This is separate from settlements and uses the platform commission already recorded on orders.
            </p>
          </div>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
            <Download className="mr-2 size-4" />
            Export current report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total commission tracked</CardDescription><CardTitle className="text-2xl">{formatMoney(summary.total)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Across the currently filtered records.</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Still pending</CardDescription><CardTitle className="text-2xl">{formatMoney(summary.pending)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Commission not yet marked as received.</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Received</CardDescription><CardTitle className="text-2xl">{formatMoney(summary.received)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Already reserved manually from restaurants.</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Restaurants in report</CardDescription><CardTitle className="text-2xl">{summary.restaurants.size}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Unique restaurant records in the current list.</CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" />Generate collections</CardTitle>
            <CardDescription>Create a commission record for one restaurant or for all restaurants in one date range.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleGenerate}>
              <div className="space-y-2">
                <Label htmlFor="commission_restaurant">Restaurant</Label>
                <select
                  id="commission_restaurant"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={generator.restaurant_id}
                  onChange={(e) => setGenerator((current) => ({ ...current, restaurant_id: e.target.value }))}
                >
                  <option value="">All restaurants with completed orders</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="period_from">Period from</Label>
                  <Input id="period_from" type="date" value={generator.period_from} onChange={(e) => setGenerator((current) => ({ ...current, period_from: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period_to">Period to</Label>
                  <Input id="period_to" type="date" value={generator.period_to} onChange={(e) => setGenerator((current) => ({ ...current, period_to: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generation_notes">Admin notes</Label>
                <textarea
                  id="generation_notes"
                  className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  value={generator.notes}
                  onChange={(e) => setGenerator((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="Optional collection or reminder notes"
                />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={busy === "generate"}>
                {busy === "generate" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {generator.restaurant_id ? "Create restaurant commission record" : "Create records for all restaurants"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtered report</CardTitle>
            <CardDescription>Review tracked commission, mark it received, or reopen a record if payment has not arrived yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="filter_restaurant">Restaurant</Label>
                <select
                  id="filter_restaurant"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={filters.restaurant_id}
                  onChange={(e) => setFilters((current) => ({ ...current, restaurant_id: e.target.value }))}
                >
                  <option value="">All restaurants</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter_status">Status</Label>
                <select
                  id="filter_status"
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={filters.status}
                  onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter_date_from">From</Label>
                <Input id="filter_date_from" type="date" value={filters.date_from} onChange={(e) => setFilters((current) => ({ ...current, date_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter_date_to">To</Label>
                <Input id="filter_date_to" type="date" value={filters.date_to} onChange={(e) => setFilters((current) => ({ ...current, date_to: e.target.value }))} />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Loading commission records...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No commission collections found for the current filters.
              </div>
            ) : (
              <div className="space-y-4">
                {rows.map((row) => {
                  const draft = actionDrafts[row.id] ?? {
                    collection_reference: row.collection_reference ?? "",
                    notes: row.notes ?? "",
                  };
                  return (
                    <div key={row.id} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">{row.restaurant?.name ?? `Restaurant #${row.restaurant_id}`}</h3>
                            <Badge variant={row.status === "received" ? "default" : "secondary"}>
                              {row.status === "received" ? "Received" : "Pending"}
                            </Badge>
                            {row.is_overdue ? <Badge variant="destructive">Overdue by {row.overdue_days} day{row.overdue_days === 1 ? "" : "s"}</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Period: {row.period_from ?? "N/A"} to {row.period_to ?? "N/A"} · Due: {row.due_date ?? "N/A"} · {row.order_count} completed orders
                          </p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/60 p-3">
                              <p className="text-xs text-muted-foreground">Gross sales</p>
                              <p className="mt-1 font-semibold">{formatMoney(row.gross_sales)}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 p-3">
                              <p className="text-xs text-muted-foreground">Platform commission due</p>
                              <p className="mt-1 font-semibold text-primary">{formatMoney(row.commission_amount)}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 p-3">
                              <p className="text-xs text-muted-foreground">Restaurant net sales</p>
                              <p className="mt-1 font-semibold">{formatMoney(row.restaurant_net)}</p>
                            </div>
                          </div>
                          {row.payment_submitted_at ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                              <p className="font-semibold">Restaurant submitted payment proof</p>
                              <p className="mt-1">
                                Method: {row.partner_payment_method ?? "manual"}{row.partner_reference_number ? ` · Reference: ${row.partner_reference_number}` : ""}
                              </p>
                              {row.partner_payment_note ? <p className="mt-1">{row.partner_payment_note}</p> : null}
                              {row.payment_proof_url ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button type="button" size="sm" className="rounded-xl" onClick={() => setPreviewRow(row)}>
                                    View uploaded receipt
                                  </Button>
                                  <a
                                    className="inline-flex items-center gap-1 text-sm font-semibold underline"
                                    href={adminPublicFileUrl(row.payment_proof_path, row.payment_proof_url) ?? "#"}
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
                        </div>

                        <div className="grid gap-3 lg:min-w-[320px]">
                          <div className="space-y-2">
                            <Label htmlFor={`reference_${row.id}`}>Reference</Label>
                            <Input
                              id={`reference_${row.id}`}
                              value={draft.collection_reference}
                              onChange={(e) => setActionDrafts((current) => ({ ...current, [row.id]: { ...draft, collection_reference: e.target.value } }))}
                              placeholder="Cash receipt, GCash ref, etc."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`notes_${row.id}`}>Notes</Label>
                            <textarea
                              id={`notes_${row.id}`}
                              className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              value={draft.notes}
                              onChange={(e) => setActionDrafts((current) => ({ ...current, [row.id]: { ...draft, notes: e.target.value } }))}
                              placeholder="Optional notes about the manual collection"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" className="rounded-xl" disabled={busy === `mark-${row.id}`} onClick={() => void handleMark(row, "received")}>
                              {busy === `mark-${row.id}` ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                              Mark received
                            </Button>
                            <Button type="button" variant="outline" className="rounded-xl" disabled={busy === `mark-${row.id}`} onClick={() => void handleMark(row, "pending")}>
                              Move back to pending
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={previewRow != null} onOpenChange={(open) => !open && setPreviewRow(null)}>
        <SheetContent side="right" className="w-[min(100vw,64rem)] overflow-y-auto p-0 sm:max-w-none">
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Uploaded receipt</SheetTitle>
            </SheetHeader>
            {previewRow ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm">
                  <p className="font-semibold text-foreground">{previewRow.restaurant?.name ?? `Restaurant #${previewRow.restaurant_id}`}</p>
                  <p className="mt-1 text-muted-foreground">
                    {previewRow.period_from ?? "N/A"} to {previewRow.period_to ?? "N/A"} · {previewRow.partner_reference_number ? `Reference: ${previewRow.partner_reference_number}` : "No reference provided"}
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
