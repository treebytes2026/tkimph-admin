"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AdminApiError,
  fetchAdminNotifications,
  markNotificationRead,
  type AdminNotificationRow,
} from "@/lib/admin-api";

function notificationKind(n: AdminNotificationRow): string {
  return String(n.data?.type ?? n.data?.category ?? "").trim();
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown time";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown time";
  return d.toLocaleString("en-PH");
}

export default function AdminHelpCenterPage() {
  const [items, setItems] = useState<AdminNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminNotifications({ page: 1, per_page: 100 });
      setItems(res.data.filter((n) => notificationKind(n) === "customer_help_center"));
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not load help center concerns.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  async function markRead(id: string) {
    setMarkingId(id);
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch {
      // no-op
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Help center concerns</CardTitle>
            <CardDescription>Customer concerns sent from Help center, directed to admin support.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{unreadCount} unread</Badge>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading concerns...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              No help center concerns yet.
            </p>
          ) : (
            items.map((item) => {
              const unread = !item.read_at;
              const subject = typeof item.data?.subject === "string" ? item.data.subject : "No subject";
              const customerName = typeof item.data?.customer_name === "string" ? item.data.customer_name : "Customer";
              const customerEmail = typeof item.data?.customer_email === "string" ? item.data.customer_email : null;
              const customerPhone = typeof item.data?.customer_phone === "string" ? item.data.customer_phone : null;
              const body = typeof item.data?.message_body === "string" ? item.data.message_body : item.data?.message;

              return (
                <div
                  key={item.id}
                  className={`space-y-2 rounded-xl border p-4 ${unread ? "border-primary/40 bg-primary/[0.05]" : "border-border"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{subject}</p>
                    <span className="text-xs text-muted-foreground">{formatWhen(item.created_at)}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    From: {customerName}
                    {customerEmail ? ` - ${customerEmail}` : ""}
                    {customerPhone ? ` - ${customerPhone}` : ""}
                  </p>

                  <p className="whitespace-pre-wrap text-sm text-foreground">{String(body ?? "No message body.")}</p>

                  <div className="flex justify-end gap-2">
                    {customerEmail ? (
                      <Button type="button" variant="outline" asChild>
                        <a href={`mailto:${customerEmail}`}>Email customer</a>
                      </Button>
                    ) : null}
                    {customerPhone ? (
                      <Button type="button" variant="outline" asChild>
                        <a href={`tel:${customerPhone}`}>Call customer</a>
                      </Button>
                    ) : null}
                    {unread ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void markRead(item.id)}
                        disabled={markingId === item.id}
                      >
                        {markingId === item.id ? "Updating..." : "Mark as read"}
                      </Button>
                    ) : (
                      <Badge variant="secondary">Read</Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
