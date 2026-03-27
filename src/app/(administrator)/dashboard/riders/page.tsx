"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminRider,
  fetchAdminRiders,
  setAdminRiderActive,
  type AdminRiderDetail,
  type AdminRiderOption,
} from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Bike, Loader2 } from "lucide-react";

export default function RidersPage() {
  const [riders, setRiders] = useState<AdminRiderOption[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminRiderDetail | null>(null);

  const loadRiders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminRiders({
        page,
        per_page: 15,
        search: search || undefined,
        active: activeFilter === "all" ? undefined : activeFilter === "active",
      });
      setRiders(res.data);
      setLastPage(res.last_page);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load riders.");
    } finally {
      setLoading(false);
    }
  }, [page, search, activeFilter]);

  useEffect(() => {
    void loadRiders();
  }, [loadRiders]);

  async function openDetail(riderId: number) {
    setSelectedRiderId(riderId);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetchAdminRider(riderId);
      setDetail(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rider detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function onToggleActive(nextActive: boolean) {
    if (!detail || !selectedRiderId) return;
    try {
      await setAdminRiderActive(selectedRiderId, nextActive);
      const refreshed = await fetchAdminRider(selectedRiderId);
      setDetail(refreshed);
      await loadRiders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update rider status.");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="size-5" />
            Riders management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeFilter}
              onChange={(e) => {
                setPage(1);
                setActiveFilter(e.target.value);
              }}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">All riders</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search rider name/email/phone"
              className="h-10 max-w-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPage(1);
                setSearch(searchDraft.trim());
              }}
            >
              Search
            </Button>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_auto] gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Rider</span>
              <span>Status</span>
              <span>Active orders</span>
              <span>Completed</span>
              <span className="text-right">Action</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Loading riders...
              </div>
            ) : riders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No riders found.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {riders.map((rider) => (
                  <li key={rider.id} className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_auto] gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{rider.name}</p>
                      <p className="text-xs text-muted-foreground">{rider.phone || rider.email}</p>
                    </div>
                    <div>
                      <Badge variant={rider.is_active ? "default" : "secondary"}>
                        {rider.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground">{rider.active_orders_count}</p>
                    <p className="font-medium text-foreground">{rider.completed_orders_count}</p>
                    <div className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(rider.id)}>
                        Open
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {lastPage}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-[min(100vw,44rem)] overflow-y-auto p-0 sm:max-w-none">
          <div className="space-y-4 p-5">
            {detailLoading || !detail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Loading rider detail...
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{detail.name}</h2>
                  <p className="text-sm text-muted-foreground">{detail.phone || detail.email}</p>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Availability</CardTitle></CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <Badge variant={detail.is_active ? "default" : "secondary"}>
                      {detail.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void onToggleActive(!detail.is_active)}
                    >
                      {detail.is_active ? "Set inactive" : "Set active"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Recent assigned orders</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {detail.recent_orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No assigned orders yet.</p>
                    ) : (
                      detail.recent_orders.map((order) => (
                        <div key={order.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                          <p className="font-medium text-foreground">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.restaurant?.name || "Restaurant"} - {order.status.replaceAll("_", " ")}
                          </p>
                        </div>
                      ))
                    )}
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
