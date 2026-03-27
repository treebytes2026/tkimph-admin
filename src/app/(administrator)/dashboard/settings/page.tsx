"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Loader2 } from "lucide-react";
import { fetchAdminSettings, updateAdminSettings, type AdminOperationalSettings } from "@/lib/admin-api";

export default function SettingsPage() {
  const [form, setForm] = useState<AdminOperationalSettings>({
    order_transition_guardrails: true,
    rider_auto_assignment: false,
    sla_stalled_minutes: 30,
    partner_self_pause_enabled: true,
    partner_cancel_window_minutes: 15,
    customer_cancel_window_minutes: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAdminSettings();
        if (!cancelled) {
          setForm(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await updateAdminSettings(form);
      setForm(res);
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="size-5" />
          Operational settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> Loading settings...
          </div>
        ) : (
          <>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Order transition guardrails</p>
                <p className="text-xs text-muted-foreground">Enforce valid status flow for admin updates.</p>
              </div>
              <input
                type="checkbox"
                checked={form.order_transition_guardrails}
                onChange={(e) => setForm((f) => ({ ...f, order_transition_guardrails: e.target.checked }))}
                className="size-4 accent-primary"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Allow partner self-pause</p>
                <p className="text-xs text-muted-foreground">Lets restaurant partners pause and resume their own store.</p>
              </div>
              <input
                type="checkbox"
                checked={form.partner_self_pause_enabled}
                onChange={(e) => setForm((f) => ({ ...f, partner_self_pause_enabled: e.target.checked }))}
                className="size-4 accent-primary"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Rider auto-assignment (stub)</p>
                <p className="text-xs text-muted-foreground">Enable future automatic rider dispatch logic.</p>
              </div>
              <input
                type="checkbox"
                checked={form.rider_auto_assignment}
                onChange={(e) => setForm((f) => ({ ...f, rider_auto_assignment: e.target.checked }))}
                className="size-4 accent-primary"
              />
            </label>

            <div className="space-y-2">
              <p className="font-medium text-foreground">SLA stalled threshold (minutes)</p>
              <Input
                type="number"
                min={5}
                max={240}
                value={form.sla_stalled_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sla_stalled_minutes: Math.max(5, Math.min(240, Number(e.target.value || 30))),
                  }))
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">Used by dashboard stalled-order alerts.</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Partner cancellation window (minutes)</p>
              <Input
                type="number"
                min={0}
                max={180}
                value={form.partner_cancel_window_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    partner_cancel_window_minutes: Math.max(0, Math.min(180, Number(e.target.value || 15))),
                  }))
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">How long a partner can cancel after an order is placed.</p>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-foreground">Customer cancellation request window (minutes)</p>
              <Input
                type="number"
                min={0}
                max={120}
                value={form.customer_cancel_window_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    customer_cancel_window_minutes: Math.max(0, Math.min(120, Number(e.target.value || 5))),
                  }))
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">How long customers can submit cancellation requests from order placement.</p>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-sm text-foreground">
                {message}
              </p>
            ) : null}

            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
