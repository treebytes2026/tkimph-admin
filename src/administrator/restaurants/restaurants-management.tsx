"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  type AdminRestaurant,
  type AdminSettlementSummary,
  type AdminSupportNote,
  addRestaurantSupportNote,
  createRestaurant,
  deleteRestaurant,
  fetchPartners,
  fetchRestaurant,
  fetchRestaurantSettlementSummary,
  fetchRestaurants,
  toggleRestaurantActive,
  updateRestaurant,
  updateRestaurantOperatingStatus,
  updateRestaurantPublicOrderOverride,
  type PartnerOption,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Pencil, Plus, Search, Store, Trash2, Wallet } from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  phone: "",
  address: "",
  user_id: "" as string | number,
};

const operatingOptions = [
  { value: "open", label: "Open" },
  { value: "paused", label: "Paused" },
  { value: "temporarily_closed", label: "Temporarily closed" },
  { value: "suspended", label: "Suspended" },
] as const;

function formatMoney(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RestaurantsManagement() {
  const [list, setList] = useState<AdminRestaurant[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRestaurant | null>(null);
  const [detail, setDetail] = useState<AdminRestaurant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [operatingStatus, setOperatingStatus] = useState<AdminRestaurant["operating_status"]>("open");
  const [operatingNote, setOperatingNote] = useState("");
  const [pausedUntil, setPausedUntil] = useState("");
  const [operatingSaving, setOperatingSaving] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [supportType, setSupportType] = useState<AdminSupportNote["note_type"]>("internal_note");
  const [supportBody, setSupportBody] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);
  const [settlement, setSettlement] = useState<AdminSettlementSummary | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

  const loadPartners = useCallback(async () => {
    try {
      const p = await fetchPartners();
      setPartners(p);
    } catch {
      setPartners([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRestaurants({ page, search: search || undefined });
      setList(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load restaurants");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  async function loadRestaurantDetail(id: number) {
    const [restaurantRes, settlementRes] = await Promise.all([
      fetchRestaurant(id),
      fetchRestaurantSettlementSummary(id),
    ]);
    setDetail(restaurantRes);
    setOperatingStatus(restaurantRes.operating_status);
    setOperatingNote(restaurantRes.operating_note ?? "");
    setPausedUntil(restaurantRes.paused_until ? restaurantRes.paused_until.slice(0, 16) : "");
    setSettlement(settlementRes);
  }

  function openCreate() {
    setEditing(null);
    setDetail(null);
    setSettlement(null);
    setSupportBody("");
    setOperatingStatus("open");
    setOperatingNote("");
    setPausedUntil("");
    setForm({ ...emptyForm, user_id: partners[0]?.id ?? "" });
    setSheetOpen(true);
  }

  async function openEdit(r: AdminRestaurant) {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      user_id: r.user_id,
    });
    setSheetOpen(true);
    setSettlementLoading(true);
    try {
      await loadRestaurantDetail(r.id);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not load restaurant detail.");
    } finally {
      setSettlementLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const uid = Number(form.user_id);
    if (!uid) {
      setError("Select a restaurant partner (create one under Users if needed).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        phone: form.phone || null,
        address: form.address || null,
        user_id: uid,
      };
      if (editing) {
        await updateRestaurant(editing.id, body);
        await loadRestaurantDetail(editing.id);
      } else {
        await createRestaurant(body);
      }
      await load();
      await loadPartners();
      if (!editing) setSheetOpen(false);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: AdminRestaurant) {
    if (!window.confirm(`Delete \"${r.name}\"? This cannot be undone.`)) return;
    setDeletingId(r.id);
    setError(null);
    try {
      await deleteRestaurant(r.id);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(r: AdminRestaurant) {
    setTogglingId(r.id);
    setError(null);
    try {
      await toggleRestaurantActive(r.id);
      await load();
      if (detail?.id === r.id) await loadRestaurantDetail(r.id);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  }

  async function saveOperatingStatus() {
    if (!editing) return;
    setOperatingSaving(true);
    setError(null);
    try {
      await updateRestaurantOperatingStatus(editing.id, {
        operating_status: operatingStatus,
        operating_note: operatingNote,
        paused_until: operatingStatus === "paused" && pausedUntil ? new Date(pausedUntil).toISOString() : null,
      });
      await Promise.all([load(), loadRestaurantDetail(editing.id)]);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not update operating status.");
    } finally {
      setOperatingSaving(false);
    }
  }

  async function togglePublicOrderOverride() {
    if (!editing || !detail) return;
    setOverrideSaving(true);
    setError(null);
    try {
      await updateRestaurantPublicOrderOverride(editing.id, !detail.force_publicly_orderable);
      await Promise.all([load(), loadRestaurantDetail(editing.id)]);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not update public order override.");
    } finally {
      setOverrideSaving(false);
    }
  }

  async function saveSupportNote() {
    if (!editing || !supportBody.trim()) return;
    setSupportSaving(true);
    setError(null);
    try {
      await addRestaurantSupportNote(editing.id, { note_type: supportType, body: supportBody.trim() });
      setSupportBody("");
      await loadRestaurantDetail(editing.id);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not add support note.");
    } finally {
      setSupportSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Restaurant partners</h1>
          <p className="text-sm text-muted-foreground">
            Link each store to a partner account and manage launch readiness, availability, and support history.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 gap-2 rounded-xl font-semibold shadow-sm" disabled={partners.length === 0}>
          <Plus className="size-4" />
          Add restaurant
        </Button>
      </div>

      {partners.length === 0 && (
        <div className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-foreground">
          No active restaurant partners yet. Go to <strong>Users</strong>, add a user with role <strong>Restaurant partner</strong>, then return here.
        </div>
      )}

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="size-5 text-primary" />
            Restaurants
            <span className="text-sm font-normal text-muted-foreground">({total})</span>
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search name, address, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))}
              className="h-10 max-w-xs rounded-xl"
            />
            <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => { setSearch(searchInput); setPage(1); }}>
              <Search className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="size-8 animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Store className="size-12 opacity-40" />
              <p>No restaurants yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Restaurant</th>
                    <th className="hidden px-4 py-3 xl:table-cell">Readiness</th>
                    <th className="px-4 py-3">Availability</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{r.address ?? "-"}</p>
                        {r.owner && <p className="mt-1 text-xs text-muted-foreground">{r.owner.name} · {r.owner.email}</p>}
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={r.readiness_status === "ready" ? "default" : "secondary"}>{r.readiness_status === "ready" ? "Ready" : "Incomplete"}</Badge>
                          <Badge variant={r.publicly_orderable ? "default" : "outline"}>{r.publicly_orderable ? "Publicly orderable" : "Blocked"}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={r.operating_status === "open" ? "default" : "secondary"} className="w-fit">{r.operating_status.replaceAll("_", " ")}</Badge>
                          {!r.is_active && <span className="text-xs text-muted-foreground">Inactive account flag</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" className="rounded-lg" onClick={() => openEdit(r)} aria-label="Edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" className="rounded-lg text-destructive hover:text-destructive" disabled={deletingId === r.id} onClick={() => handleDelete(r)} aria-label="Delete">
                            {deletingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastPage > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Page {page} of {lastPage}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editing ? "Restaurant operations" : "Add restaurant"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6 px-4 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="space-y-2">
                <Label htmlFor="r-partner">Partner account</Label>
                <select
                  id="r-partner"
                  required
                  value={form.user_id === "" ? "" : String(form.user_id)}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : "" }))}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select partner...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="r-name">Restaurant name</Label>
                  <Input id="r-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="r-desc">Description</Label>
                  <Input id="r-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-phone">Phone</Label>
                  <Input id="r-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-address">Address</Label>
                  <Input id="r-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1 rounded-xl font-semibold">{saving ? <Loader2 className="size-4 animate-spin" /> : editing ? "Save core details" : "Create"}</Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setSheetOpen(false)}>Close</Button>
              </div>
            </form>

            {editing ? (
              settlementLoading || !detail ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" /> Loading restaurant operations...
                </div>
              ) : (
                <>
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Readiness and visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={detail.readiness_status === "ready" ? "default" : "secondary"}>{detail.readiness_status === "ready" ? "Ready for launch" : "Needs setup"}</Badge>
                        <Badge variant={detail.publicly_orderable ? "default" : "outline"}>{detail.publicly_orderable ? "Visible to customers" : "Blocked from ordering"}</Badge>
                        <Badge variant={detail.force_publicly_orderable ? "default" : "outline"}>
                          {detail.force_publicly_orderable ? "Admin override ON" : "Admin override OFF"}
                        </Badge>
                        <Button type="button" variant={detail.is_active ? "outline" : "secondary"} size="sm" className="h-8 rounded-lg" disabled={togglingId === detail.id} onClick={() => handleToggle(detail)}>
                          {togglingId === detail.id ? <Loader2 className="size-3 animate-spin" /> : detail.is_active ? "Active" : "Inactive"}
                        </Button>
                        <Button
                          type="button"
                          variant={detail.force_publicly_orderable ? "destructive" : "secondary"}
                          size="sm"
                          className="h-8 rounded-lg"
                          disabled={overrideSaving}
                          onClick={() => void togglePublicOrderOverride()}
                        >
                          {overrideSaving
                            ? "Saving..."
                            : detail.force_publicly_orderable
                              ? "Disable admin override"
                              : "Force publicly orderable"}
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {detail.readiness_checks.map((check) => (
                          <div key={check.key} className="rounded-xl border border-border/60 px-3 py-2 text-sm">
                            <p className="font-medium text-foreground">{check.label}</p>
                            <p className={check.passed ? "text-emerald-700" : "text-muted-foreground"}>{check.passed ? "Complete" : "Missing"}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Operating controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <select value={operatingStatus} onChange={(e) => setOperatingStatus(e.target.value as AdminRestaurant["operating_status"])} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                        {operatingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <Input value={operatingNote} onChange={(e) => setOperatingNote(e.target.value)} placeholder="Reason shown in operations" />
                      {operatingStatus === "paused" ? <Input type="datetime-local" value={pausedUntil} onChange={(e) => setPausedUntil(e.target.value)} /> : null}
                      <Button type="button" disabled={operatingSaving || !operatingNote.trim()} onClick={() => void saveOperatingStatus()}>
                        {operatingSaving ? "Saving..." : "Save operating status"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" /> Settlement summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Orders</p><p className="text-xl font-semibold">{settlement?.order_count ?? 0}</p></div>
                      <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Gross sales</p><p className="text-xl font-semibold">{formatMoney(settlement?.gross_sales ?? 0)}</p></div>
                      <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Service fees</p><p className="text-xl font-semibold">{formatMoney(settlement?.service_fees ?? 0)}</p></div>
                      <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">Restaurant net</p><p className="text-xl font-semibold">{formatMoney(settlement?.restaurant_net ?? 0)}</p></div>
                      <div className="rounded-xl border border-border/60 p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Pending settlement amount</p><p className="text-xl font-semibold">{formatMoney(settlement?.pending_settlement_amount ?? 0)}</p></div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base">Support log</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                        <select value={supportType} onChange={(e) => setSupportType(e.target.value as AdminSupportNote["note_type"])} className="h-10 rounded-xl border border-input bg-background px-3 text-sm">
                          <option value="internal_note">Internal note</option>
                          <option value="contact_log">Contact log</option>
                          <option value="issue_tag">Issue tag</option>
                        </select>
                        <Input value={supportBody} onChange={(e) => setSupportBody(e.target.value)} placeholder="Add a support or audit note" />
                        <Button type="button" disabled={supportSaving || !supportBody.trim()} onClick={() => void saveSupportNote()}>{supportSaving ? "Saving..." : "Add"}</Button>
                      </div>
                      <div className="space-y-2">
                        {(detail.support_notes ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No support notes yet.</p>
                        ) : (
                          detail.support_notes?.map((note) => (
                            <div key={note.id} className="rounded-xl border border-border/60 p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <Badge variant="outline">{note.note_type.replaceAll("_", " ")}</Badge>
                                <span className="text-xs text-muted-foreground">{note.created_at ? new Date(note.created_at).toLocaleString("en-PH") : "Now"}</span>
                              </div>
                              <p className="mt-2 text-foreground">{note.body}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{note.admin?.name ?? "Admin"}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
