"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings as SettingsIcon,
  Loader2,
  Percent,
  Receipt,
  ShieldCheck,
  Store,
  Bike,
  Clock3,
  Truck,
} from "lucide-react";
import { fetchAdminSettings, updateAdminSettings, type AdminOperationalSettings } from "@/lib/admin-api";

type ToggleFieldProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleField({ title, description, checked, onChange }: ToggleFieldProps) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-white px-4 py-4 shadow-sm transition hover:border-primary/20 hover:bg-primary/[0.03]">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof SettingsIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.08] text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export default function SettingsPage() {
  const [form, setForm] = useState<AdminOperationalSettings>({
    order_transition_guardrails: true,
    rider_auto_assignment: false,
    sla_stalled_minutes: 30,
    partner_self_pause_enabled: true,
    partner_cancel_window_minutes: 15,
    customer_cancel_window_minutes: 5,
    platform_commission_rate: 13,
    settlements_enabled: false,
    delivery_fee_enabled: false,
    standard_delivery_fee: 49,
    commission_payment_gcash_name: "",
    commission_payment_gcash_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commissionRateInput, setCommissionRateInput] = useState("13");
  const [standardDeliveryFeeInput, setStandardDeliveryFeeInput] = useState("49");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAdminSettings();
        if (!cancelled) {
          setForm(res);
          setCommissionRateInput(String(res.platform_commission_rate));
          setStandardDeliveryFeeInput(String(res.standard_delivery_fee));
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
      setCommissionRateInput(String(res.platform_commission_rate));
      setStandardDeliveryFeeInput(String(res.standard_delivery_fee));
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  const commissionPreview = useMemo(() => {
    const rate = form.platform_commission_rate / 100;
    const sampleGross = 1000;
    const platformShare = sampleGross * rate;
    const restaurantNet = sampleGross - platformShare;
    return {
      rateLabel: `${form.platform_commission_rate.toFixed(2).replace(/\.00$/, "")}%`,
      platformShare: platformShare.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      restaurantNet: restaurantNet.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  }, [form.platform_commission_rate]);

  const deliveryPreview = useMemo(() => {
    const fee = Math.max(0, form.standard_delivery_fee || 0);
    return {
      statusLabel: form.delivery_fee_enabled ? "Paid" : "Free",
      feeLabel: fee.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      checkoutLabel: form.delivery_fee_enabled ? `PHP ${fee.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "Free",
    };
  }, [form.delivery_fee_enabled, form.standard_delivery_fee]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(248,250,252,1),rgba(255,247,237,1))] p-6 shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 left-0 h-28 w-28 -translate-x-1/4 translate-y-1/4 rounded-full bg-orange-200/35 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-sm">
              <SettingsIcon className="size-3.5" />
              Platform controls
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Dashboard settings</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Control pricing, settlement access, order safeguards, and partner operations from one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commission</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{commissionPreview.rateLabel}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Settlements</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{form.settlements_enabled ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{deliveryPreview.statusLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/70">
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading settings...
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="space-y-4">
              <SectionHeader
                icon={Percent}
                title="Revenue model"
                description="Control the commission taken from restaurant sales and whether the legacy settlement workflow is available."
              />
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                  <p className="font-medium text-foreground">Platform commission rate</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    This percentage is used for new order commission calculations and dish payout previews.
                  </p>
                  <div className="mt-4 flex items-end gap-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={commissionRateInput}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setCommissionRateInput(nextValue);
                        if (nextValue === "") return;
                        setForm((f) => ({
                          ...f,
                          platform_commission_rate: clamp(Number(nextValue), 0, 100, 13),
                        }));
                      }}
                      onBlur={() => {
                        if (commissionRateInput === "") {
                          setCommissionRateInput(String(form.platform_commission_rate));
                        }
                      }}
                      className="max-w-xs text-base font-semibold"
                    />
                    <span className="pb-2 text-sm text-muted-foreground">percent</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleField
                    title="Enable settlements"
                    description="Turns the legacy settlement pages and APIs on or off for admin and partner accounts."
                    checked={form.settlements_enabled}
                    onChange={(checked) => setForm((f) => ({ ...f, settlements_enabled: checked }))}
                  />

                  <ToggleField
                    title="Charge standard delivery fee"
                    description="Turn this off any time you want delivery to appear as free across the customer experience."
                    checked={form.delivery_fee_enabled}
                    onChange={(checked) => setForm((f) => ({ ...f, delivery_fee_enabled: checked }))}
                  />
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-muted text-foreground">
                      <Truck className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Standard delivery fee</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Used when delivery charging is enabled. Turn charging off above to make delivery free without losing your saved standard fee.
                      </p>
                      <div className="mt-4 flex items-end gap-3">
                        <Input
                          type="number"
                          min={0}
                          max={9999}
                          step="0.01"
                          value={standardDeliveryFeeInput}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setStandardDeliveryFeeInput(nextValue);
                            if (nextValue === "") return;
                            setForm((f) => ({
                              ...f,
                              standard_delivery_fee: clamp(Number(nextValue), 0, 9999, 49),
                            }));
                          }}
                          onBlur={() => {
                            if (standardDeliveryFeeInput === "") {
                              setStandardDeliveryFeeInput(String(form.standard_delivery_fee));
                            }
                          }}
                          className="max-w-xs text-base font-semibold"
                        />
                        <span className="pb-2 text-sm text-muted-foreground">PHP</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                  <p className="font-medium text-foreground">Commission payment details</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Restaurant owners will see these GCash details when they submit manual commission payments with proof of receipt.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">GCash account name</p>
                      <Input
                        value={form.commission_payment_gcash_name}
                        onChange={(e) => setForm((f) => ({ ...f, commission_payment_gcash_name: e.target.value }))}
                        placeholder="TKimph Admin"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">GCash number</p>
                      <Input
                        value={form.commission_payment_gcash_number}
                        onChange={(e) => setForm((f) => ({ ...f, commission_payment_gcash_number: e.target.value }))}
                        placeholder="09XXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-white to-orange-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Receipt className="size-4 text-primary" />
                  Example payout preview
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  For a sample restaurant sale of `PHP 1,000`, the current split would be:
                </p>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Gross sale</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">PHP 1,000.00</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Platform share</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      PHP {commissionPreview.platformShare} ({commissionPreview.rateLabel})
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Restaurant net</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">PHP {commissionPreview.restaurantNet}</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Customer delivery charge</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{deliveryPreview.checkoutLabel}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <SectionHeader
                  icon={ShieldCheck}
                  title="Order safeguards"
                  description="Keep operations predictable by controlling status rules and stalled-order thresholds."
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <ToggleField
                  title="Order transition guardrails"
                  description="Enforce valid status flow when admins update orders."
                  checked={form.order_transition_guardrails}
                  onChange={(checked) => setForm((f) => ({ ...f, order_transition_guardrails: checked }))}
                />

                <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-muted text-foreground">
                      <Clock3 className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">SLA stalled threshold</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Used by dashboard stalled-order alerts and monitoring summaries.
                      </p>
                      <Input
                        type="number"
                        min={5}
                        max={240}
                        value={form.sla_stalled_minutes}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            sla_stalled_minutes: clamp(Number(e.target.value || 30), 5, 240, 30),
                          }))
                        }
                        className="mt-4 max-w-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                    <p className="font-medium text-foreground">Partner cancellation window</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">How long partners can cancel after order placement.</p>
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={form.partner_cancel_window_minutes}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          partner_cancel_window_minutes: clamp(Number(e.target.value || 15), 0, 180, 15),
                        }))
                      }
                      className="mt-4"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
                    <p className="font-medium text-foreground">Customer cancellation window</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">How long customers can submit cancellation requests.</p>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={form.customer_cancel_window_minutes}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          customer_cancel_window_minutes: clamp(Number(e.target.value || 5), 0, 120, 5),
                        }))
                      }
                      className="mt-4"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <SectionHeader
                  icon={Store}
                  title="Partner and rider tools"
                  description="Manage what restaurant partners can do on their own and prepare rider automation controls."
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <ToggleField
                  title="Allow partner self-pause"
                  description="Lets restaurant partners pause and resume their own store from the partner dashboard."
                  checked={form.partner_self_pause_enabled}
                  onChange={(checked) => setForm((f) => ({ ...f, partner_self_pause_enabled: checked }))}
                />

                <div className="rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-white text-foreground shadow-sm">
                      <Bike className="size-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Rider auto-assignment</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This is still a stub setting, but you can keep the operational intent visible here.
                      </p>
                      <div className="mt-4">
                        <ToggleField
                          title="Enable rider auto-assignment"
                          description="Prepares the system for future automatic dispatch logic."
                          checked={form.rider_auto_assignment}
                          onChange={(checked) => setForm((f) => ({ ...f, rider_auto_assignment: checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {(error || message) ? (
            <div className="flex flex-col gap-3">
              {error ? (
                <p className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-foreground">
                  {message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="sticky bottom-4 flex justify-end">
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="h-12 rounded-2xl px-6 text-sm font-semibold shadow-lg shadow-primary/15"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving settings...
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
