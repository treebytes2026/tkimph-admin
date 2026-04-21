"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PartnerApiError,
  createPartnerMenu,
  createPartnerMenuItem,
  deletePartnerMenu,
  deletePartnerMenuItem,
  deletePartnerMenuItemImage,
  fetchPartnerMenu,
  fetchPartnerMenuCategories,
  fetchPartnerOverviewCached,
  fetchRestaurantMenus,
  updatePartnerMenu,
  updatePartnerMenuItem,
  uploadPartnerMenuItemImage,
  partnerStoragePublicUrl,
  type PartnerMenuCategoryOption,
  type PartnerMenuDetail,
  type PartnerMenuItemRow,
  type PartnerMenuListRow,
  type PartnerOverviewRestaurant,
} from "@/lib/partner-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Store,
  Tags,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

function groupItemsByCategory(items: PartnerMenuItemRow[]) {
  const map = new Map<string, PartnerMenuItemRow[]>();
  for (const item of items) {
    const label = item.menu_category?.name ?? `Category #${item.menu_category_id}`;
    const list = map.get(label) ?? [];
    list.push(item);
    map.set(label, list);
  }
  return map;
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePercent(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function effectiveDiscountPercent(
  menu: { discount_enabled?: boolean; discount_percent?: string | number },
  item?: { discount_enabled?: boolean; discount_percent?: string | number }
): number {
  if (item?.discount_enabled) return normalizePercent(item.discount_percent ?? 0);
  if (menu.discount_enabled) return normalizePercent(menu.discount_percent ?? 0);
  return 0;
}

function pricingPreview(price: number, discountPercent = 0): { discounted: string; commission: string; net: string } {
  const discountedValue = Math.max(0, price - (price * normalizePercent(discountPercent)) / 100);
  const commission = discountedValue * 0.13;
  const net = Math.max(0, discountedValue - commission);
  return {
    discounted: `PHP ${discountedValue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    commission: `PHP ${commission.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    net: `PHP ${net.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}

export default function PartnerMenuPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** One listing per partner account — API may return multiple rows only for legacy data; we only use the first. */
  const [restaurant, setRestaurant] = useState<PartnerOverviewRestaurant | null>(null);
  const restaurantId = restaurant?.id;
  const [menus, setMenus] = useState<PartnerMenuListRow[]>([]);
  const [categories, setCategories] = useState<PartnerMenuCategoryOption[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PartnerMenuDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [newMenuName, setNewMenuName] = useState("");
  const [itemForm, setItemForm] = useState({
    menu_category_id: "" as number | "",
    name: "",
    description: "",
    price: "",
    discount_enabled: false,
    discount_percent: "",
  });
  const addDishPhotoInputRef = useRef<HTMLInputElement>(null);
  const [menuNameDraft, setMenuNameDraft] = useState("");
  const [menuDiscountEnabledDraft, setMenuDiscountEnabledDraft] = useState(false);
  const [menuDiscountPercentDraft, setMenuDiscountPercentDraft] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    menu_category_id: 0,
    name: "",
    description: "",
    price: "",
    discount_enabled: false,
    discount_percent: "",
    is_available: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await fetchPartnerOverviewCached();
        if (cancelled) return;
        setRestaurant(o.restaurants[0] ?? null);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof PartnerApiError ? e.message : "Could not load your restaurant.")
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restaurantId == null) return;
    let cancelled = false;
    setMenusLoading(true);
    void (async () => {
      try {
        const list = await fetchRestaurantMenus(restaurantId);
        if (!cancelled) setMenus(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof PartnerApiError ? e.message : "Could not load menus.");
      } finally {
        if (!cancelled) setMenusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function refreshMenus() {
    if (restaurantId == null) return;
    setMenusLoading(true);
    try {
      const list = await fetchRestaurantMenus(restaurantId);
      setMenus(list);
    } catch (e) {
      setError(e instanceof PartnerApiError ? e.message : "Could not load menus.");
    } finally {
      setMenusLoading(false);
    }
  }

  async function openMenu(menuId: number) {
    if (expandedId === menuId) {
      setExpandedId(null);
      setDetail(null);
      setEditingItemId(null);
      return;
    }
    if (restaurantId == null) return;
    setEditingItemId(null);
    setExpandedId(menuId);
    setDetailLoading(true);
    try {
      const [d, cats] = await Promise.all([
        fetchPartnerMenu(restaurantId, menuId),
        fetchPartnerMenuCategories(),
      ]);
      setDetail(d);
      setCategories(cats);
      setItemForm((f) => ({
        ...f,
        menu_category_id: f.menu_category_id || cats[0]?.id || "",
      }));
    } catch (e) {
      setError(e instanceof PartnerApiError ? e.message : "Could not load menu.");
      setExpandedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (detail) {
      setMenuNameDraft(detail.name);
      setMenuDiscountEnabledDraft(detail.discount_enabled);
      setMenuDiscountPercentDraft(detail.discount_percent ?? "0");
    }
  }, [detail]);

  async function handleSaveMenuName(e: React.FormEvent) {
    e.preventDefault();
    if (restaurantId == null || expandedId === null || !menuNameDraft.trim()) return;
    const next = menuNameDraft.trim();
    const nextDiscountPercent = normalizePercent(menuDiscountPercentDraft || 0);
    const unchanged =
      next === detail?.name &&
      menuDiscountEnabledDraft === detail?.discount_enabled &&
      nextDiscountPercent === normalizePercent(detail?.discount_percent ?? 0);
    if (unchanged) return;
    setBusy("rename-menu");
    try {
      await updatePartnerMenu(restaurantId, expandedId, {
        name: next,
        discount_enabled: menuDiscountEnabledDraft,
        discount_percent: nextDiscountPercent,
      });
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success("Menu settings saved.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not update menu name.");
    } finally {
      setBusy(null);
    }
  }

  function startEditItem(it: PartnerMenuItemRow) {
    setEditingItemId(it.id);
    setEditItemForm({
      menu_category_id: it.menu_category_id,
      name: it.name,
      description: it.description ?? "",
      price: it.price,
      discount_enabled: it.discount_enabled,
      discount_percent: it.discount_percent ?? "0",
      is_available: it.is_available,
    });
  }

  async function handleSaveEditedItem(e: React.FormEvent) {
    e.preventDefault();
    if (restaurantId == null || expandedId === null || editingItemId === null) return;
    const price = Number.parseFloat(editItemForm.price);
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    setBusy(`edit-item-${editingItemId}`);
    try {
      await updatePartnerMenuItem(restaurantId, expandedId, editingItemId, {
        menu_category_id: editItemForm.menu_category_id,
        name: editItemForm.name.trim(),
        description: editItemForm.description.trim() || null,
        price,
        discount_enabled: editItemForm.discount_enabled,
        discount_percent: normalizePercent(editItemForm.discount_percent || 0),
        is_available: editItemForm.is_available,
      });
      setEditingItemId(null);
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success("Item updated.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not update dish.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateMenu(e: React.FormEvent) {
    e.preventDefault();
    if (restaurantId == null || !newMenuName.trim()) return;
    setBusy("menu");
    try {
      await createPartnerMenu(restaurantId, { name: newMenuName.trim() });
      setNewMenuName("");
      await refreshMenus();
      toast.success("Menu created.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Failed to create menu.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteMenu(m: PartnerMenuListRow) {
    if (restaurantId == null) return;
    if (!confirm(`Delete menu "${m.name}" and all its items?`)) return;
    setBusy(`del-menu-${m.id}`);
    try {
      await deletePartnerMenu(restaurantId, m.id);
      if (expandedId === m.id) {
        setExpandedId(null);
        setDetail(null);
      }
      await refreshMenus();
      toast.success("Menu deleted.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Failed to delete menu.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (restaurantId == null || expandedId === null || itemForm.menu_category_id === "") return;
    const price = Number.parseFloat(itemForm.price);
    if (Number.isNaN(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    setBusy("item");
    try {
      const created = await createPartnerMenuItem(restaurantId, expandedId, {
        menu_category_id: itemForm.menu_category_id as number,
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || undefined,
        price,
        discount_enabled: itemForm.discount_enabled,
        discount_percent: normalizePercent(itemForm.discount_percent || 0),
      });
      const photoFile = addDishPhotoInputRef.current?.files?.[0];
      if (photoFile) {
        await uploadPartnerMenuItemImage(restaurantId, expandedId, created.id, photoFile);
      }
      if (addDishPhotoInputRef.current) addDishPhotoInputRef.current.value = "";
      setItemForm((f) => ({
        ...f,
        name: "",
        description: "",
        price: "",
        discount_enabled: false,
        discount_percent: "",
      }));
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success(photoFile ? "Item added with photo." : "Item added.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Failed to add dish.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDishPhotoUpload(it: PartnerMenuItemRow, file: File) {
    if (restaurantId == null || expandedId === null) return;
    setBusy(`dish-photo-${it.id}`);
    try {
      await uploadPartnerMenuItemImage(restaurantId, expandedId, it.id, file);
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success("Dish photo updated.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not upload dish photo.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDishPhotoRemove(it: PartnerMenuItemRow) {
    if (restaurantId == null || expandedId === null) return;
    if (!it.image_path) return;
    if (!confirm("Remove this dish’s photo?")) return;
    setBusy(`dish-photo-del-${it.id}`);
    try {
      await deletePartnerMenuItemImage(restaurantId, expandedId, it.id);
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success("Dish photo removed.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Could not remove photo.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteItem(item: PartnerMenuItemRow) {
    if (restaurantId == null || expandedId === null) return;
    if (!confirm(`Remove "${item.name}" from the menu?`)) return;
    setBusy(`item-${item.id}`);
    try {
      await deletePartnerMenuItem(restaurantId, expandedId, item.id);
      const d = await fetchPartnerMenu(restaurantId, expandedId);
      setDetail(d);
      await refreshMenus();
      toast.success("Item removed.");
    } catch (err) {
      toast.error(err instanceof PartnerApiError ? err.message : "Failed to remove dish.");
    } finally {
      setBusy(null);
    }
  }

  const grouped = useMemo(() => (detail ? groupItemsByCategory(detail.items) : new Map<string, PartnerMenuItemRow[]>()), [detail]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "default" }), "mt-4 rounded-xl inline-flex")}
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Menus</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Manage menus, photos, and dishes for your restaurant on TKimph.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/15 py-3 sm:py-4">
          <CardTitle className="text-base">Menu builder</CardTitle>
          <CardDescription className="text-xs leading-snug">
            Everything here applies only to your restaurant — other businesses on TKimph have their own accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {!restaurant ? (
            <p className="text-sm text-muted-foreground">
              No restaurant is linked to your partner account yet. After your application is approved, your listing will
              appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-6">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Your restaurant</p>
                <div className="flex items-center gap-2">
                  <Store className="size-4 shrink-0 text-primary opacity-80" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">{restaurant.name}</span>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-2.5">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">How you appear on TKimph</p>
                  <div className="flex flex-wrap gap-2">
                    {restaurant.cuisine ? (
                      <Badge className="gap-1 border-0 bg-primary font-medium text-primary-foreground">
                        <UtensilsCrossed className="size-3.5" aria-hidden />
                        Cuisine: {restaurant.cuisine.name}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs font-normal">
                        Cuisine not set
                      </Badge>
                    )}
                    {restaurant.business_type ? (
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Store className="size-3.5 opacity-80" aria-hidden />
                        {restaurant.business_type.name}
                      </Badge>
                    ) : null}
                    {restaurant.business_category ? (
                      <Badge variant="outline" className="gap-1 font-normal">
                        <Tags className="size-3.5 opacity-80" aria-hidden />
                        {restaurant.business_category.name}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <form
                onSubmit={handleCreateMenu}
                className="flex w-full flex-col gap-2 sm:flex-row sm:items-end lg:max-w-md"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="menu_name" className="text-xs">
                    New menu
                  </Label>
                  <Input
                    id="menu_name"
                    className="h-9"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="e.g. Lunch specials"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={busy === "menu" || !newMenuName.trim()}
                >
                  {busy === "menu" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
                  Add
                </Button>
              </form>
            </div>
          )}

          {restaurant != null ? (
            <>
              {menusLoading ? (
                <p className="text-sm text-muted-foreground">Loading menus…</p>
              ) : menus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No menus yet. Create one above.</p>
              ) : (
                <div className="space-y-4">
                  {menus.map((m) => {
                    const open = expandedId === m.id;
                    return (
                      <Card
                        key={m.id}
                        className={cn(
                          "overflow-hidden transition-shadow",
                          open && "ring-2 ring-primary/25 shadow-md"
                        )}
                      >
                        <div className="flex items-stretch gap-0">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                            onClick={() => void openMenu(m.id)}
                          >
                            {open ? (
                              <ChevronDown className="size-5 shrink-0 text-primary" />
                            ) : (
                              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-foreground">{m.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {open ? "Tap to hide dishes" : "Tap to see dishes & prices"}
                              </p>
                            </div>
                            {m.discount_enabled ? (
                              <Badge variant="outline" className="shrink-0 gap-1 text-emerald-700">
                                <Percent className="size-3" />
                                {normalizePercent(m.discount_percent)}% off
                              </Badge>
                            ) : null}
                            <Badge variant="secondary" className="shrink-0 tabular-nums">
                              {m.items_count ?? 0} items
                            </Badge>
                          </button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-auto shrink-0 rounded-none px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy?.startsWith("del-menu")}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteMenu(m);
                            }}
                            aria-label="Delete menu"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {open ? (
                          <CardContent className="border-t border-border/60 bg-muted/10 px-3 py-4 sm:px-5">
                            {detailLoading || !detail ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" />
                                Loading…
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <form
                                  onSubmit={handleSaveMenuName}
                                  className="flex flex-wrap items-end gap-2 rounded-lg border border-border/50 bg-background/90 px-2 py-2"
                                >
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <Label htmlFor="edit_menu_name" className="text-[11px] text-muted-foreground">
                                      Menu name
                                    </Label>
                                    <Input
                                      id="edit_menu_name"
                                      className="h-9 text-sm"
                                      value={menuNameDraft}
                                      onChange={(e) => setMenuNameDraft(e.target.value)}
                                      placeholder="Menu name"
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 text-xs text-foreground">
                                    <input
                                      type="checkbox"
                                      className="rounded border-input"
                                      checked={menuDiscountEnabledDraft}
                                      onChange={(e) => setMenuDiscountEnabledDraft(e.target.checked)}
                                    />
                                    Enable menu-wide discount
                                  </label>
                                  <div className="w-full space-y-0.5 sm:w-40">
                                    <Label className="text-[11px] text-muted-foreground">Menu discount (%)</Label>
                                    <Input
                                      className="h-9 text-sm"
                                      inputMode="decimal"
                                      value={menuDiscountPercentDraft}
                                      onChange={(e) => setMenuDiscountPercentDraft(e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-9 shrink-0"
                                    disabled={busy === "rename-menu" || !menuNameDraft.trim()}
                                  >
                                    {busy === "rename-menu" ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : null}
                                    Save
                                  </Button>
                                </form>

                                <div className="space-y-6">
                                  <div className="flex min-h-0 flex-col gap-2">
                                    {detail.items.length > 0 ? (
                                      <p className="text-[11px] text-muted-foreground">
                                        {detail.items.length} item{detail.items.length === 1 ? "" : "s"} on this menu · per-dish
                                        photos are optional (edit an item to add one).
                                      </p>
                                    ) : null}

                                    {detail.items.length === 0 ? (
                                      <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                                        No dishes yet. Add dishes below.
                                      </p>
                                    ) : (
                                      <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-1">
                                        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                                          <table className="w-full text-left text-sm">
                                            <tbody className="divide-y divide-border/40">
                                              {Array.from(grouped.entries()).map(([catName, items]) => (
                                              <Fragment key={catName}>
                                                <tr className="bg-muted/40">
                                                  <td
                                                    colSpan={4}
                                                    className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                                                  >
                                                    {catName}
                                                  </td>
                                                </tr>
                                                {items.map((it) =>
                                                  editingItemId === it.id ? (
                                                    <tr key={it.id} className="bg-primary/[0.06]">
                                                      <td colSpan={4} className="p-2">
                                                        <form onSubmit={handleSaveEditedItem} className="space-y-2">
                                                          <div className="grid gap-2 sm:grid-cols-2">
                                                            <div className="grid gap-1 sm:col-span-2">
                                                              <Label className="text-[11px]">Category</Label>
                                                              <select
                                                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                                                required
                                                                value={String(editItemForm.menu_category_id)}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({
                                                                    ...f,
                                                                    menu_category_id: Number(e.target.value),
                                                                  }))
                                                                }
                                                              >
                                                                {categories.map((c) => (
                                                                  <option key={c.id} value={c.id}>
                                                                    {c.name}
                                                                  </option>
                                                                ))}
                                                              </select>
                                                            </div>
                                                            <div className="grid gap-1 sm:col-span-2">
                                                              <Label className="text-[11px]" htmlFor={`edit_dish_name_${it.id}`}>
                                                                Name
                                                              </Label>
                                                              <Input
                                                                id={`edit_dish_name_${it.id}`}
                                                                className="h-9"
                                                                required
                                                                value={editItemForm.name}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({ ...f, name: e.target.value }))
                                                                }
                                                              />
                                                            </div>
                                                            <div className="grid gap-1">
                                                              <Label className="text-[11px]" htmlFor={`edit_dish_price_${it.id}`}>
                                                                Price (PHP)
                                                              </Label>
                                                              <Input
                                                                id={`edit_dish_price_${it.id}`}
                                                                className="h-9"
                                                                required
                                                                inputMode="decimal"
                                                                value={editItemForm.price}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({ ...f, price: e.target.value }))
                                                                }
                                                              />
                                                              <p className="text-[10px] text-muted-foreground">
                                                                {(() => {
                                                                  const discount = effectiveDiscountPercent(
                                                                    {
                                                                      discount_enabled: menuDiscountEnabledDraft,
                                                                      discount_percent: menuDiscountPercentDraft,
                                                                    },
                                                                    {
                                                                      discount_enabled: editItemForm.discount_enabled,
                                                                      discount_percent: editItemForm.discount_percent,
                                                                    }
                                                                  );
                                                                  const preview = pricingPreview(parseMoney(editItemForm.price), discount);
                                                                  return `Customer pays ${preview.discounted}. TKimph keeps 13%: ${preview.commission}. Restaurant net: ${preview.net}.`;
                                                                })()}
                                                              </p>
                                                            </div>
                                                            <div className="grid gap-1">
                                                              <Label className="text-[11px]" htmlFor={`edit_dish_discount_${it.id}`}>
                                                                Dish discount (%)
                                                              </Label>
                                                              <Input
                                                                id={`edit_dish_discount_${it.id}`}
                                                                className="h-9"
                                                                inputMode="decimal"
                                                                value={editItemForm.discount_percent}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({ ...f, discount_percent: e.target.value }))
                                                                }
                                                              />
                                                            </div>
                                                            <div className="grid gap-1 sm:col-span-2">
                                                              <Label className="text-[11px]" htmlFor={`edit_dish_desc_${it.id}`}>
                                                                Description
                                                              </Label>
                                                              <Input
                                                                id={`edit_dish_desc_${it.id}`}
                                                                className="h-9"
                                                                value={editItemForm.description}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({
                                                                    ...f,
                                                                    description: e.target.value,
                                                                  }))
                                                                }
                                                              />
                                                            </div>
                                                            <label className="flex items-center gap-2 text-xs sm:col-span-2">
                                                              <input
                                                                type="checkbox"
                                                                className="rounded border-input"
                                                                checked={editItemForm.discount_enabled}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({
                                                                    ...f,
                                                                    discount_enabled: e.target.checked,
                                                                  }))
                                                                }
                                                              />
                                                              Override menu discount for this dish
                                                            </label>
                                                            <label className="flex items-center gap-2 text-xs sm:col-span-2">
                                                              <input
                                                                type="checkbox"
                                                                className="rounded border-input"
                                                                checked={editItemForm.is_available}
                                                                onChange={(e) =>
                                                                  setEditItemForm((f) => ({
                                                                    ...f,
                                                                    is_available: e.target.checked,
                                                                  }))
                                                                }
                                                              />
                                                              Available on menu
                                                            </label>
                                                            <div className="flex flex-col gap-2 rounded-md border border-border/50 bg-background/80 p-2 sm:col-span-2">
                                                              <p className="text-[11px] font-medium text-foreground">
                                                                Dish photo
                                                              </p>
                                                              <p className="text-[10px] text-muted-foreground">
                                                                Shown next to this dish in the list when customers browse your
                                                                menu.
                                                              </p>
                                                              <div className="flex flex-wrap items-center gap-2">
                                                                {it.image_path ? (
                                                                  /* eslint-disable-next-line @next/next/no-img-element */
                                                                  <img
                                                                    src={partnerStoragePublicUrl(it.image_path)}
                                                                    alt=""
                                                                    className="size-14 shrink-0 rounded-md border border-border/60 object-cover"
                                                                  />
                                                                ) : (
                                                                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30 text-[10px] text-muted-foreground">
                                                                    None
                                                                  </div>
                                                                )}
                                                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                                  <input
                                                                    type="file"
                                                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                                                    className="h-8 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-[11px] file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs disabled:opacity-50"
                                                                    disabled={busy === `dish-photo-${it.id}`}
                                                                    onChange={(e) => {
                                                                      const f = e.target.files?.[0];
                                                                      if (f) void handleDishPhotoUpload(it, f);
                                                                      e.target.value = "";
                                                                    }}
                                                                  />
                                                                  {it.image_path ? (
                                                                    <Button
                                                                      type="button"
                                                                      variant="ghost"
                                                                      size="sm"
                                                                      className="h-7 w-fit text-xs text-destructive"
                                                                      disabled={busy === `dish-photo-del-${it.id}`}
                                                                      onClick={() => void handleDishPhotoRemove(it)}
                                                                    >
                                                                      Remove dish photo
                                                                    </Button>
                                                                  ) : null}
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                          <div className="flex gap-2">
                                                            <Button type="submit" size="sm" className="h-8" disabled={busy === `edit-item-${it.id}`}>
                                                              {busy === `edit-item-${it.id}` ? (
                                                                <Loader2 className="size-3.5 animate-spin" />
                                                              ) : null}
                                                              Save
                                                            </Button>
                                                            <Button
                                                              type="button"
                                                              size="sm"
                                                              variant="ghost"
                                                              className="h-8"
                                                              onClick={() => setEditingItemId(null)}
                                                            >
                                                              Cancel
                                                            </Button>
                                                          </div>
                                                        </form>
                                                      </td>
                                                    </tr>
                                                  ) : (
                                                    <tr key={it.id} className="hover:bg-muted/30">
                                                      <td className="w-12 px-1 py-1.5 align-middle">
                                                        {it.image_path ? (
                                                          /* eslint-disable-next-line @next/next/no-img-element */
                                                          <img
                                                            src={partnerStoragePublicUrl(it.image_path)}
                                                            alt=""
                                                            className="mx-auto size-9 rounded border border-border/50 object-cover"
                                                          />
                                                        ) : (
                                                          <div
                                                            className="mx-auto flex size-9 items-center justify-center rounded border border-dashed border-border/50 bg-muted/20 text-[9px] leading-none text-muted-foreground"
                                                            title="No dish photo"
                                                          >
                                                            —
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td className="max-w-[10rem] px-2 py-1.5 align-top">
                                                        <div className="font-medium leading-tight text-foreground">{it.name}</div>
                                                        {it.description ? (
                                                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                                            {it.description}
                                                          </div>
                                                        ) : null}
                                                        {effectiveDiscountPercent(detail, it) > 0 ? (
                                                          <Badge variant="outline" className="mt-1 gap-1 border-emerald-200 text-[10px] text-emerald-700">
                                                            <Percent className="size-3" />
                                                            {effectiveDiscountPercent(detail, it)}% off
                                                          </Badge>
                                                        ) : null}
                                                        {!it.is_available ? (
                                                          <Badge variant="secondary" className="mt-1 text-[10px] leading-none">
                                                            Hidden
                                                          </Badge>
                                                        ) : null}
                                                      </td>
                                                      <td className="whitespace-nowrap px-2 py-1.5 text-right align-top font-medium tabular-nums">
                                                        ₱{Number.parseFloat(it.price).toFixed(2)}
                                                      </td>
                                                      <td className="px-1 py-1 align-top">
                                                        <div className="flex justify-end gap-0.5">
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8"
                                                            disabled={busy?.startsWith("edit-item")}
                                                            onClick={() => startEditItem(it)}
                                                            aria-label="Edit dish"
                                                          >
                                                            <Pencil className="size-3.5" />
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            className="size-8 text-destructive"
                                                            disabled={busy === `item-${it.id}`}
                                                            onClick={() => void handleDeleteItem(it)}
                                                            aria-label="Delete dish"
                                                          >
                                                            <Trash2 className="size-3.5" />
                                                          </Button>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  )
                                                )}
                                              </Fragment>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                    <Card className="border-dashed border-primary/25 bg-muted/5">
                                      <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Add dishes</CardTitle>
                                        <CardDescription>
                                          Pick a category, name, and price. You can add an optional photo after saving.
                                        </CardDescription>
                                      </CardHeader>
                                      <CardContent>
                                        {categories.length === 0 ? (
                                          <p className="text-xs text-amber-800 dark:text-amber-300">
                                            No categories yet — ask your admin to add menu categories.
                                          </p>
                                        ) : (
                                          <form onSubmit={handleAddItem} className="space-y-3">
                                            <div className="grid gap-2 sm:grid-cols-2">
                                              <div className="grid gap-1 sm:col-span-2">
                                                <Label className="text-[11px]">Category</Label>
                                                <select
                                                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                                  required
                                                  value={
                                                    itemForm.menu_category_id === ""
                                                      ? ""
                                                      : String(itemForm.menu_category_id)
                                                  }
                                                  onChange={(e) =>
                                                    setItemForm((f) => ({
                                                      ...f,
                                                      menu_category_id: e.target.value ? Number(e.target.value) : "",
                                                    }))
                                                  }
                                                >
                                                  <option value="">Select…</option>
                                                  {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                      {c.name}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                              <div className="grid gap-1 sm:col-span-2">
                                                <Label className="text-[11px]" htmlFor="dish_name">
                                                  Name
                                                </Label>
                                                <Input
                                                  id="dish_name"
                                                  className="h-9"
                                                  required
                                                  value={itemForm.name}
                                                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                                                />
                                              </div>
                                              <div className="grid gap-1">
                                                <Label className="text-[11px]" htmlFor="dish_price">
                                                  Price (PHP)
                                                </Label>
                                                <Input
                                                  id="dish_price"
                                                  className="h-9"
                                                  required
                                                  inputMode="decimal"
                                                  value={itemForm.price}
                                                  onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                                                />
                                                <p className="text-[10px] text-muted-foreground">
                                                  {(() => {
                                                    const discount = effectiveDiscountPercent(
                                                      {
                                                        discount_enabled: menuDiscountEnabledDraft,
                                                        discount_percent: menuDiscountPercentDraft,
                                                      },
                                                      {
                                                        discount_enabled: itemForm.discount_enabled,
                                                        discount_percent: itemForm.discount_percent,
                                                      }
                                                    );
                                                    const preview = pricingPreview(parseMoney(itemForm.price), discount);
                                                    return `Customer pays ${preview.discounted}. TKimph keeps 13%: ${preview.commission}. Restaurant net: ${preview.net}.`;
                                                  })()}
                                                </p>
                                              </div>
                                              <div className="grid gap-1">
                                                <Label className="text-[11px]" htmlFor="dish_discount">
                                                  Dish discount (%)
                                                </Label>
                                                <Input
                                                  id="dish_discount"
                                                  className="h-9"
                                                  inputMode="decimal"
                                                  value={itemForm.discount_percent}
                                                  onChange={(e) => setItemForm((f) => ({ ...f, discount_percent: e.target.value }))}
                                                />
                                              </div>
                                              <div className="grid gap-1 sm:col-span-2">
                                                <Label className="text-[11px]" htmlFor="dish_desc">
                                                  Description (optional)
                                                </Label>
                                                <Input
                                                  id="dish_desc"
                                                  className="h-9"
                                                  value={itemForm.description}
                                                  onChange={(e) =>
                                                    setItemForm((f) => ({ ...f, description: e.target.value }))
                                                  }
                                                />
                                              </div>
                                              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                                                <input
                                                  type="checkbox"
                                                  className="rounded border-input"
                                                  checked={itemForm.discount_enabled}
                                                  onChange={(e) =>
                                                    setItemForm((f) => ({ ...f, discount_enabled: e.target.checked }))
                                                  }
                                                />
                                                Override menu discount for this dish
                                              </label>
                                              <div className="grid gap-1 sm:col-span-2">
                                                <Label className="text-[11px]" htmlFor="dish_photo_new">
                                                  Dish photo (optional)
                                                </Label>
                                                <input
                                                  id="dish_photo_new"
                                                  ref={addDishPhotoInputRef}
                                                  type="file"
                                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-[11px] file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                                                />
                                                <p className="text-[10px] text-muted-foreground">
                                                  Shown next to this dish in the list (optional).
                                                </p>
                                              </div>
                                            </div>
                                            <Button type="submit" size="sm" className="h-9" disabled={busy === "item"}>
                                              {busy === "item" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                                              Add item
                                            </Button>
                                          </form>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
