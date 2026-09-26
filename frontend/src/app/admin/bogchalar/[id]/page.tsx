"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, impersonation } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationDetail, OrgPayment, OrgActivity, ApiResponse, Plan } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function subVariant(status: string): "success" | "info" | "warning" | "error" | "neutral" {
  if (status === "active")   return "success";
  if (status === "trial")    return "info";
  if (status === "past_due") return "warning";
  if (status === "expired")  return "error";
  return "neutral";
}

function subLabel(status: string): string {
  return {
    active:   uz.super_admin.faol,
    trial:    uz.super_admin.sinov,
    past_due: uz.super_admin.past_due,
    expired:  uz.super_admin.muddati_tugagan,
    cancelled: uz.super_admin.bekor,
  }[status] ?? status;
}

function payVariant(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid")    return "success";
  if (status === "pending") return "warning";
  if (status === "failed")  return "error";
  return "neutral";
}

function payLabel(status: string): string {
  return {
    paid:     uz.super_admin.to_langan,
    pending:  uz.super_admin.kutilmoqda_pay,
    failed:   uz.super_admin.muvaffaqiyatsiz,
    refunded: uz.super_admin.qaytarilgan,
  }[status] ?? status;
}

function formatMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Hozir";
  if (m < 60)  return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d} kun oldin`;
  return fmtDate(iso);
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "organization.created":     "Bog'cha yaratildi",
    "organization.updated":     "Ma'lumotlar o'zgartirildi",
    "organization.deactivated": "Bog'cha faolsizlantirildi",
    "organization.entered":     "Panelga kirildi",
    "subscription.renewed":     "Obuna uzaytirildi",
    "organization.deleted":     "Bog'cha o'chirildi",
  };
  return map[action] ?? action;
}

function actionIcon(action: string): React.ReactNode {
  if (action.startsWith("subscription"))
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  if (action.includes("entered"))
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
      </svg>
    );
  if (action.includes("deactivated"))
    return (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    );
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#111827] leading-none">{value}</p>
        <p className="text-xs text-[#9CA3AF] mt-1">{label}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children, action }: {
  title: string; children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <div className="text-sm font-medium text-[#111827]">{children}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

interface RenewForm {
  plan_id:        string;
  ends_at:        string;
  payment_status: string;
  notes:          string;
}

const emptyRenew: RenewForm = { plan_id: "", ends_at: "", payment_status: "paid", notes: "" };

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params.id as string;

  const [org,       setOrg]       = useState<OrganizationDetail | null>(null);
  const [payments,  setPayments]  = useState<OrgPayment[]>([]);
  const [activity,  setActivity]  = useState<OrgActivity[]>([]);
  const [plans,     setPlans]     = useState<Plan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  const [showRenew,     setShowRenew]     = useState(false);
  const [renewForm,     setRenewForm]     = useState<RenewForm>(emptyRenew);
  const [renewing,      setRenewing]      = useState(false);
  const [renewErrors,   setRenewErrors]   = useState<Record<string, string[]>>({});

  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancel,     setShowCancel]     = useState(false);
  const [changePlanForm, setChangePlanForm] = useState({ plan_id: "" });
  const [cancelForm,     setCancelForm]     = useState({ reason: "" });
  const [changingPlan,   setChangingPlan]   = useState(false);
  const [cancelling,     setCancelling]     = useState(false);

  const [entering,      setEntering]      = useState(false);
  const [deactivating,  setDeactivating]  = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const [showResetPwd,  setShowResetPwd]  = useState(false);
  const [resetPwdForm,  setResetPwdForm]  = useState({ password: "" });
  const [resetPwding,   setResetPwding]   = useState(false);
  const [resetPwdError, setResetPwdError] = useState("");

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const [orgRes, pymRes, actRes, plnRes] = await Promise.all([
        api.get<{ data: OrganizationDetail }>(`/v1/super-admin/organizations/${id}`),
        api.get<ApiResponse<OrgPayment[]>>(`/v1/super-admin/organizations/${id}/payments`),
        api.get<ApiResponse<OrgActivity[]>>(`/v1/super-admin/organizations/${id}/activity`),
        api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans"),
      ]);
      setOrg(orgRes.data);
      setPayments(pymRes.data);
      setActivity(actRes.data);
      setPlans(plnRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleEnter() {
    setEntering(true);
    try {
      await api.post(`/v1/super-admin/organizations/${id}/enter`, {});
      impersonation.start(Number(id), org?.name ?? "");
      router.push("/bogcha/dashboard");
    } finally {
      setEntering(false);
    }
  }

  async function handleDeactivate() {
    const msg = org?.is_active ? uz.super_admin.faolsizlantir_tasdiq : uz.super_admin.faollashtirish_tasdiq;
    if (!window.confirm(msg)) return;
    setDeactivating(true);
    try {
      if (org?.is_active) {
        await api.patch(`/v1/super-admin/organizations/${id}/deactivate`, {});
      } else {
        await api.patch(`/v1/super-admin/organizations/${id}/activate`, {});
      }
      await load();
    } finally {
      setDeactivating(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetPwdError("");
    setResetPwding(true);
    try {
      await api.post(`/v1/super-admin/organizations/${id}/reset-password`, {
        password: resetPwdForm.password,
      });
      setShowResetPwd(false);
      setResetPwdForm({ password: "" });
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      setResetPwdError(e?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setResetPwding(false);
    }
  }

  async function handleDelete() {
    const confirm1 = window.confirm(uz.super_admin.ochir_tasdiq);
    if (!confirm1) return;
    const confirm2 = window.prompt("Tasdiqlash uchun bog'cha nomini kiriting:");
    if (confirm2?.trim() !== org?.name.trim()) {
      window.alert("Nom mos kelmadi. Bekor qilindi.");
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/v1/super-admin/organizations/${id}`);
      router.push("/admin/bogchalar");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    setRenewErrors({});
    setRenewing(true);
    try {
      await api.post(`/v1/super-admin/organizations/${id}/renew`, {
        plan_id:        parseInt(renewForm.plan_id),
        ends_at:        renewForm.ends_at,
        payment_status: renewForm.payment_status,
        notes:          renewForm.notes || null,
      });
      setShowRenew(false);
      setRenewForm(emptyRenew);
      await load();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setRenewErrors(e.data.errors);
    } finally {
      setRenewing(false);
    }
  }

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!sub) return;
    setChangingPlan(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${sub.id}/change-plan`, {
        plan_id: parseInt(changePlanForm.plan_id),
        effective_immediately: true,
      });
      setShowChangePlan(false);
      setChangePlanForm({ plan_id: "" });
      await load();
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!sub) return;
    setCancelling(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${sub.id}/cancel`, {
        reason: cancelForm.reason || null,
      });
      setShowCancel(false);
      setCancelForm({ reason: "" });
      await load();
    } finally {
      setCancelling(false);
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-[#F3F4F6] rounded" />
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#F3F4F6]" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-48 bg-[#F3F4F6] rounded" />
              <div className="h-3 w-32 bg-[#F3F4F6] rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]" />)}
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center space-y-3">
          <p className="text-[#6B7280]">{uz.common.yuklash_xatosi}</p>
          <Button onClick={load}>{uz.common.qayta_urinish}</Button>
        </div>
      </div>
    );
  }

  const sub = org.subscription;
  const daysLeft = sub?.days_remaining ?? 0;
  const daysBarPct = sub?.ends_at
    ? Math.min(100, Math.max(0, Math.round(daysLeft / 30 * 100)))
    : 0;
  const daysBarColor = daysLeft > 14 ? "bg-[#22C55E]" : daysLeft > 7 ? "bg-[#F59E0B]" : "bg-[#EF4444]";

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <Link
        href="/admin/bogchalar"
        className="inline-flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#374151] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {uz.super_admin.bogchalar}
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] text-xl font-bold flex-shrink-0 select-none">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#111827]">{org.name}</h1>
                <Badge variant={org.is_active ? "success" : "neutral"}>
                  {org.is_active ? uz.common.faol : uz.common.nofaol}
                </Badge>
              </div>
              <div className="mt-1.5 space-y-0.5">
                {org.phone && (
                  <p className="text-sm text-[#6B7280] flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {org.phone}
                  </p>
                )}
                {org.address && (
                  <p className="text-sm text-[#6B7280] flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {org.address}
                  </p>
                )}
                <p className="text-xs text-[#C4C9D4]">
                  Qo&apos;shilgan: {fmtDate(org.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleEnter}
              loading={entering}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              }
            >
              {uz.super_admin.bogcha_panel}
            </Button>
          </div>
        </div>

      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Bolalar" value={org.children_count} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        } />
        <KpiCard label="Guruhlar" value={org.groups_count} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        } />
        <KpiCard label="Tarbiyachilar" value={org.teacher_profiles_count} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        } />
        <KpiCard label="Adminlar" value={org.admins.length} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        } />
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: main content (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Subscription */}
          <SectionCard
            title={uz.super_admin.obuna_malumotlari}
            action={
              <button
                onClick={() => setShowRenew(true)}
                className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors"
              >
                {uz.super_admin.obuna_uzaytirish}
              </button>
            }
          >
            <div className="px-6 py-4">
              {sub ? (
                <div className="space-y-1">
                  <Row label={uz.super_admin.tarif}>
                    <span>{sub.plan?.name ?? "—"}</span>
                  </Row>
                  <Row label={uz.super_admin.obuna}>
                    <Badge variant={subVariant(sub.status)}>{subLabel(sub.status)}</Badge>
                  </Row>
                  <Row label={uz.super_admin.tugash}>
                    {fmtDate(sub.ends_at ?? sub.trial_ends_at)}
                  </Row>
                  <Row label={uz.super_admin.qolgan}>
                    <span className={daysLeft <= 7 ? "text-[#EF4444] font-semibold" : daysLeft <= 14 ? "text-[#F59E0B] font-semibold" : ""}>
                      {daysLeft} {uz.super_admin.qolgan_kun}
                    </span>
                  </Row>
                  {sub.ends_at && (
                    <div className="pt-3">
                      <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${daysBarColor}`}
                          style={{ width: `${daysBarPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#9CA3AF] py-2">{uz.super_admin.obuna_yoq}</p>
              )}
            </div>
          </SectionCard>

          {/* Payment history */}
          <SectionCard title={uz.super_admin.tolov_tarixi}>
            {payments.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-[#9CA3AF]">
                {uz.super_admin.hech_tolov_yoq}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.sana}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.summa}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">{uz.super_admin.tarif}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[#111827]">{fmtDate(p.paid_at ?? p.created_at)}</p>
                          {p.invoice_number && (
                            <p className="text-xs text-[#C4C9D4] font-mono mt-0.5">{p.invoice_number}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[#111827]">
                          {formatMoney(p.amount, p.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-[#6B7280] hidden sm:table-cell">
                          {p.plan_name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={payVariant(p.status)}>{payLabel(p.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Activity log */}
          <SectionCard title={uz.super_admin.faoliyat_tarixi}>
            {activity.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-[#9CA3AF]">
                {uz.super_admin.hech_faoliyat_yoq}
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 px-6 py-3.5">
                    <div className="h-6 w-6 rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {actionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#111827]">{log.description}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">
                        {log.user ? `${log.user.name} · ` : ""}{relTime(log.created_at)}
                      </p>
                    </div>
                    <span className="text-xs text-[#D1D5DB] flex-shrink-0 hidden sm:inline">{actionLabel(log.action)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-5">

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-2">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">{uz.super_admin.amallar}</p>

            <Button
              className="w-full justify-center"
              onClick={handleEnter}
              loading={entering}
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              }
            >
              {uz.super_admin.bogcha_panel}
            </Button>

            <button
              onClick={() => setShowRenew(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {uz.super_admin.obuna_uzaytirish}
            </button>

            {sub && sub.status !== "cancelled" && sub.status !== "expired" && (
              <button
                onClick={() => setShowChangePlan(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {uz.super_admin.tarif_almashtirish}
              </button>
            )}

            {sub && sub.status !== "cancelled" && (
              <button
                onClick={() => setShowCancel(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#FEF3C7] text-sm font-medium text-[#92400E] hover:bg-[#FFFBEB] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Obunani bekor qilish
              </button>
            )}

            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#D1D5DB] cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Xabar yuborish
              <span className="ml-auto text-[10px] bg-[#F3F4F6] text-[#C4C9D4] px-1.5 py-0.5 rounded-full">{uz.common.tez_kunda}</span>
            </button>

            <div className="border-t border-[#F3F4F6] pt-2 mt-2 space-y-1.5">
              <button
                onClick={() => setShowResetPwd(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {uz.super_admin.admin_parol_yangilash}
              </button>

              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  org.is_active
                    ? "border-[#FEF3C7] text-[#92400E] hover:bg-[#FFFBEB]"
                    : "border-[#DCFCE7] text-[#166534] hover:bg-[#F0FDF4]"
                }`}
              >
                {org.is_active ? uz.super_admin.faolsizlantir : uz.super_admin.faollashtirish}
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#FEE2E2] text-sm font-medium text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
              >
                {uz.common.ochirish}
              </button>
            </div>
          </div>

          {/* Admins */}
          <div className="bg-white rounded-xl border border-[#E5E7EB]">
            <div className="px-5 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.admin_malumotlari}</h2>
            </div>
            <div className="p-5">
              {org.admins.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">{uz.super_admin.admin_yoq}</p>
              ) : (
                <ul className="space-y-3">
                  {org.admins.map((admin) => (
                    <li key={admin.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold flex-shrink-0">
                        {(admin.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{admin.name}</p>
                        <p className="text-xs text-[#9CA3AF] truncate">{admin.phone ?? admin.email ?? "—"}</p>
                      </div>
                      <Badge variant={admin.is_active ? "success" : "neutral"}>
                        {admin.is_active ? uz.common.faol : uz.common.nofaol}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Renew Subscription Modal */}
      <Modal
        open={showRenew}
        onClose={() => { setShowRenew(false); setRenewForm(emptyRenew); setRenewErrors({}); }}
        title={uz.super_admin.obuna_uzaytirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRenew(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="renew-form" type="submit" loading={renewing}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="renew-form" onSubmit={handleRenew} className="space-y-4">
          <Select
            label={uz.super_admin.tarif}
            value={renewForm.plan_id}
            onChange={(e) => setRenewForm({ ...renewForm, plan_id: e.target.value })}
            error={renewErrors.plan_id?.[0]}
            required
          >
            <option value="">— Tanlang —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>

          <Input
            label={uz.super_admin.yangi_tugash}
            type="date"
            value={renewForm.ends_at}
            onChange={(e) => setRenewForm({ ...renewForm, ends_at: e.target.value })}
            min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
            error={renewErrors.ends_at?.[0]}
            required
          />

          <Select
            label={uz.super_admin.tolov_holati}
            value={renewForm.payment_status}
            onChange={(e) => setRenewForm({ ...renewForm, payment_status: e.target.value })}
            required
          >
            <option value="paid">To&apos;langan</option>
            <option value="pending">Kutilmoqda</option>
          </Select>

          <Input
            label={uz.super_admin.eslatma}
            value={renewForm.notes}
            onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
            placeholder="Ixtiyoriy izoh..."
          />
        </form>
      </Modal>

      {/* Change Plan Modal */}
      <Modal
        open={showChangePlan}
        onClose={() => { setShowChangePlan(false); setChangePlanForm({ plan_id: "" }); }}
        title={uz.super_admin.tarif_almashtirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangePlan(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="change-plan-form" type="submit" loading={changingPlan}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="change-plan-form" onSubmit={handleChangePlan} className="space-y-4">
          {sub?.plan && (
            <div className="px-4 py-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-xs text-[#9CA3AF] mb-1">{uz.super_admin.joriy_tarif}</p>
              <p className="text-sm font-medium text-[#111827]">{sub.plan.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.yangi_tarif}
            value={changePlanForm.plan_id}
            onChange={(e) => setChangePlanForm({ plan_id: e.target.value })}
            required
          >
            <option value="">— Tanlang —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>
          <p className="text-xs text-[#9CA3AF]">{uz.super_admin.darhol} kuchga kiradi</p>
        </form>
      </Modal>

      {/* Reset Admin Password Modal */}
      <Modal
        open={showResetPwd}
        onClose={() => { setShowResetPwd(false); setResetPwdForm({ password: "" }); setResetPwdError(""); }}
        title={uz.super_admin.admin_parol_yangilash}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResetPwd(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="reset-pwd-form" type="submit" loading={resetPwding}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="reset-pwd-form" onSubmit={handleResetPassword} className="space-y-4">
          {resetPwdError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm px-4 py-3 rounded-xl">
              {resetPwdError}
            </div>
          )}
          <Input
            label={uz.super_admin.yangi_parol}
            type="password"
            value={resetPwdForm.password}
            onChange={(e) => setResetPwdForm({ password: e.target.value })}
            required
          />
          <p className="text-xs text-[#9CA3AF]">Parol kamida 6 ta belgidan iborat bo&apos;lishi kerak.</p>
        </form>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal
        open={showCancel}
        onClose={() => { setShowCancel(false); setCancelForm({ reason: "" }); }}
        title="Obunani bekor qilish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancel(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="cancel-form" type="submit" loading={cancelling} variant="danger">
              {uz.super_admin.obuna_bekor_tasdiq.split("?")[0]}
            </Button>
          </>
        }
      >
        <form id="cancel-form" onSubmit={handleCancel} className="space-y-4">
          <p className="text-sm text-[#6B7280]">{uz.super_admin.obuna_bekor_tasdiq}</p>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {uz.super_admin.bekor_qilish_sababi} (ixtiyoriy)
            </label>
            <textarea
              value={cancelForm.reason}
              onChange={(e) => setCancelForm({ reason: e.target.value })}
              rows={3}
              placeholder="Sabab..."
              className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
