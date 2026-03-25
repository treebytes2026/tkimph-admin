"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminRealtime } from "@/contexts/admin-realtime-context";
import {
  AdminApiError,
  approvePartnerApplication,
  fetchPartnerApplications,
  rejectPartnerApplication,
  type PartnerApplicationRow,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Search,
  Store,
  Check,
  X,
  Mail,
  Phone,
  MapPin,
  User,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

function DetailRow({
  icon: Icon,
  label,
  value,
  empty,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  empty?: string;
}) {
  const text = value?.trim();
  if (!text && empty === undefined) return null;
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-primary shadow-sm ring-1 ring-border/50">
        <Icon className="size-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{text || empty}</p>
      </div>
    </div>
  );
}

export function PartnerApplicationsManagement() {
  const [list, setList] = useState<PartnerApplicationRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<PartnerApplicationRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPartnerApplications({
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

  function openDetail(row: PartnerApplicationRow) {
    setDetail(row);
    setAdminNotes("");
  }

  async function handleApprove() {
    if (!detail) return;
    setActing(true);
    setError(null);
    try {
      await approvePartnerApplication(detail.id, { admin_notes: adminNotes || null });
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
      await rejectPartnerApplication(detail.id, { admin_notes: adminNotes || null });
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner applications</h1>
          <p className="text-sm text-muted-foreground">
            Review restaurant partner sign-ups. Approving creates a partner account and restaurant.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="size-5" />
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
                  <span>Business</span>
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
                        <p className="font-semibold">{row.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.business_type?.name ?? "—"}
                          {row.business_category ? ` · ${row.business_category.name}` : ""}
                          {row.cuisine ? ` · ${row.cuisine.name}` : ""}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>
                          {row.owner_first_name} {row.owner_last_name}
                        </p>
                        <p className="text-muted-foreground">{row.email}</p>
                      </div>
                      <div>{statusBadge(row.status)}</div>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openDetail(row)}>
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
        <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border/80 p-0 shadow-2xl sm:max-w-xl">
          {detail ? (
            <>
              <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-muted/30 px-6 pb-5 pt-6">
                <SheetHeader className="space-y-3 p-0 pr-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Partner application
                      </p>
                      <SheetTitle className="text-left text-xl font-bold tracking-tight text-foreground">
                        Application #{detail.id}
                      </SheetTitle>
                      <SheetDescription className="text-left text-sm leading-relaxed">
                        Check the details below, add an internal note if needed, then approve or reject.
                      </SheetDescription>
                    </div>
                    <div className="shrink-0 pt-1">{statusBadge(detail.status)}</div>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="flex gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-inner ring-1 ring-primary/15">
                      <Store className="size-7 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
                          {detail.business_name}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detail.business_type?.name ? (
                            <span className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-sm">
                              {detail.business_type.name}
                            </span>
                          ) : null}
                          {detail.business_category?.name ? (
                            <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                              {detail.business_category.name}
                            </span>
                          ) : null}
                          {detail.cuisine?.name ? (
                            <span className="inline-flex items-center rounded-full border border-brand-yellow/35 bg-brand-yellow/15 px-2.5 py-0.5 text-xs font-semibold text-brand-yellow-foreground">
                              {detail.cuisine.name}
                            </span>
                          ) : null}
                          {!detail.business_type?.name &&
                          !detail.business_category?.name &&
                          !detail.cuisine?.name ? (
                            <span className="text-xs text-muted-foreground">No category tags</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-6 bg-border/70" />

                  <section className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Contact &amp; details
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-muted/50 to-muted/25 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/5">
                      <div className="divide-y divide-border/50 px-4 py-1">
                        <DetailRow
                          icon={User}
                          label="Business owner"
                          value={`${detail.owner_first_name} ${detail.owner_last_name}`}
                        />
                        <DetailRow icon={Mail} label="Email" value={detail.email} />
                        <DetailRow icon={Phone} label="Phone" value={detail.phone} />
                        <DetailRow
                          icon={MapPin}
                          label="Address"
                          value={detail.address}
                          empty="Not provided"
                        />
                        <DetailRow
                          icon={StickyNote}
                          label="Applicant notes"
                          value={detail.notes}
                          empty="None"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="mt-8 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="admin_notes" className="text-sm font-semibold text-foreground">
                        Admin notes
                      </Label>
                      <span className="text-[11px] font-medium text-muted-foreground">Optional</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Shown internally on approval or rejection. Customers won&apos;t see this.
                    </p>
                    <textarea
                      id="admin_notes"
                      rows={4}
                      placeholder="e.g. Verified phone call, documents received…"
                      className="min-h-[100px] w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-relaxed shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/15 dark:bg-input/25"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </section>

                  {detail.status !== "pending" ? (
                    <div className="mt-8 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Already reviewed</span>
                      {detail.reviewed_at ? (
                        <span>
                          {" "}
                          · {new Date(detail.reviewed_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      ) : null}
                      {detail.reviewer ? <span> · {detail.reviewer.name}</span> : null}
                    </div>
                  ) : null}
                </div>

                {detail.status === "pending" ? (
                  <SheetFooter className="shrink-0 gap-3 border-t border-border/70 bg-muted/25 px-6 py-4 sm:flex-row sm:justify-stretch">
                    <Button
                      type="button"
                      className="h-11 flex-1 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                      disabled={acting}
                      onClick={handleApprove}
                    >
                      {acting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Approve application
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 gap-2 rounded-xl border-2 border-destructive/30 bg-background font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={acting}
                      onClick={handleReject}
                    >
                      {acting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      Reject
                    </Button>
                  </SheetFooter>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
