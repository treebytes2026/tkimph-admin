"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createPartnerPromotion,
  deletePartnerPromotion,
  fetchPartnerOverview,
  fetchPartnerPromotions,
  updatePartnerPromotion,
  type PartnerPromotion,
} from "@/lib/partner-api";
import { Loader2, Plus, Trash2 } from "lucide-react";

function formatMoney(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "PHP 0";
  return `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function PartnerPromotionsPage() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [rows, setRows] = useState<PartnerPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "10",
    min_spend: "0",
    per_user_usage_limit: "1",
    stackable: false,
    auto_apply: false,
    first_order_only: false,
  });

  const loadPromotions = useCallback(async (targetRestaurantId?: number) => {
    const rid = targetRestaurantId ?? restaurantId;
    if (!rid) return;
    const promotions = await fetchPartnerPromotions(rid);
    setRows(promotions);
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overview = await fetchPartnerOverview();
        if (cancelled) return;
        const rid = overview.restaurants[0]?.id ?? null;
        setRestaurantId(rid);
        if (rid) {
          const promotions = await fetchPartnerPromotions(rid);
          if (!cancelled) setRows(promotions);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load promotions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    const timer = window.setInterval(() => {
      void loadPromotions(restaurantId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [restaurantId, loadPromotions]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || b.id - a.id),
    [rows]
  );

  async function onCreate() {
    if (!restaurantId) return;
    setSaving(true);
    setError(null);
    try {
      await createPartnerPromotion(restaurantId, {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        is_active: true,
        min_spend: Number(form.min_spend || 0),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value || 0),
        per_user_usage_limit: Number(form.per_user_usage_limit || 1),
        stackable: form.stackable,
        auto_apply: form.auto_apply,
        first_order_only: form.first_order_only,
      });
      setForm({
        code: "",
        name: "",
        discount_type: "percentage",
        discount_value: "10",
        min_spend: "0",
        per_user_usage_limit: "1",
        stackable: false,
        auto_apply: false,
        first_order_only: false,
      });
      await loadPromotions(restaurantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(row: PartnerPromotion) {
    if (!restaurantId) return;
    try {
      await updatePartnerPromotion(restaurantId, row.id, { is_active: !row.is_active });
      await loadPromotions(restaurantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update promotion.");
    }
  }

  async function onDelete(row: PartnerPromotion) {
    if (!restaurantId) return;
    try {
      await deletePartnerPromotion(restaurantId, row.id);
      await loadPromotions(restaurantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete promotion.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        Loading promotions...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-border/80 bg-card p-5">
        <h1 className="text-xl font-bold">Promotions and pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create promo rules with minimum spend, stacking behavior, per-user limits, and auto-apply logic.
        </p>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Basic details</h3>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Promo code</span>
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. SAVE20"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <span className="text-[11px] text-muted-foreground">Customers type this at checkout.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Promo name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Weekend Launch Deal"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Discount type</span>
              <select
                value={form.discount_type}
                onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value as "percentage" | "fixed" }))}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (PHP)</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Discount value {form.discount_type === "percentage" ? "(%)" : "(PHP)"}
              </span>
              <input
                value={form.discount_value}
                onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))}
                placeholder={form.discount_type === "percentage" ? "e.g. 15" : "e.g. 100"}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </label>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Rules and eligibility</h3>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Minimum spend (PHP)</span>
              <input
                value={form.min_spend}
                onChange={(e) => setForm((prev) => ({ ...prev, min_spend: e.target.value }))}
                placeholder="e.g. 300"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <span className="text-[11px] text-muted-foreground">Order must reach this amount before promo applies.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Per-user usage limit</span>
              <input
                value={form.per_user_usage_limit}
                onChange={(e) => setForm((prev) => ({ ...prev, per_user_usage_limit: e.target.value }))}
                placeholder="e.g. 1"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <span className="text-[11px] text-muted-foreground">How many times one customer can use this promo.</span>
            </label>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.stackable}
                  onChange={(e) => setForm((prev) => ({ ...prev, stackable: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-foreground">Stackable</span>
                  <span className="block text-xs text-muted-foreground">Allow this promo to combine with other promos.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.auto_apply}
                  onChange={(e) => setForm((prev) => ({ ...prev, auto_apply: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-foreground">Auto-apply</span>
                  <span className="block text-xs text-muted-foreground">System applies promo automatically when eligible.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.first_order_only}
                  onChange={(e) => setForm((prev) => ({ ...prev, first_order_only: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-foreground">First order only</span>
                  <span className="block text-xs text-muted-foreground">Only new customers can use this promo.</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button type="button" onClick={() => void onCreate()} disabled={saving || !restaurantId}>
            <Plus className="mr-2 size-4" />
            {saving ? "Saving..." : "Create promotion"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">Active rules ({sortedRows.length})</h2>
        <div className="mt-3 space-y-2">
          {sortedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No promotions yet.</p>
          ) : (
            sortedRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.code} - {row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.discount_type === "percentage" ? `${Number(row.discount_value)}% off` : `${formatMoney(row.discount_value)} off`}
                    {" | "}Min spend {formatMoney(row.min_spend)}
                    {" | "}Per user {row.per_user_usage_limit}
                    {row.stackable ? " | stackable" : ""}
                    {row.auto_apply ? " | auto" : ""}
                    {row.first_order_only ? " | first-order only" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void onToggleActive(row)}>
                    {row.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void onDelete(row)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
