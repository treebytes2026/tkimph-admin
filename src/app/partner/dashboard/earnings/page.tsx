"use client";

import { useEffect, useState } from "react";
import { fetchPartnerEarnings } from "@/lib/partner-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet } from "lucide-react";

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PartnerEarningsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPartnerEarnings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPartnerEarnings();
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load earnings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-8 animate-spin text-primary" />Loading earnings...</div>;
  }

  if (error || !data) {
    return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-sm text-destructive">{error ?? "Could not load earnings."}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">COD-first visibility for your order revenue and pending settlement balance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Orders</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.order_count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gross sales</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(data.gross_sales)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Service fees</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(data.service_fees)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Restaurant net</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(data.restaurant_net)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" />Settlement snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Delivery fees</p>
            <p className="mt-1 text-xl font-semibold">{formatMoney(data.delivery_fees)}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-xs text-muted-foreground">Pending settlement amount</p>
            <p className="mt-1 text-xl font-semibold">{formatMoney(data.pending_settlement_amount)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
