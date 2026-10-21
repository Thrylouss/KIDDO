"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { Plan, ApiResponse } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function formatMoney(amount: string | number | null): string {
  if (amount === null || amount === "" || amount === undefined) return "—";
  return `${Number(amount).toLocaleString("uz-UZ")} UZS`;
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
        setDeactError(e?.data?.message ?? "Bu tarifda faol obunalar bor, faolsizlantirish mumkin emas.");
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
          <h1 className="text-2xl font-bold text-[#29232A]">{uz.super_admin.tariflar}</h1>
          <p className="text-sm text-[#B8AAB2] mt-0.5">Obuna tariflarini boshqaring</p>
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
        <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-xl px-5 py-3.5 text-sm">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          {deactError}
          <button onClick={() => setDeactError("")} className="ml-auto text-[#991B1B] hover:text-[#7F1D1D]">
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
            <div key={i} className="bg-white rounded-xl border border-[#EDE3E8] p-6 space-y-4">
              <div className="h-6 w-32 bg-[#F2ECF0] rounded" />
              <div className="h-8 w-40 bg-[#F2ECF0] rounded" />
              <div className="space-y-2">
                {[1, 2, 3].map(j => <div key={j} className="h-3 w-full bg-[#F2ECF0] rounded" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-12 text-center space-y-3">
          <p className="text-[#766B73]">{uz.common.yuklash_xatosi}</p>
          <Button onClick={load}>{uz.common.qayta_urinish}</Button>
        </div>
      )}

      {/* Plans grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.length === 0 ? (
            <div className="lg:col-span-3 bg-white rounded-xl border border-[#EDE3E8] p-16 text-center">
              <svg className="h-10 w-10 text-[#D9C9D1] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-[#B8AAB2] text-sm">Hali tarif yaratilmagan</p>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl border border-[#EDE3E8] p-6 flex flex-col gap-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#29232A]">{plan.name}</h3>
                    {plan.slug && (
                      <p className="text-xs text-[#B8AAB2] font-mono mt-0.5">{plan.slug}</p>
                    )}
                  </div>
                  <Badge variant={plan.is_active ? "success" : "neutral"}>
                    {plan.is_active ? uz.common.faol : uz.common.nofaol}
                  </Badge>
                </div>

                {/* Price */}
                <div>
                  <p className="text-2xl font-bold text-[#29232A]">
                    {formatMoney(plan.price_monthly)}
                    <span className="text-sm font-normal text-[#B8AAB2]">/oy</span>
                  </p>
                  {plan.price_yearly && (
                    <p className="text-sm text-[#766B73] mt-0.5">{formatMoney(plan.price_yearly)}/yil</p>
                  )}
                </div>

                {/* Description */}
                {plan.description && (
                  <p className="text-sm text-[#766B73] leading-relaxed">{plan.description}</p>
                )}

                {/* Limits */}
                <div className="space-y-1.5 border-t border-[#F2ECF0] pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B8AAB2]">{uz.super_admin.max_bolalar}</span>
                    <span className="font-medium text-[#3D3240]">
                      {plan.max_children !== null ? plan.max_children : "Cheksiz"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B8AAB2]">{uz.super_admin.max_guruhlar}</span>
                    <span className="font-medium text-[#3D3240]">
                      {plan.max_groups !== null ? plan.max_groups : "Cheksiz"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B8AAB2]">{uz.super_admin.max_tarbiyachilar}</span>
                    <span className="font-medium text-[#3D3240]">
                      {plan.max_teachers !== null ? plan.max_teachers : "Cheksiz"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B8AAB2]">{uz.super_admin.sinov_kunlar}</span>
                    <span className="font-medium text-[#3D3240]">{plan.trial_days} kun</span>
                  </div>
                </div>

                {/* Subscriptions count */}
                {plan.subscriptions_count !== undefined && (
                  <div className="flex items-center gap-2 bg-[#FAF5F8] rounded-lg px-3 py-2">
                    <svg className="h-4 w-4 text-[#8E315D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-sm text-[#766B73]">
                      <strong className="text-[#29232A]">{plan.subscriptions_count}</strong> ta faol obuna
                    </span>
                  </div>
                )}

                {/* Features */}
                {plan.features && plan.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {plan.features.map((f, i) => (
                      <span key={i} className="text-xs bg-[#FDF2F6] text-[#8E315D] px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openEdit(plan)}
                    className="flex-1 px-4 py-2 text-sm font-medium border border-[#EDE3E8] rounded-lg text-[#3D3240] hover:bg-[#FFF9F5] transition-colors"
                  >
                    {uz.super_admin.plan_tahrirlash}
                  </button>
                  {plan.is_active ? (
                    <button
                      onClick={() => handleDeactivate(plan)}
                      disabled={deactivating === plan.id}
                      className="flex-1 px-4 py-2 text-sm font-medium border border-[#FEF3C7] rounded-lg text-[#92400E] hover:bg-[#FFFBEB] transition-colors disabled:opacity-50"
                    >
                      {deactivating === plan.id ? "..." : uz.super_admin.plan_faolsizlantir}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(plan)}
                      disabled={activating === plan.id}
                      className="flex-1 px-4 py-2 text-sm font-medium border border-[#D1FAE5] rounded-lg text-[#065F46] hover:bg-[#ECFDF5] transition-colors disabled:opacity-50"
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
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg px-4 py-3 text-sm">
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
              placeholder="Masalan: Standart"
            />
            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
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
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none transition-all duration-150 ${
                  formErrors.price_monthly
                    ? "border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20"
                    : "border-[#EDE3E8] focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15"
                }`}
              />
              {formErrors.price_monthly?.[0] && (
                <p className="text-xs text-[#EF4444] mt-1">{formErrors.price_monthly[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.super_admin.yillik_narx} (UZS)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.price_yearly}
                onChange={(e) => f("price_yearly", e.target.value)}
                placeholder="Ixtiyoriy"
                className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all"
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
            <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
              Tavsif
            </label>
            <textarea
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
              rows={2}
              placeholder="Tarif haqida qisqacha ma'lumot..."
              className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all resize-none"
            />
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
              Imkoniyatlar (features)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                ref={featureInput}
                type="text"
                placeholder="Imkoniyat qo'shish..."
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
                className="flex-1 rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all"
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
                className="px-4 py-2 text-sm font-medium border border-[#EDE3E8] rounded-lg text-[#3D3240] hover:bg-[#FFF9F5] transition-colors"
              >
                Qo&apos;shish
              </button>
            </div>
            {form.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 text-xs bg-[#FDF2F6] text-[#8E315D] px-2.5 py-1 rounded-full"
                  >
                    {feat}
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, features: p.features.filter((_, i) => i !== idx) }))}
                      className="text-[#8E315D] hover:text-[#5B21B6] ml-0.5"
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
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.super_admin.max_bolalar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_children}
                onChange={(e) => f("max_children", e.target.value)}
                placeholder="Cheksiz"
                className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.super_admin.max_guruhlar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_groups}
                onChange={(e) => f("max_groups", e.target.value)}
                placeholder="Cheksiz"
                className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.super_admin.max_tarbiyachilar}
              </label>
              <input
                type="number"
                min="1"
                value={form.max_teachers}
                onChange={(e) => f("max_teachers", e.target.value)}
                placeholder="Cheksiz"
                className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm text-[#29232A] placeholder:text-[#B8AAB2] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tartib raqami"
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
                className="h-4 w-4 rounded border-[#EDE3E8] text-[#8E315D] focus:ring-[#8E315D]/20 accent-[#8E315D]"
              />
              <label htmlFor="plan-is-active" className="text-sm font-medium text-[#3D3240] cursor-pointer">
                {uz.common.faol}
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
