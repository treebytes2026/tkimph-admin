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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutList, Loader2, Plus, Pencil, Trash2, Tags, UtensilsCrossed, Store, Sparkles, Layers3, ChevronRight } from "lucide-react";

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

function SectionIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.08] text-primary shadow-sm">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
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
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,1),rgba(255,247,237,1))] p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 left-0 h-28 w-28 -translate-x-1/4 translate-y-1/4 rounded-full bg-orange-200/35 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-sm">
              <Sparkles className="size-3.5" />
              Registration setup
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Business setup</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Manage the options partners see during signup and the menu categories they use to structure their stores.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Types</p><p className="mt-1 text-xl font-semibold text-foreground">{types.length}</p></div>
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categories</p><p className="mt-1 text-xl font-semibold text-foreground">{categories.length}</p></div>
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cuisines</p><p className="mt-1 text-xl font-semibold text-foreground">{cuisines.length}</p></div>
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Menu groups</p><p className="mt-1 text-xl font-semibold text-foreground">{menuCategories.length}</p></div>
          </div>
        </div>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="grid gap-4 py-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Store className="size-4 text-primary" />Partner signup</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Control which business options appear when restaurants apply to join the platform.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Layers3 className="size-4 text-primary" />Reusable structure</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep categories and cuisines tidy so restaurants can complete setup faster and with less confusion.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ChevronRight className="size-4 text-primary" />Safer changes</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Hide options from registration before deleting them, especially when existing stores may still reference them.</p>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <Card className="border-border/70"><CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin text-primary" />Loading setup data...</CardContent></Card>
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
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro icon={Tags} title="Business types" description='Top-level business options shown to partners during registration. "Requires cuisine" controls whether the cuisine field appears for that type.' />
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
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
            className="space-y-4 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 shadow-sm"
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

        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white shadow-sm">
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
          {types.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No business types yet. Add your first type to start shaping the registration flow.
            </li>
          ) : null}
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
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro icon={Store} title="Business categories" description='Categories sit under each business type, like "Fast food" under "Restaurant". Hide them from registration before deleting them.' />
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
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
              <div key={type.id} className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-sm">
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
          <p className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">No business categories yet. Add one above and assign it to a business type.</p>
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
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro icon={UtensilsCrossed} title="Cuisines" description='Partners choose from this list when their business type requires cuisine. You can hide cuisines from registration without deleting them.' />
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
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

        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white shadow-sm">
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
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionIntro icon={LayoutList} title="Menu categories" description='Reusable menu sections partners use in the builder, such as "Appetizers" or "Main course". Hide them first before deleting.' />
        <Button type="button" size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating ? (
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
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

        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white shadow-sm">
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
