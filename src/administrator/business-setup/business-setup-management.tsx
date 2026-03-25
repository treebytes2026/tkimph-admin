"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  createBusinessCategory,
  createBusinessType,
  createCuisine,
  deleteBusinessCategory,
  deleteBusinessType,
  deleteCuisine,
  fetchBusinessCategories,
  fetchBusinessTypes,
  fetchCuisines,
  updateBusinessCategory,
  updateBusinessType,
  updateCuisine,
  type BusinessCategoryRow,
  type BusinessTypeRow,
  type CuisineRow,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Tags, UtensilsCrossed } from "lucide-react";

export function BusinessSetupManagement() {
  const [types, setTypes] = useState<BusinessTypeRow[]>([]);
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [cuisines, setCuisines] = useState<CuisineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, cu] = await Promise.all([
        fetchBusinessTypes({ per_page: 100 }),
        fetchBusinessCategories({ per_page: 200 }),
        fetchCuisines({ per_page: 200 }),
      ]);
      setTypes(t.data);
      setCategories(c.data);
      setCuisines(cu.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Business setup</h1>
        <p className="text-sm text-muted-foreground">
          Manage business types, categories (per type), and cuisines shown on partner registration.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <BusinessTypesSection types={types} onRefresh={load} />
          <BusinessCategoriesSection categories={categories} types={types} onRefresh={load} />
          <CuisinesSection cuisines={cuisines} onRefresh={load} />
        </>
      )}
    </div>
  );
}

function BusinessTypesSection({
  types,
  onRefresh,
}: {
  types: BusinessTypeRow[];
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [reqCat, setReqCat] = useState(true);
  const [reqCui, setReqCui] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(-1);
    try {
      await createBusinessType({
        name: name.trim(),
        slug: slug.trim() || undefined,
        requires_category: reqCat,
        requires_cuisine: reqCui,
        sort_order: types.length,
        is_active: true,
      });
      setName("");
      setSlug("");
      await onRefresh();
      setCreating(false);
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(t: BusinessTypeRow) {
    setBusy(t.id);
    try {
      await updateBusinessType(t.id, { is_active: !t.is_active });
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: BusinessTypeRow) {
    if (!confirm(`Delete "${t.name}"?`)) return;
    setBusy(t.id);
    try {
      await deleteBusinessType(t.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tags className="size-5" />
          Business types
        </CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="bt_name">Name</Label>
              <Input id="bt_name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bt_slug">Slug (optional)</Label>
              <Input
                id="bt_slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from name"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reqCat} onChange={(e) => setReqCat(e.target.checked)} />
                Requires category
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reqCui} onChange={(e) => setReqCui(e.target.checked)} />
                Requires cuisine
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={busy === -1}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.slug}
                  {t.requires_category ? " · category required" : ""}
                  {t.requires_cuisine ? " · cuisine required" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.is_active ? "default" : "secondary"}>
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={busy === t.id}
                  onClick={() => toggleActive(t)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8 text-destructive"
                  disabled={busy === t.id}
                  onClick={() => remove(t)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BusinessCategoriesSection({
  categories,
  types,
  onRefresh,
}: {
  categories: BusinessCategoryRow[];
  types: BusinessTypeRow[];
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [typeId, setTypeId] = useState<number | "">(types[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (typeId === "" && types[0]) setTypeId(types[0].id);
  }, [types, typeId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (typeId === "") return;
    setBusy(-1);
    try {
      await createBusinessCategory({
        business_type_id: Number(typeId),
        name: name.trim(),
        sort_order: categories.filter((c) => c.business_type_id === Number(typeId)).length,
        is_active: true,
      });
      setName("");
      await onRefresh();
      setCreating(false);
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: BusinessCategoryRow) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    setBusy(c.id);
    try {
      await deleteBusinessCategory(c.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Business categories</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={typeId === "" ? "" : String(typeId)}
                onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bc_name">Name</Label>
              <Input id="bc_name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={busy === -1}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.business_type?.name ?? `Type #${c.business_type_id}`}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 text-destructive"
                disabled={busy === c.id}
                onClick={() => remove(c)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CuisinesSection({
  cuisines,
  onRefresh,
}: {
  cuisines: CuisineRow[];
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(-1);
    try {
      await createCuisine({
        name: name.trim(),
        sort_order: cuisines.length,
        is_active: true,
      });
      setName("");
      await onRefresh();
      setCreating(false);
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(c: CuisineRow) {
    setBusy(c.id);
    try {
      await updateCuisine(c.id, { is_active: !c.is_active });
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: CuisineRow) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    setBusy(c.id);
    try {
      await deleteCuisine(c.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UtensilsCrossed className="size-5" />
          Cuisines
        </CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="grid min-w-[200px] flex-1 gap-1.5">
              <Label htmlFor="cu_name">Name</Label>
              <Input id="cu_name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" size="sm" disabled={busy === -1}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </form>
        ) : null}

        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {cuisines.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="font-semibold">{c.name}</div>
              <div className="flex items-center gap-2">
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={busy === c.id}
                  onClick={() => toggleActive(c)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8 text-destructive"
                  disabled={busy === c.id}
                  onClick={() => remove(c)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
