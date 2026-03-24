"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  type AdminRestaurant,
  createRestaurant,
  deleteRestaurant,
  fetchPartners,
  fetchRestaurants,
  toggleRestaurantActive,
  updateRestaurant,
  type PartnerOption,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Pencil, Plus, Search, Store, Trash2 } from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  phone: "",
  address: "",
  user_id: "" as string | number,
};

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
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
      const res = await fetchRestaurants({
        page,
        search: search || undefined,
      });
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

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      user_id: partners[0]?.id ?? "",
    });
    setSheetOpen(true);
  }

  function openEdit(r: AdminRestaurant) {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      user_id: r.user_id,
    });
    setSheetOpen(true);
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
      } else {
        await createRestaurant(body);
      }
      setSheetOpen(false);
      await load();
      await loadPartners();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: AdminRestaurant) {
    if (!window.confirm(`Delete “${r.name}”? This cannot be undone.`)) return;
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
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Restaurant partners
          </h1>
          <p className="text-sm text-muted-foreground">
            Link each store to a partner account (restaurant owner). Add partners under Users if
            you need a new login.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-10 gap-2 rounded-xl font-semibold shadow-sm"
          disabled={partners.length === 0}
        >
          <Plus className="size-4" />
          Add restaurant
        </Button>
      </div>

      {partners.length === 0 && (
        <div className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-foreground">
          No active restaurant partners yet. Go to{" "}
          <strong>Users</strong>, add a user with role <strong>Restaurant partner</strong>, then
          return here.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="size-5 text-primary" />
            Restaurants
            <span className="text-sm font-normal text-muted-foreground">({total})</span>
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search name, address, phone…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))}
              className="h-10 max-w-xs rounded-xl"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl"
              onClick={() => {
                setSearch(searchInput);
                setPage(1);
              }}
            >
              <Search className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
            </div>
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
                    <th className="hidden px-4 py-3 lg:table-cell">Partner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.name}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {r.address ?? "—"}
                        </p>
                        {r.owner && (
                          <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                            {r.owner.name} · {r.owner.email}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {r.owner ? (
                          <div>
                            <p className="font-medium">{r.owner.name}</p>
                            <p className="text-xs text-muted-foreground">{r.owner.email}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            variant={r.is_active ? "outline" : "secondary"}
                            size="sm"
                            className="h-8 w-fit rounded-lg text-xs"
                            disabled={togglingId === r.id}
                            onClick={() => handleToggle(r)}
                          >
                            {togglingId === r.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : r.is_active ? (
                              "Active"
                            ) : (
                              "Inactive"
                            )}
                          </Button>
                          {!r.is_active && (
                            <Badge variant="outline" className="w-fit text-[10px]">
                              Hidden from ordering
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg"
                            onClick={() => openEdit(r)}
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-destructive hover:text-destructive"
                            disabled={deletingId === r.id}
                            onClick={() => handleDelete(r)}
                            aria-label="Delete"
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
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
              <p className="text-xs text-muted-foreground">
                Page {page} of {lastPage}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit restaurant" : "Add restaurant"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="r-partner">Partner account</Label>
              <select
                id="r-partner"
                required
                value={form.user_id === "" ? "" : String(form.user_id)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, user_id: e.target.value ? Number(e.target.value) : "" }))
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Select partner…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-name">Restaurant name</Label>
              <Input
                id="r-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-desc">Description</Label>
              <Input
                id="r-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-phone">Phone</Label>
              <Input
                id="r-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-address">Address</Label>
              <Input
                id="r-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl font-semibold">
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editing ? (
                  "Save"
                ) : (
                  "Create"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
