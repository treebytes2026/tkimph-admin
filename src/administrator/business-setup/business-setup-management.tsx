"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  createBusinessCategory,
  createBusinessType,
  createCuisine,
  createMenuCategory,
  deleteBusinessCategory,
  deleteBusinessType,
  deleteCuisine,
  deleteMenuCategory,
  fetchBusinessCategories,
  fetchBusinessTypes,
  fetchCuisines,
  fetchMenuCategories,
  updateBusinessCategory,
  updateBusinessType,
  updateCuisine,
  updateMenuCategory,
  type BusinessCategoryRow,
  type BusinessTypeRow,
  type CuisineRow,
  type MenuCategoryRow,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutList, Loader2, Plus, Pencil, Trash2, Tags, UtensilsCrossed, Store } from "lucide-react";

/** Toggle for “show on partner registration” (maps to API `is_active`). */
function RegistrationToggle({
  enabled,
  disabled,
  onChange,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          enabled ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow-md ring-1 ring-black/5 transition-transform",
            enabled && "translate-x-[1.25rem]"
          )}
        />
      </button>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

export function BusinessSetupManagement() {
  const [types, setTypes] = useState<BusinessTypeRow[]>([]);
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [cuisines, setCuisines] = useState<CuisineRow[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, cu, mc] = await Promise.all([
        fetchBusinessTypes({ per_page: 100 }),
        fetchBusinessCategories({ per_page: 200 }),
        fetchCuisines({ per_page: 200 }),
        fetchMenuCategories({ per_page: 200 }),
      ]);
      setTypes(t.data);
      setCategories(c.data);
      setCuisines(cu.data);
      setMenuCategories(mc.data);
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
          Manage business types, categories (per type), cuisines for registration, and menu categories partners use when
          building menus.
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
          <MenuCategoriesSection menuCategories={menuCategories} onRefresh={load} />
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
  const [editing, setEditing] = useState<BusinessTypeRow | null>(null);
  const [editReqCat, setEditReqCat] = useState(true);
  const [editReqCui, setEditReqCui] = useState(true);
  const [editActive, setEditActive] = useState(true);

  function openEdit(t: BusinessTypeRow) {
    setEditing(t);
    setEditReqCat(t.requires_category);
    setEditReqCui(t.requires_cuisine);
    setEditActive(t.is_active);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(editing.id);
    try {
      await updateBusinessType(editing.id, {
        requires_category: editReqCat,
        requires_cuisine: editReqCui,
        is_active: editActive,
      });
      setEditing(null);
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

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
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tags className="size-5" />
            Business types
          </CardTitle>
          <CardDescription>
            Controls partner registration: inactive types are hidden. &quot;Requires cuisine&quot; shows the cuisine
            dropdown when that type is selected.
          </CardDescription>
        </div>
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

        {editing ? (
          <form
            onSubmit={saveEdit}
            className="space-y-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">Edit {editing.name}</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={editReqCat}
                  onChange={(e) => setEditReqCat(e.target.checked)}
                />
                Requires business category
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={editReqCui}
                  onChange={(e) => setEditReqCui(e.target.checked)}
                />
                Requires cuisine
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Type active (shown on partner registration)
              </label>
            </div>
            <Button type="submit" size="sm" disabled={busy === editing.id}>
              {busy === editing.id ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </form>
        ) : null}

        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.slug}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {t.requires_category ? "Category required" : "Category optional"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {t.requires_cuisine ? "Cuisine required" : "Cuisine optional"}
                  </Badge>
                  <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                    {t.is_active ? "Active" : "Hidden"}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  disabled={busy === t.id}
                  onClick={() => openEdit(t)}
                >
                  <Pencil className="mr-1 size-3.5" />
                  Edit rules
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

  const sortedTypes = [...types].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  async function toggleCategoryRegistration(c: BusinessCategoryRow, on: boolean) {
    setBusy(c.id);
    try {
      await updateBusinessCategory(c.id, { is_active: on });
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  }

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
        <div className="space-y-1">
          <CardTitle className="text-lg">Business categories</CardTitle>
          <CardDescription>
            Categories are scoped to a business type (e.g. Fast food under Restaurant). Turn off
            &quot;On registration&quot; to hide a category from the partner signup form.
          </CardDescription>
        </div>
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

        <div className="space-y-6">
          {sortedTypes.map((type) => {
            const forType = categories
              .filter((c) => c.business_type_id === type.id)
              .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
            if (forType.length === 0) return null;
            return (
              <div key={type.id} className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-4 py-3">
                  <Store className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{type.name}</p>
                    <p className="text-xs text-muted-foreground">{forType.length} categor{forType.length === 1 ? "y" : "ies"}</p>
                  </div>
                </div>
                <ul className="divide-y divide-border/50">
                  {forType.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">Sort order {c.sort_order}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                        <RegistrationToggle
                          enabled={c.is_active}
                          disabled={busy === c.id}
                          onChange={(on) => void toggleCategoryRegistration(c, on)}
                          label="On registration"
                        />
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
              </div>
            );
          })}
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : null}
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

  async function setCuisineRegistration(c: CuisineRow, on: boolean) {
    if (c.is_active === on) return;
    setBusy(c.id);
    try {
      await updateCuisine(c.id, { is_active: on });
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

  const sortedCuisines = [...cuisines].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UtensilsCrossed className="size-5" />
            Cuisines
          </CardTitle>
          <CardDescription>
            When a business type requires cuisine, partners pick from this list on registration. Turn off
            &quot;On registration&quot; to hide a cuisine from signup without deleting it.
          </CardDescription>
        </div>
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
          {sortedCuisines.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No cuisines yet. Add one above.</li>
          ) : null}
          {sortedCuisines.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">Sort order {c.sort_order}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <RegistrationToggle
                  enabled={c.is_active}
                  disabled={busy === c.id}
                  onChange={(on) => void setCuisineRegistration(c, on)}
                  label="On registration"
                />
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

function MenuCategoriesSection({
  menuCategories,
  onRefresh,
}: {
  menuCategories: MenuCategoryRow[];
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(-1);
    try {
      await createMenuCategory({
        name: name.trim(),
        sort_order: menuCategories.length,
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

  async function setCategoryAvailable(c: MenuCategoryRow, on: boolean) {
    if (c.is_active === on) return;
    setBusy(c.id);
    try {
      await updateMenuCategory(c.id, { is_active: on });
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: MenuCategoryRow) {
    if (!confirm(`Delete "${c.name}"? Existing menu items may reference this category.`)) return;
    setBusy(c.id);
    try {
      await deleteMenuCategory(c.id);
      await onRefresh();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...menuCategories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <LayoutList className="size-5" />
            Menu categories
          </CardTitle>
          <CardDescription>
            Partners assign dishes to these sections (e.g. Appetizers, Main course). Turn off availability to hide a
            category from the partner menu builder without deleting it.
          </CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="grid min-w-[200px] flex-1 gap-1.5">
              <Label htmlFor="mc_name">Name</Label>
              <Input id="mc_name" required value={name} onChange={(e) => setName(e.target.value)} />
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
          {sorted.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No menu categories yet. Add one above.
            </li>
          ) : null}
          {sorted.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">Sort order {c.sort_order}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                <RegistrationToggle
                  enabled={c.is_active}
                  disabled={busy === c.id}
                  onChange={(on) => void setCategoryAvailable(c, on)}
                  label="Available to partners"
                />
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
