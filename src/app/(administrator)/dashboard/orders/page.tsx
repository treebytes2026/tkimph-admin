"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addAdminOrderNote,
  addAdminOrderSupportNote,
  assignAdminOrderRider,
  fetchAdminOrder,
  fetchAdminOrders,
  fetchAdminOrderSummary,
  fetchAdminRiders,
  updateAdminOrderStatus,
  type AdminOrderDetail,
  type AdminOrderRow,
  type AdminOrderSummary,
  type AdminRiderOption,
  type AdminSupportNote,
} from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Loader2, ShoppingBag } from "lucide-react";

const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
  "failed",
  "undeliverable",
] as const;

function formatCurrency(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [riderFilter, setRiderFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminOrderSummary | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusUpdate, setStatusUpdate] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [riderId, setRiderId] = useState<string>("");
  const [riderNote, setRiderNote] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [supportType, setSupportType] = useState<AdminSupportNote["note_type"]>("internal_note");
  const [supportBody, setSupportBody] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [riderOptions, setRiderOptions] = useState<AdminRiderOption[]>([]);

  const canPrev = page > 1;
  const canNext = page < lastPage;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [res, summaryRes] = await Promise.all([
        fetchAdminOrders({
          page,
          per_page: 12,
          status: statusFilter === "all" ? undefined : statusFilter,
          search: search || undefined,
          rider_id:
            riderFilter === "all"
              ? undefined
              : riderFilter === "unassigned"
                ? "unassigned"
                : Number(riderFilter),
        }),
        fetchAdminOrderSummary(),
      ]);
      setOrders(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
      setSummary(summaryRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, riderFilter]);

  const loadRiderOptions = useCallback(async () => {
    try {
      const ridersRes = await fetchAdminRiders({ per_page: 100, active: true });
      setRiderOptions(ridersRes.data);
    } catch {
      setRiderOptions([]);
    }
  }, []);

  async function openDetail(orderId: number) {
    setSelectedOrderId(orderId);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [orderRes, ridersRes] = await Promise.all([
        fetchAdminOrder(orderId),
        fetchAdminRiders({ per_page: 100, active: true }),
      ]);
      setDetail(orderRes);
      setStatusUpdate(orderRes.status);
      setCancellationReason(orderRes.cancellation_reason ?? "");
      setRiderId(orderRes.rider?.id ? String(orderRes.rider.id) : "");
      setRiderOptions(ridersRes.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!selectedOrderId) return;
    const orderRes = await fetchAdminOrder(selectedOrderId);
    setDetail(orderRes);
    setStatusUpdate(orderRes.status);
    setCancellationReason(orderRes.cancellation_reason ?? "");
    setRiderId(orderRes.rider?.id ? String(orderRes.rider.id) : "");
  }

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadRiderOptions();
  }, [loadRiderOptions]);

  const detailNotes = useMemo(() => detail?.notes ?? [], [detail]);

  async function onUpdateStatus() {
    if (!detail) return;
    setActionPending(true);
    try {
      await updateAdminOrderStatus(detail.id, {
        status: statusUpdate,
        note: statusNote.trim() || null,
        cancellation_reason: cancellationReason.trim() || null,
      });
      setStatusNote("");
      await Promise.all([refreshDetail(), loadOrders()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setActionPending(false);
    }
  }

  async function onAssignRider() {
    if (!detail) return;
    setActionPending(true);
    try {
      await assignAdminOrderRider(detail.id, {
        rider_id: riderId ? Number(riderId) : null,
        note: riderNote.trim() || null,
      });
      setRiderNote("");
      await Promise.all([refreshDetail(), loadOrders()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign rider.");
    } finally {
      setActionPending(false);
    }
  }

  async function onAddNote() {
    if (!detail || !noteDraft.trim()) return;
    setActionPending(true);
    try {
      await addAdminOrderNote(detail.id, noteDraft.trim());
      setNoteDraft("");
      await refreshDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add note.");
    } finally {
      setActionPending(false);
    }
  }

  async function onAddSupportNote() {
    if (!detail || !supportBody.trim()) return;
    setActionPending(true);
    try {
      await addAdminOrderSupportNote(detail.id, { note_type: supportType, body: supportBody.trim() });
      setSupportBody("");
      await refreshDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add support note.");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            Orders management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Unassigned active</p>
              <p className="text-lg font-semibold text-foreground">{summary?.unassigned_active_orders ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Stalled orders</p>
              <p className="text-lg font-semibold text-foreground">{summary?.stalled_orders ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Active riders</p>
              <p className="text-lg font-semibold text-foreground">{summary?.active_riders ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Out for delivery</p>
              <p className="text-lg font-semibold text-foreground">{summary?.out_for_delivery ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>{formatStatus(status)}</option>
              ))}
            </select>

            <select
              value={riderFilter}
              onChange={(e) => {
                setPage(1);
                setRiderFilter(e.target.value);
              }}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">All riders</option>
              <option value="unassigned">Unassigned only</option>
              {riderOptions.map((rider) => (
                <option key={rider.id} value={String(rider.id)}>
                  {rider.name}
                </option>
              ))}
            </select>

            <Input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search order/customer/restaurant" className="h-10 max-w-sm" />
            <Button type="button" variant="outline" onClick={() => { setPage(1); setSearch(searchDraft.trim()); }}>Search</Button>
          </div>

          {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Order</span>
              <span>Customer</span>
              <span>Status</span>
              <span>Total</span>
              <span className="text-right">Action</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Loading orders...</div>
            ) : orders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No orders found.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {orders.map((order) => (
                  <li key={order.id} className="grid grid-cols-[1.2fr_1fr_0.9fr_0.9fr_auto] gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.restaurant?.name ?? "Restaurant"}</p>
                    </div>
                    <div>
                      <p className="text-foreground">{order.customer?.name ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground">{order.customer?.phone ?? "No phone"}</p>
                    </div>
                    <div>
                      <Badge variant={order.is_stalled ? "destructive" : "secondary"}>{formatStatus(order.status)}</Badge>
                    </div>
                    <p className="font-semibold text-foreground">{formatCurrency(order.total)}</p>
                    <div className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(order.id)}>Open</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Total: {total.toLocaleString("en-PH")}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-muted-foreground">Page {page} of {lastPage}</span>
              <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-[min(100vw,56rem)] overflow-y-auto p-0 sm:max-w-none">
          <div className="space-y-4 p-5">
            {detailLoading || !detail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Loading order detail...</div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{detail.order_number}</h2>
                  <p className="text-sm text-muted-foreground">{detail.customer?.name ?? "Customer"} - {detail.restaurant?.name ?? "Restaurant"}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Status update</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                        {ORDER_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                      </select>
                      <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Reason / context note (optional)" />
                      {statusUpdate === "cancelled" || statusUpdate === "failed" || statusUpdate === "undeliverable" ? (
                        <Input value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} placeholder="Cancellation or failure reason" />
                      ) : null}
                      <Button type="button" disabled={actionPending} onClick={() => void onUpdateStatus()}>{actionPending ? "Updating..." : "Update status"}</Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Rider assignment</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <select value={riderId} onChange={(e) => setRiderId(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                        <option value="">Unassigned</option>
                        {riderOptions.map((rider) => <option key={rider.id} value={rider.id}>{rider.name} ({rider.phone || "No phone"})</option>)}
                      </select>
                      <Input value={riderNote} onChange={(e) => setRiderNote(e.target.value)} placeholder="Assignment note (optional)" />
                      <Button type="button" variant="outline" disabled={actionPending} onClick={() => void onAssignRider()}>{actionPending ? "Saving..." : "Save rider"}</Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Financial snapshot</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border/70 p-3"><p className="text-xs text-muted-foreground">Gross sales</p><p className="font-semibold">{formatCurrency(detail.gross_sales)}</p></div>
                    <div className="rounded-lg border border-border/70 p-3"><p className="text-xs text-muted-foreground">Service fee</p><p className="font-semibold">{formatCurrency(detail.service_fee)}</p></div>
                    <div className="rounded-lg border border-border/70 p-3"><p className="text-xs text-muted-foreground">Delivery fee</p><p className="font-semibold">{formatCurrency(detail.delivery_fee)}</p></div>
                    <div className="rounded-lg border border-border/70 p-3"><p className="text-xs text-muted-foreground">Restaurant net</p><p className="font-semibold">{formatCurrency(detail.restaurant_net)}</p></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {detail.items.map((item) => <div key={item.id} className="flex items-center justify-between text-sm"><p>{item.quantity}x {item.name}</p><p className="font-medium">{formatCurrency(item.line_total)}</p></div>)}
                    <div className="border-t border-border/70 pt-2 text-right font-semibold">Total: {formatCurrency(detail.total)}</div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Audit notes</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add internal note" />
                        <Button type="button" disabled={actionPending || !noteDraft.trim()} onClick={() => void onAddNote()}>Add</Button>
                      </div>
                      <div className="space-y-2">
                        {detailNotes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : detailNotes.map((note) => (
                          <div key={note.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                            <p className="text-foreground">{note.note}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{note.admin?.name ?? "Admin"} - {note.created_at ? new Date(note.created_at).toLocaleString("en-PH") : "Now"}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Support notes</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                        <select value={supportType} onChange={(e) => setSupportType(e.target.value as AdminSupportNote["note_type"])} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                          <option value="internal_note">Internal note</option>
                          <option value="contact_log">Contact log</option>
                          <option value="issue_tag">Issue tag</option>
                        </select>
                        <Input value={supportBody} onChange={(e) => setSupportBody(e.target.value)} placeholder="Add support log entry" />
                        <Button type="button" disabled={actionPending || !supportBody.trim()} onClick={() => void onAddSupportNote()}>Add</Button>
                      </div>
                      <div className="space-y-2">
                        {(detail.support_notes ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No support notes yet.</p> : detail.support_notes.map((note) => (
                          <div key={note.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3"><Badge variant="outline">{note.note_type.replaceAll("_", " ")}</Badge><span className="text-xs text-muted-foreground">{note.created_at ? new Date(note.created_at).toLocaleString("en-PH") : "Now"}</span></div>
                            <p className="mt-2 text-foreground">{note.body}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {detail.timeline.length === 0 ? <p className="text-sm text-muted-foreground">No timeline entries yet.</p> : detail.timeline.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">{event.event_type.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{event.from_status ? `${formatStatus(event.from_status)} -> ` : ""}{event.to_status ? formatStatus(event.to_status) : "No status change"}</p>
                        {event.note ? <p className="mt-1 text-foreground">{event.note}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground">{event.actor?.name ?? "System"} - {event.created_at ? new Date(event.created_at).toLocaleString("en-PH") : "Now"}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
