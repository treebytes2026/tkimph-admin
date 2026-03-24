"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  type AdminUser,
  createUser,
  deleteUser,
  fetchUsers,
  toggleUserActive,
  updateUser,
  type UserRole,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "restaurant_owner", label: "Restaurant partner" },
  { value: "rider", label: "Rider" },
];

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "customer" as UserRole,
  phone: "",
  address: "",
};

export function UsersManagement() {
  const [list, setList] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers({
        page,
        role: roleFilter || undefined,
        search: search || undefined,
      });
      setList(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load users");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setSheetOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: (u.role as UserRole) || "customer",
      phone: u.phone ?? "",
      address: u.address ?? "",
    });
    setSheetOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone || null,
          address: form.address || null,
        };
        if (form.password.trim()) body.password = form.password;
        await updateUser(editing.id, body);
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || null,
          address: form.address || null,
        });
      }
      setSheetOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setDeletingId(u.id);
    setError(null);
    try {
      await deleteUser(u.id);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggle(u: AdminUser) {
    setTogglingId(u.id);
    setError(null);
    try {
      await toggleUserActive(u.id);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User management</h1>
          <p className="text-sm text-muted-foreground">
            Add and edit customers, restaurant partners, and riders. Deactivate accounts without
            deleting them.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 gap-2 rounded-xl font-semibold shadow-sm">
          <Plus className="size-4" />
          Add user
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" />
            Accounts
            <span className="text-sm font-normal text-muted-foreground">({total})</span>
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="role-filter" className="sr-only">
                Role
              </Label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => {
                  setPage(1);
                  setRoleFilter(e.target.value);
                }}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search name or email…"
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <UserCircle2 className="size-12 opacity-40" />
              <p>No users match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">User</th>
                    <th className="hidden px-4 py-3 md:table-cell">Role</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {list.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <Badge variant="outline" className="mt-1 md:hidden">
                          {roleLabel(u.role)}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant="secondary" className="font-normal">
                          {roleLabel(u.role)}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {u.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant={u.is_active ? "outline" : "secondary"}
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={togglingId === u.id}
                          onClick={() => handleToggle(u)}
                        >
                          {togglingId === u.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : u.is_active ? (
                            "Active"
                          ) : (
                            "Inactive"
                          )}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg"
                            onClick={() => openEdit(u)}
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-destructive hover:text-destructive"
                            disabled={deletingId === u.id}
                            onClick={() => handleDelete(u)}
                            aria-label="Delete"
                          >
                            {deletingId === u.id ? (
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
            <SheetTitle>{editing ? "Edit user" : "Add user"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="u-name">Full name</Label>
              <Input
                id="u-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-pass">{editing ? "New password (optional)" : "Password"}</Label>
              <Input
                id="u-pass"
                type="password"
                required={!editing}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-xl"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-role">Role</Label>
              <select
                id="u-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-phone">Phone</Label>
              <Input
                id="u-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-address">Address</Label>
              <Input
                id="u-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl font-semibold">
                {saving ? <Loader2 className="size-4 animate-spin" /> : editing ? "Save" : "Create"}
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
