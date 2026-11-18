"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import uz, { intlLocale, plural } from "@/i18n";
import type { Plan, ApiResponse } from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Helpers ────────────────────────────────────────────────────────

function formatMoney(amount: string | number | null): string {
  if (amount === null || amount === "" || amount === undefined) return "—";
  return `${Number(amount).toLocaleString(intlLocale())} UZS`;
}

// ── Form type ──────────────────────────────────────────────────────

interface PlanForm {
  name:          string;
  price_monthly: string;
  price_yearly:  string;
  description:   string;
  trial_days:    string;
  max_children:  string;
  max_groups:    string;
  max_teachers:  string;
  features:      string[];
  is_active:     boolean;
  sort_order:    string;
}

const emptyForm: PlanForm = {
  name:          "",
  price_monthly: "",
  price_yearly:  "",
  description:   "",
  trial_days:    "7",
  max_children:  "",
  max_groups:    "",
  max_teachers:  "",
  features:      [],
  is_active:     true,
  sort_order:    "0",
};

function planToForm(plan: Plan): PlanForm {
  return {
    name:          plan.name,
    price_monthly: plan.price_monthly,
    price_yearly:  plan.price_yearly ?? "",
    description:   plan.description ?? "",
    trial_days:    String(plan.trial_days),
    max_children:  plan.max_children !== null ? String(plan.max_children) : "",
    max_groups:    plan.max_groups !== null ? String(plan.max_groups) : "",
    max_teachers:  plan.max_teachers !== null ? String(plan.max_teachers) : "",
    features:      plan.features ?? [],
    is_active:     plan.is_active,
    sort_order:    String(plan.sort_order),
  };
}

// ── Page ───────────────────────────────────────────────────────────

export default function TariflarPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [form,       setForm]       = useState<PlanForm>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [saveError,  setSaveError]  = useState("");

  const [deactivating, setDeactivating] = useState<number | null>(null);
  const [activating,   setActivating]   = useState<number | null>(null);
  const [deactError,   setDeactError]   = useState<string>("");
  const featureInput = useRef<HTMLInputElement>(null);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans");
      setPlans(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    setSaveError("");
    setShowForm(true);
  }

  function openEdit(plan: Plan) {
    setEditTarget(plan);
    setForm(planToForm(plan));
    setFormErrors({});
    setSaveError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    setSaveError("");

    const body = {
      name:          form.name,
      price_monthly: form.price_monthly,
      price_yearly:  form.price_yearly || null,
      description:   form.description || null,
      trial_days:    parseInt(form.trial_days) || 7,
      max_children:  form.max_children ? parseInt(form.max_children) : null,
      max_groups:    form.max_groups ? parseInt(form.max_groups) : null,
      max_teachers:  form.max_teachers ? parseInt(form.max_teachers) : null,
      features:      form.features,
      is_active:     form.is_active,
      sort_order:    parseInt(form.sort_order) || 0,
    };

    try {
      if (editTarget) {
        await api.put(`/v1/super-admin/plans/${editTarget.id}`, body);
      } else {
        await api.post("/v1/super-admin/plans", body);
      }
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]>; message?: string } };
      if (e?.data?.errors) {
        setFormErrors(e.data.errors);
      } else if (e?.data?.message) {
        setSaveError(e.data.message);
      } else {
        setSaveError(uz.xatolar.server_xato);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(plan: Plan) {
    setActivating(plan.id);
    setDeactError("");
    try {
      await api.patch(`/v1/super-admin/plans/${plan.id}/activate`, {});
      await load();
    } catch {
      setDeactError(uz.xatolar.server_xato);
    } finally {
      setActivating(null);
    }
  }

  async function handleDeactivate(plan: Plan) {
    if (!window.confirm(uz.super_admin.plan_faolsizlantir_tasdiq)) return;
    setDeactivating(plan.id);
    setDeactError("");
    try {
      await api.patch(`/v1/super-admin/plans/${plan.id}/deactivate`, {});
      await load();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string }; status?: number };
      if (e?.status === 422 || e?.data?.message) {
        setDeactError(e?.data?.message ?? uz.matn.bu_tarifda_faol_obunalar_bor);
      } else {
        setDeactError(uz.xatolar.server_xato);
      }
    } finally {
      setDeactivating(null);
    }
  }

  const f = (key: keyof PlanForm, val: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.tariflar}</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{uz.matn.obuna_tariflarini_boshqaring}</p>
        </div>
        <Button onClick={openCreate} icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        }>
          {uz.super_admin.plan_qoshish}
        </Button>
      </div>

      {/* Deactivate error banner */}
      {deactError && (
        <div className="flex items-center gap-3 bg-[var(--error-soft)] border border-[var(--error-border)] text-[var(--error)] rounded-xl px-5 py-3.5 text-sm">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          {deactError}
          <button onClick={() => setDeactError("")} className="ml-auto text-[var(--error)] hover:text-[var(--error)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--border)] p-6 space-y-4">
              <div className="h-6 w-32 bg-[var(--border-2)] rounded" />
              <div className="h-8 w-40 bg-[var(--border-2)] rounded" />
              <div className="space-y-2">
                {[1, 2, 3].map(j => <div key={j} className="h-3 w-full bg-[var(--border-2)] rounded" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-12 text-center space-y-3">
          <p className="text-[var(--text-2)]">{uz.common.yuklash_xatosi}</p>
          <Button onClick={load}>{uz.common.qayta_urinish}</Button>
        </div>
      )}

      {/* Plans grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.length === 0 ? (
            <div className="lg:col-span-3 bg-white rounded-xl border border-[var(--border)] p-16 text-center">
              <svg className="h-10 w-10 text-[var(--border-strong)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-[var(--text-3)] text-sm">{uz.matn.hali_tarif_yaratilmagan}</p>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl border border-[var(--border)] p-6 flex flex-col gap-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text)]">{plan.name}</h3>
                    {plan.slug && (
                      <p className="text-xs text-[var(--text-3)] font-mono mt-0.5">{plan.slug}</p>
                    )}
                  </div>
                  <Badge variant={plan.is_active ? "success" : "neutral"}>
                    {plan.is_active ? uz.common.faol : uz.common.nofaol}
                  </Badge>
                </div>

                {/* Price */}
                <div>
                  <p className="text-2xl font-bold text-[var(--text)]">
                    {formatMoney(plan.price_monthly)}
                    <span className="text-sm font-normal text-[var(--text-3)]">{uz.matn.oy}</span>
                  </p>
                  {plan.price_yearly && (
                    <p className="text-sm text-[var(--text-2)] mt-0.5">{formatMoney(plan.price_yearly)}{uz.matn.yil}</p>
                  )}
                </div>

                {/* Description */}
                {plan.description && (
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{plan.description}</p>
                )}

                {/* Limits */}
                <div className="space-y-1.5 border-t border-[var(--border-2)] pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-3)]">{uz.super_admin.max_bolalar}</span>
                    <span className="font-medium text-[var(--label)]">
                      {plan.max_children !== null ? plan.max_children : uz.matn.cheksiz}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-3)]">{uz.super_admin.max_guruhlar}</span>
                    <span className="font-medium text-[var(--label)]">
                      {plan.max_groups !== null ? plan.max_groups : uz.matn.cheksiz}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-3)]">{uz.super_admin.max_tarbiyachilar}</span>
                    <span className="font-medium text-[var(--label)]">
                      {plan.max_teachers !== null ? plan.max_teachers : uz.matn.cheksiz}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-3)]">{uz.super_admin.sinov_kunlar}</span>
                    <span className="font-medium text-[var(--label)]">{plan.trial_days} {plural(plan.trial_days, uz.matn.kun)}</span>
                  </div>
                </div>

                {/* Subscriptions count */}
                {plan.subscriptions_count !== undefined && (
                  <div className="flex items-center gap-2 bg-[var(--surface-2)] rounded-lg px-3 py-2">
                    <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm text-[var(--text-2)]">
                      <strong className="text-[var(--text)]">{plan.subscriptions_count}</strong> {uz.matn.ta_faol_obuna}
                    </span>
                  </div>
                )}

                {/* Features */}
                {plan.features && plan.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {plan.features.map((f, i) => (
                      <span key={i} className="text-xs bg-[var(--primary-lt)] text-[var(--primary)] px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openEdit(plan)}
                    className="flex-1 px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-lg text-[var(--label)] hover:bg-[var(--hover)] transition-colors"
                  >
                    {uz.super_admin.plan_tahrirlash}
                  </button>
                  {plan.is_active ? (
                    <button
                      onClick={() => handleDeactivate(plan)}
                      disabled={deactivating === plan.id}
                      className="flex-1 px-4 py-2 text-sm font-medium border border-[var(--warning-bg)] rounded-lg text-[var(--warning-text)] hover:bg-[var(--warning-soft)] transition-colors disabled:opacity-50"
                    >
                      {deactivating === plan.id ? "..." : uz.super_admin.plan_faolsizlantir}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(plan)}
                      disabled={activating === plan.id}
                      className="flex-1 px-4 py-2 text-sm font-medium border border-[#D1FAE5] rounded-lg text-[#065F46] hover:bg-[var(--success-bg)] transition-colors disabled:opacity-50"
                    >
                      {activating === plan.id ? "..." : uz.super_admin.faollashtirish}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editTarget ? uz.super_admin.plan_tahrirlash : uz.super_admin.plan_qoshish}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="plan-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="plan-form" onSubmit={handleSave} className="space-y-4">
          {saveError && (
            <div className="bg-[var(--error-soft)] border border-[var(--error-border)] text-[var(--error)] rounded-lg px-4 py-3 text-sm">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={uz.super_admin.tarif_nomi}
              value={form.name}
              onChange={(e) => f("name", e.target.value)}
              error={formErrors.name?.[0]}
              required
              placeholder={uz.matn.masalan_standart}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.oylik_narx} (UZS) <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.price_monthly}
                onChange={(e) => f("price_monthly", e.target.value)}
                required
                placeholder="599000"
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-all duration-150 ${
                  formErrors.price_monthly
                    ? "border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20"
                    : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                }`}
              />
              {formErrors.price_monthly?.[0] && (
                <p className="text-xs text-[#EF4444] mt-1">{formErrors.price_monthly[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.yillik_narx} (UZS)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.price_yearly}
                onChange={(e) => f("price_yearly", e.target.value)}
                placeholder={uz.matn.ixtiyoriy_2}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
              />
            </div>
            <Input
              label={uz.super_admin.sinov_kunlar}
              type="number"
              min="0"
              value={form.trial_days}
              onChange={(e) => f("trial_days", e.target.value)}
              error={formErrors.trial_days?.[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
              {uz.matn.tavsif}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
              rows={2}
              placeholder={uz.matn.tarif_haqida_qisqacha_malumot}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all resize-none"
            />
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
              {uz.matn.imkoniyatlar_features}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                ref={featureInput}
                type="text"
                placeholder={uz.matn.imkoniyat_qoshish}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = featureInput.current?.value.trim();
                    if (val && !form.features.includes(val)) {
                      setForm((p) => ({ ...p, features: [...p.features, val] }));
                      if (featureInput.current) featureInput.current.value = "";
                    }
                  }
                }}
                className="flex-1 rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  const val = featureInput.current?.value.trim();
                  if (val && !form.features.includes(val)) {
                    setForm((p) => ({ ...p, features: [...p.features, val] }));
                    if (featureInput.current) featureInput.current.value = "";
                  }
                }}
                className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-lg text-[var(--label)] hover:bg-[var(--hover)] transition-colors"
              >
                {uz.matn.qoshish}
              </button>
            </div>
            {form.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 text-xs bg-[var(--primary-lt)] text-[var(--primary)] px-2.5 py-1 rounded-full"
                  >
                    {feat}
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, features: p.features.filter((_, i) => i !== idx) }))}
                      className="text-[var(--primary)] hover:text-[#5B21B6] ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.max_bolalar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_children}
                onChange={(e) => f("max_children", e.target.value)}
                placeholder={uz.matn.cheksiz}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.max_guruhlar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_groups}
                onChange={(e) => f("max_groups", e.target.value)}
                placeholder={uz.matn.cheksiz}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.max_tarbiyachilar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_teachers}
                onChange={(e) => f("max_teachers", e.target.value)}
                placeholder={uz.matn.cheksiz}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={uz.matn.tartib_raqami}
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) => f("sort_order", e.target.value)}
              error={formErrors.sort_order?.[0]}
            />
            <div className="flex items-center gap-3 mt-6">
              <input
                type="checkbox"
                id="plan-is-active"
                checked={form.is_active}
                onChange={(e) => f("is_active", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20 accent-[var(--primary)]"
              />
              <label htmlFor="plan-is-active" className="text-sm font-medium text-[var(--label)] cursor-pointer">
                {uz.common.faol}
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
