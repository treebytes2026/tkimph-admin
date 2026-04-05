"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchPartnerOrders,
  markAllPartnerNotificationsRead,
  PartnerApiError,
  type PartnerOrder,
  updatePartnerOrderStatus,
} from "@/lib/partner-api";
import { cn } from "@/lib/utils";
import { BellRing, Clock3, Loader2, Phone, ShieldAlert, Store, Truck, UserRound } from "lucide-react";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "completed", label: "Completed" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatCurrency(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  return `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PartnerOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<number, string>>({});
  const orderSummary = useMemo(() => {
    const counts = {
      pending: 0,
      preparing: 0,
      out_for_delivery: 0,
    };
    for (const order of orders) {
      if (order.status === "pending") counts.pending += 1;
      if (order.status === "preparing") counts.preparing += 1;
      if (order.status === "out_for_delivery") counts.out_for_delivery += 1;
    }
    return counts;
  }, [orders]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchPartnerOrders({
          status: statusFilter === "all" ? undefined : statusFilter,
          per_page: 30,
        });
        if (cancelled) return;
        setOrders(res.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof PartnerApiError ? err.message : "Could not load orders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    markAllPartnerNotificationsRead().catch(() => {});
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [statusFilter]);

  async function setStatus(orderId: number, status: string) {
    setUpdatingId(orderId);
    try {
      const reason = reasonDrafts[orderId]?.trim() || null;
      const res = await updatePartnerOrderStatus(orderId, status, reason);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? res.order : order))
      );
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live order board for incoming, kitchen, and dispatch activity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              className="rounded-full"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                <BellRing className="size-4" />
                Notification flow
              </p>
              <p className="mt-3 text-lg font-semibold">Order updates are refreshing every 5 seconds.</p>
              <p className="mt-1 text-sm text-slate-300">
                New order alerts are marked read here automatically so your queue stays clean while you work.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100">
              <span className="size-2 rounded-full bg-emerald-400" />
              Live board
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending now</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{orderSummary.pending}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock3 className="size-4 text-amber-500" />
              Preparing
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{orderSummary.preparing}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Truck className="size-4 text-sky-600" />
              Out for delivery
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{orderSummary.out_for_delivery}</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Notification or order sync issue</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No orders yet for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <CardDescription>
                      {order.placed_at
                        ? new Date(order.placed_at).toLocaleString("en-PH")
                        : "Just now"}
                    </CardDescription>
                  </div>
                  <Badge
                    className={cn(
                      "capitalize",
                      order.status === "pending" && "bg-amber-100 text-amber-900",
                      order.status === "accepted" && "bg-sky-100 text-sky-900",
                      order.status === "preparing" && "bg-indigo-100 text-indigo-900",
                      order.status === "out_for_delivery" && "bg-violet-100 text-violet-900",
                      order.status === "completed" && "bg-emerald-100 text-emerald-900",
                      order.status === "cancelled" && "bg-rose-100 text-rose-900"
                    )}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Store className="size-4 text-primary" />
                    {order.restaurant?.name ?? "Restaurant"}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <UserRound className="size-4 text-primary" />
                    {order.customer?.name ?? "Customer"}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-4 text-primary" />
                    {order.customer?.phone ?? "No phone"}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Payment:</span> COD
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{order.delivery_address}</p>
                  {order.delivery_note ? (
                    <p className="mt-1 text-sm text-muted-foreground">Note: {order.delivery_note}</p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Items</p>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <p className="text-foreground">
                        {item.quantity}x {item.name}
                      </p>
                      <p className="font-medium text-foreground">{formatCurrency(item.line_total)}</p>
                    </div>
                  ))}
                  <div className="border-t border-border/70 pt-2 text-right text-sm font-semibold text-foreground">
                    Total: {formatCurrency(order.total)}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Exception reason</p>
                  <Input
                    value={reasonDrafts[order.id] ?? ""}
                    onChange={(e) =>
                      setReasonDrafts((current) => ({ ...current, [order.id]: e.target.value }))
                    }
                    placeholder="Use when cancelling or marking a failure"
                  />
                  {order.cancellation_reason ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last recorded reason: {order.cancellation_reason}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={order.status === "accepted" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "accepted")}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant={order.status === "preparing" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "preparing")}
                  >
                    Preparing
                  </Button>
                  <Button
                    type="button"
                    variant={order.status === "out_for_delivery" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "out_for_delivery")}
                  >
                    Out for delivery
                  </Button>
                  <Button
                    type="button"
                    variant={order.status === "completed" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "completed")}
                  >
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant={order.status === "cancelled" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "cancelled")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant={order.status === "failed" ? "default" : "outline"}
                    disabled={updatingId === order.id}
                    onClick={() => setStatus(order.id, "failed")}
                  >
                    Failed
                  </Button>
                </div>

                {order.timeline?.length ? (
                  <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</p>
                    {order.timeline.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">
                          {event.event_type.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.from_status ? `${STATUS_LABELS[event.from_status] ?? event.from_status} -> ` : ""}
                          {event.to_status ? STATUS_LABELS[event.to_status] ?? event.to_status : "No status change"}
                        </p>
                        {event.note ? <p className="mt-1 text-foreground">{event.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
