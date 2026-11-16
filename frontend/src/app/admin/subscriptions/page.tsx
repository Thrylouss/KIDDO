"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import uz, { intlLocale, plural } from "@/i18n";
import type { FullSubscription, Plan, PaginatedResponse, PlatformSummary, ApiResponse } from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

function subStatusVariant(status: string): "success" | "info" | "warning" | "error" | "neutral" {
  if (status === "active")   return "success";
  if (status === "trial")    return "info";
  if (status === "past_due") return "warning";
  if (status === "expired")  return "error";
  return "neutral";
}

function subStatusLabel(status: string): string {
  return {
    active:    uz.super_admin.faol,
    trial:     uz.super_admin.sinov,
    past_due:  uz.super_admin.past_due,
    expired:   uz.super_admin.muddati_tugagan,
    cancelled: uz.super_admin.bekor,
  }[status] ?? status;
}

function DaysCell({ days, status }: { days: number; status: string }) {
  if (status === "expired" || status === "cancelled") {
    return <span className="text-[#EF4444] text-sm font-medium">{uz.matn.tugagan}</span>;
  }
  if (days === 0) return <span className="text-[#EF4444] text-sm font-semibold">{uz.matn.bugun_tugaydi}</span>;
  const cls = days < 7
    ? "text-[#EF4444] font-semibold"
    : days <= 14
    ? "text-[#F59E0B] font-semibold"
    : "text-[var(--text-2)]";
  return <span className={`text-sm ${cls}`}>{days} {plural(days, uz.super_admin.qolgan_kun)}</span>;
}

// ── Pagination component ───────────────────────────────────────────

function Pagination({
  meta,
  onPage,
}: {
  meta: { current_page: number; last_page: number; total: number };
  onPage: (page: number) => void;
}) {
  if (meta.last_page <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border)]">
      <p className="text-sm text-[var(--text-2)]">{uz.matn.jami} {meta.total} {uz.matn.ta}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--label)] disabled:opacity-40 hover:bg-[var(--hover)] transition-colors"
        >
          {uz.matn.oldingi}
        </button>
        {Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => {
          const page = i + 1;
          return (
            <button
              key={page}
              onClick={() => onPage(page)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                page === meta.current_page
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"
              }`}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page === meta.last_page}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--label)] disabled:opacity-40 hover:bg-[var(--hover)] transition-colors"
        >
          {uz.matn.keyingi}
        </button>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────

interface RenewForm {
  plan_id:        string;
  ends_at:        string;
  payment_status: string;
  notes:          string;
}

const emptyRenew: RenewForm = { plan_id: "", ends_at: "", payment_status: "paid", notes: "" };

// ── Page ───────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [subs,    setSubs]    = useState<FullSubscription[]>([]);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [meta,    setMeta]    = useState({ current_page: 1, last_page: 1, total: 0, per_page: 15 });
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState<PlatformSummary["obuna_holati"] | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan,   setFilterPlan]   = useState("");
  const [page,         setPage]         = useState(1);

  // Modals
  const [selected,      setSelected]      = useState<FullSubscription | null>(null);
  const [showRenew,     setShowRenew]     = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancel,    setShowCancel]    = useState(false);

  const [renewForm,     setRenewForm]     = useState<RenewForm>(emptyRenew);
  const [renewing,      setRenewing]      = useState(false);
  const [renewErrors,   setRenewErrors]   = useState<Record<string, string[]>>({});
  const [changePlanForm, setChangePlanForm] = useState({ plan_id: "" });
  const [changingPlan,  setChangingPlan]  = useState(false);
  const [cancelForm,    setCancelForm]    = useState({ reason: "" });
  const [cancelling,    setCancelling]    = useState(false);

  const minRenewDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (filterStatus) params.set("status", filterStatus);
      if (filterPlan)   params.set("plan_id", filterPlan);
      const res = await api.get<PaginatedResponse<FullSubscription>>(`/v1/super-admin/subscriptions?${params}`);
      setSubs(res.data);
      setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterPlan]);

  async function loadStats() {
    try {
      const res = await api.get<PlatformSummary>("/v1/super-admin/dashboard");
      setStats(res.obuna_holati);
    } catch { /* ignore */ }
  }

  async function loadPlans() {
    try {
      const res = await api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans");
      setPlans(res.data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadStats();
    loadPlans();
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  function openRenew(sub: FullSubscription) {
    setSelected(sub);
    setRenewForm({ ...emptyRenew, plan_id: String(sub.plan_id) });
    setShowRenew(true);
  }

  function openChangePlan(sub: FullSubscription) {
    setSelected(sub);
    setChangePlanForm({ plan_id: "" });
    setShowChangePlan(true);
  }

  function openCancel(sub: FullSubscription) {
    setSelected(sub);
    setCancelForm({ reason: "" });
    setShowCancel(true);
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setRenewErrors({});
    setRenewing(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${selected.id}/renew`, {
        plan_id:        parseInt(renewForm.plan_id),
        ends_at:        renewForm.ends_at,
        payment_status: renewForm.payment_status,
        notes:          renewForm.notes || null,
      });
      setShowRenew(false);
      await loadSubs();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setRenewErrors(e.data.errors);
    } finally {
      setRenewing(false);
    }
  }

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setChangingPlan(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${selected.id}/change-plan`, {
        plan_id: parseInt(changePlanForm.plan_id),
        effective_immediately: true,
      });
      setShowChangePlan(false);
      await loadSubs();
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setCancelling(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${selected.id}/cancel`, {
        reason: cancelForm.reason || null,
      });
      setShowCancel(false);
      await loadSubs();
    } finally {
      setCancelling(false);
    }
  }

  const statTiles = [
    { key: "active",    label: uz.super_admin.faol_obunalar,        color: "bg-[var(--success-bg)] text-[var(--success)]" },
    { key: "trial",     label: uz.super_admin.trial_obunalar,       color: "bg-[var(--info-bg)] text-[var(--primary)]" },
    { key: "past_due",  label: uz.super_admin.past_due,             color: "bg-[var(--warning-bg)] text-[var(--warning-text)]" },
    { key: "expired",   label: uz.super_admin.tugagan_obunalar,     color: "bg-[var(--error-bg)] text-[var(--error)]" },
    { key: "cancelled", label: uz.super_admin.bekor,                color: "bg-[var(--border-2)] text-[var(--label)]" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.obunalar}</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{uz.matn.barcha_bogchalar_obunalarini_boshqaring}</p>
        </div>
      </div>

      {/* Stat tiles */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statTiles.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => { setFilterStatus(filterStatus === key ? "" : key); setPage(1); }}
              className={`rounded-xl border p-4 text-center transition-all ${
                filterStatus === key
                  ? "border-[var(--primary)] ring-1 ring-[var(--primary)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              } bg-white`}
            >
              <div className={`text-xl font-bold mb-1 px-2 py-1 rounded-lg inline-block ${color}`}>
                {stats[key as keyof typeof stats]}
              </div>
              <p className="text-xs text-[var(--text-2)] mt-1">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Select
              label={uz.super_admin.filter_status}
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            >
              <option value="">{uz.common.hammasi}</option>
              <option value="active">{uz.super_admin.faol}</option>
              <option value="trial">{uz.super_admin.sinov}</option>
              <option value="past_due">{uz.super_admin.past_due}</option>
              <option value="expired">{uz.super_admin.muddati_tugagan}</option>
              <option value="cancelled">{uz.super_admin.bekor}</option>
            </Select>
          </div>
          <div className="w-44">
            <Select
              label={uz.matn.tarif_boyicha}
              value={filterPlan}
              onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
            >
              <option value="">{uz.common.hammasi}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          {(filterStatus || filterPlan) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterPlan(""); setPage(1); }}
              className="px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              {uz.matn.tozalash}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-[var(--border-2)]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-40 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-24 bg-[var(--border-2)] rounded" />
                <div className="h-6 w-16 bg-[var(--border-2)] rounded-full" />
                <div className="h-4 w-20 bg-[var(--border-2)] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="h-10 w-10 text-[var(--border-strong)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[var(--text-3)] text-sm">{uz.common.malumot_yoq}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.matn.bogcha}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.tarif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.tugash}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.qolgan}</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.amallar}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-2)]">
                  {subs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[var(--primary-lt)] flex items-center justify-center text-[var(--primary)] font-bold text-xs flex-shrink-0">
                            {(sub.organization?.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <Link
                            href={`/admin/bogchalar/${sub.organization_id}`}
                            className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors"
                          >
                            {sub.organization?.name ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-2)]">{sub.plan?.name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={subStatusVariant(sub.status)}>{subStatusLabel(sub.status)}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-2)]">{fmtDate(sub.ends_at)}</td>
                      <td className="px-5 py-3.5">
                        <DaysCell days={sub.days_remaining} status={sub.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/bogchalar/${sub.organization_id}`}
                            className="px-2.5 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-lt)] rounded-lg transition-colors"
                          >
                            {uz.matn.korish}
                          </Link>
                          <button
                            onClick={() => openRenew(sub)}
                            className="px-2.5 py-1.5 text-xs font-medium text-[var(--label)] hover:bg-[var(--border-2)] rounded-lg transition-colors"
                          >
                            {uz.matn.uzaytirish}
                          </button>
                          {sub.status !== "cancelled" && sub.status !== "expired" && (
                            <button
                              onClick={() => openChangePlan(sub)}
                              className="px-2.5 py-1.5 text-xs font-medium text-[var(--label)] hover:bg-[var(--border-2)] rounded-lg transition-colors"
                            >
                              {uz.super_admin.tarif_almashtirish}
                            </button>
                          )}
                          {sub.status !== "cancelled" && (
                            <button
                              onClick={() => openCancel(sub)}
                              className="px-2.5 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] rounded-lg transition-colors"
                            >
                              {uz.matn.bekor_qilish}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-[var(--border-2)]">
              {subs.map((sub) => (
                <div key={sub.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-[var(--primary-lt)] flex items-center justify-center text-[var(--primary)] font-bold text-xs flex-shrink-0">
                        {(sub.organization?.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text)] text-sm">{sub.organization?.name ?? "—"}</p>
                        <p className="text-xs text-[var(--text-3)]">{sub.plan?.name ?? "—"}</p>
                      </div>
                    </div>
                    <Badge variant={subStatusVariant(sub.status)}>{subStatusLabel(sub.status)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-3)]">{uz.super_admin.tugash}: {fmtDate(sub.ends_at)}</span>
                    <DaysCell days={sub.days_remaining} status={sub.status} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/admin/bogchalar/${sub.organization_id}`} className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--label)] hover:bg-[var(--hover)]">{uz.matn.korish}</Link>
                    <button onClick={() => openRenew(sub)} className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--label)] hover:bg-[var(--hover)]">{uz.matn.uzaytirish}</button>
                    {sub.status !== "cancelled" && (
                      <button onClick={() => openCancel(sub)} className="text-xs px-3 py-1.5 border border-[var(--error-bg)] rounded-lg text-[var(--error)] hover:bg-[var(--error-soft)]">{uz.matn.bekor}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Pagination meta={meta} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>

      {/* Renew Modal */}
      <Modal
        open={showRenew}
        onClose={() => { setShowRenew(false); setRenewErrors({}); }}
        title={uz.super_admin.obuna_uzaytirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRenew(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="sub-renew-form" type="submit" loading={renewing}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="sub-renew-form" onSubmit={handleRenew} className="space-y-4">
          {selected?.organization && (
            <div className="px-4 py-3 bg-[var(--surface-2)] rounded-lg">
              <p className="text-xs text-[var(--text-3)] mb-1">{uz.matn.bogcha}</p>
              <p className="text-sm font-medium text-[var(--text)]">{selected.organization.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.tarif}
            value={renewForm.plan_id}
            onChange={(e) => setRenewForm({ ...renewForm, plan_id: e.target.value })}
            error={renewErrors.plan_id?.[0]}
            required
          >
            <option value="">{uz.matn.tanlang}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString(intlLocale())} UZS
              </option>
            ))}
          </Select>
          <Input
            label={uz.super_admin.yangi_tugash}
            type="date"
            value={renewForm.ends_at}
            onChange={(e) => setRenewForm({ ...renewForm, ends_at: e.target.value })}
            min={minRenewDate}
            error={renewErrors.ends_at?.[0]}
            required
          />
          <Select
            label={uz.super_admin.tolov_holati}
            value={renewForm.payment_status}
            onChange={(e) => setRenewForm({ ...renewForm, payment_status: e.target.value })}
            required
          >
            <option value="paid">{uz.matn.tolangan}</option>
            <option value="pending">{uz.matn.kutilmoqda}</option>
          </Select>
          <Input
            label={uz.super_admin.eslatma}
            value={renewForm.notes}
            onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
            placeholder={uz.matn.ixtiyoriy_izoh}
          />
        </form>
      </Modal>

      {/* Change Plan Modal */}
      <Modal
        open={showChangePlan}
        onClose={() => setShowChangePlan(false)}
        title={uz.super_admin.tarif_almashtirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangePlan(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="sub-change-plan-form" type="submit" loading={changingPlan}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="sub-change-plan-form" onSubmit={handleChangePlan} className="space-y-4">
          {selected?.plan && (
            <div className="px-4 py-3 bg-[var(--surface-2)] rounded-lg">
              <p className="text-xs text-[var(--text-3)] mb-1">{uz.super_admin.joriy_tarif}</p>
              <p className="text-sm font-medium text-[var(--text)]">{selected.plan.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.yangi_tarif}
            value={changePlanForm.plan_id}
            onChange={(e) => setChangePlanForm({ plan_id: e.target.value })}
            required
          >
            <option value="">{uz.matn.tanlang}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString(intlLocale())} UZS
              </option>
            ))}
          </Select>
          <p className="text-xs text-[var(--text-3)]">{uz.super_admin.darhol} {uz.matn.kuchga_kiradi}</p>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={uz.matn.obunani_bekor_qilish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancel(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="sub-cancel-form" type="submit" loading={cancelling} variant="danger">
              {uz.matn.bekor_qilish}
            </Button>
          </>
        }
      >
        <form id="sub-cancel-form" onSubmit={handleCancel} className="space-y-4">
          {selected?.organization && (
            <p className="text-sm text-[var(--text-2)]">
              <strong>{selected.organization.name}</strong> {uz.matn.obunasini_bekor_qilmoqchimisiz}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
              {uz.super_admin.bekor_qilish_sababi} {uz.matn.ixtiyoriy}
            </label>
            <textarea
              value={cancelForm.reason}
              onChange={(e) => setCancelForm({ reason: e.target.value })}
              rows={3}
              placeholder={uz.matn.sabab}
              className="w-full px-3.5 py-2.5 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
