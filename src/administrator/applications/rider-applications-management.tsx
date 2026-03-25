"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminRealtime } from "@/contexts/admin-realtime-context";
import {
  AdminApiError,
  approveRiderApplication,
  fetchRiderApplications,
  rejectRiderApplication,
  type RiderApplicationRow,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Search, Bike, Check, X } from "lucide-react";

function statusBadge(status: string) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="font-medium">
        Pending
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge className="border-0 bg-primary/15 font-medium text-primary hover:bg-primary/20">
        Approved
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-destructive/10 font-medium text-destructive hover:bg-destructive/15">
      Rejected
    </Badge>
  );
}

export function RiderApplicationsManagement() {
  const [list, setList] = useState<RiderApplicationRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<RiderApplicationRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRiderApplications({
        page,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setList(res.data);
      setLastPage(res.last_page);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load applications");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const { lastUpdatedAt } = useAdminRealtime();
  const skipPollRefresh = useRef(true);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (lastUpdatedAt == null) return;
    if (skipPollRefresh.current) {
      skipPollRefresh.current = false;
      return;
    }
    void load();
  }, [lastUpdatedAt, load]);

  async function handleApprove() {
    if (!detail) return;
    setActing(true);
    setError(null);
    try {
      await approveRiderApplication(detail.id, { admin_notes: adminNotes || null });
      setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Approve failed");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!detail) return;
    setActing(true);
    setError(null);
    try {
      await rejectRiderApplication(detail.id, { admin_notes: adminNotes || null });
      setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Reject failed");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rider applications</h1>
        <p className="text-sm text-muted-foreground">
          Review rider sign-ups. Approving creates a rider account.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bike className="size-5" />
            Queue
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="flex items-center gap-1">
              <Input
                placeholder="Search…"
                className="h-8 w-44 sm:w-56"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setSearch(searchInput.trim());
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => {
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications found.</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <div className="hidden grid-cols-[1fr_1fr_auto_auto] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Applicant</span>
                  <span>Contact</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {list.map((row) => (
                    <li
                      key={row.id}
                      className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.vehicle_type ?? "—"} · {row.license_number ?? "—"}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>{row.email}</p>
                        <p className="text-muted-foreground">{row.phone}</p>
                      </div>
                      <div>{statusBadge(row.status)}</div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => {
                            setDetail(row);
                            setAdminNotes("");
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground">
                  Page {page} of {lastPage}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Application #{detail?.id}</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className="flex flex-1 flex-col gap-4 text-sm">
              <div className="grid gap-1 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p>
                  <span className="text-muted-foreground">Name:</span> {detail.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span> {detail.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Phone:</span> {detail.phone}
                </p>
                {detail.address ? (
                  <p>
                    <span className="text-muted-foreground">Address:</span> {detail.address}
                  </p>
                ) : null}
                {detail.vehicle_type ? (
                  <p>
                    <span className="text-muted-foreground">Vehicle:</span> {detail.vehicle_type}
                  </p>
                ) : null}
                {detail.license_number ? (
                  <p>
                    <span className="text-muted-foreground">License:</span> {detail.license_number}
                  </p>
                ) : null}
                {detail.notes ? (
                  <p>
                    <span className="text-muted-foreground">Notes:</span> {detail.notes}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rider_admin_notes">Admin notes (optional)</Label>
                <textarea
                  id="rider_admin_notes"
                  rows={3}
                  className="min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
              {detail.status === "pending" ? (
                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2 rounded-xl bg-primary"
                    disabled={acting}
                    onClick={handleApprove}
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2 rounded-xl"
                    disabled={acting}
                    onClick={handleReject}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Reviewed {detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : "—"}
                  {detail.reviewer ? ` · ${detail.reviewer.name}` : ""}
                </p>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
