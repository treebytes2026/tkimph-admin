"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Phone, Store, UserRound } from "lucide-react";

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
          <p className="mt-1 text-sm text-muted-foreground">
            New orders auto-refresh every 5 seconds.
          </p>
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

      {error ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
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
