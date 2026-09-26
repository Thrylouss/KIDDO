"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import uz from "@/i18n/uz";
import type {
  PaginatedResponse, Plan, OrganizationSummary,
  PaymentRecord, PaymentDetailRecord, PaymentSummaryFull,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
}

function payStatusVariant(s: string): "success" | "warning" | "error" | "neutral" {
  if (s === "paid")    return "success";
  if (s === "pending") return "warning";
  if (s === "failed")  return "error";
  return "neutral";
}

function payStatusLabel(s: string): string {
  return ({
    paid:     uz.super_admin.to_langan,
    pending:  uz.super_admin.kutilmoqda_pay,
    failed:   uz.super_admin.muvaffaqiyatsiz,
    refunded: uz.super_admin.qaytarilgan,
  } as Record<string, string>)[s] ?? s;
}

function payMethodLabel(m: string | null): string {
  if (!m) return "—";
  return ({
    manual: uz.super_admin.manual_pay,
    payme:  uz.super_admin.payme_pay,
    click:  uz.super_admin.click_pay,
    uzcard: uz.super_admin.uzcard_pay,
    humo:   uz.super_admin.humo_pay,
    other:  uz.super_admin.other_pay,
  } as Record<string, string>)[m] ?? m;
}

function getDateRange(preset: string): [string, string] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "bugun") return [fmt(today), fmt(today)];
  if (preset === "kecha") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return [fmt(y), fmt(y)];
  }
  if (preset === "shu_hafta") {
    const s = new Date(today);
    s.setDate(s.getDate() - (s.getDay() === 0 ? 6 : s.getDay() - 1));
    return [fmt(s), fmt(today)];
  }
  if (preset === "shu_oy") {
    return [fmt(new Date(today.getFullYear(), today.getMonth(), 1)), fmt(today)];
  }
  if (preset === "otgan_oy") {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    return [fmt(s), fmt(e)];
  }
  return ["", ""];
}

// ── Pagination ─────────────────────────────────────────────────────

function Pagination({
  meta, onPage,
}: { meta: { current_page: number; last_page: number; total: number }; onPage: (p: number) => void }) {
  if (meta.last_page <= 1) return null;
  const pages = Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#E5E7EB]">
      <p className="text-sm text-[#6B7280]">Jami {meta.total} ta</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E7EB] text-[#374151] disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors"
        >Oldingi</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              p === meta.current_page
                ? "bg-[#7C3AED] text-white"
                : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F8FAFC]"
            }`}
          >{p}</button>
        ))}
        <button
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page === meta.last_page}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E7EB] text-[#374151] disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors"
        >Keyingi</button>
      </div>
    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────

function Modal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Row helper ─────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[#F3F4F6] last:border-0">
      <span className="w-36 flex-shrink-0 text-sm text-[#6B7280]">{label}</span>
      <span className="flex-1 text-sm font-medium text-[#111827]">{children}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function TolovlarPage() {
  const [payments,     setPayments]     = useState<PaymentRecord[]>([]);
  const [summary,      setSummary]      = useState<PaymentSummaryFull | null>(null);
  const [meta,         setMeta]         = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [loading,      setLoading]      = useState(true);
  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [orgs,         setOrgs]         = useState<OrganizationSummary[]>([]);

  const [searchInput,  setSearchInput]  = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterPlanId, setFilterPlanId] = useState("");
  const [filterOrgId,  setFilterOrgId]  = useState("");
  const [datePreset,   setDatePreset]   = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [page,         setPage]         = useState(1);

  const [detailPayment,  setDetailPayment]  = useState<PaymentDetailRecord | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [verifyTarget,   setVerifyTarget]   = useState<PaymentRecord | null>(null);
  const [verifyLoading,  setVerifyLoading]  = useState(false);
  const [refundTarget,   setRefundTarget]   = useState<PaymentRecord | null>(null);
  const [refundReason,   setRefundReason]   = useState("");
  const [refundLoading,  setRefundLoading]  = useState(false);
  const [openMenuId,     setOpenMenuId]     = useState<number | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Plan[] }>("/v1/super-admin/plans?per_page=100"),
      api.get<PaginatedResponse<OrganizationSummary>>("/v1/super-admin/organizations?per_page=100"),
    ]).then(([p, o]) => { setPlans(p.data); setOrgs(o.data); }).catch(() => {});
  }, []);

  const load = useCallback(async (
    p: number, search: string, status: string, method: string,
    planId: string, orgId: string, df: string, dt: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: "20", summary: "true" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (method) params.set("payment_method", method);
      if (planId) params.set("plan_id", planId);
      if (orgId)  params.set("organization_id", orgId);
      if (df)     params.set("date_from", df);
      if (dt)     params.set("date_to", dt);
      const res = await api.get<PaginatedResponse<PaymentRecord> & { summary?: PaymentSummaryFull }>(
        `/v1/super-admin/payments?${params}`,
      );
      setPayments(res.data);
      setMeta(res.meta);
      if (res.summary) setSummary(res.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, searchInput, filterStatus, filterMethod, filterPlanId, filterOrgId, dateFrom, dateTo);
  }, [load, page, filterStatus, filterMethod, filterPlanId, filterOrgId, dateFrom, dateTo]);

  function handleSearch(value: string) {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1, value, filterStatus, filterMethod, filterPlanId, filterOrgId, dateFrom, dateTo);
    }, 350);
  }

  function applyPreset(preset: string) {
    setDatePreset(preset);
    if (preset === "maxsus") { setDateFrom(""); setDateTo(""); return; }
    const [df, dt] = getDateRange(preset);
    setDateFrom(df); setDateTo(dt); setPage(1);
  }

  function clearFilters() {
    setFilterStatus(""); setFilterMethod(""); setFilterPlanId(""); setFilterOrgId("");
    setSearchInput(""); setDatePreset(""); setDateFrom(""); setDateTo(""); setPage(1);
    load(1, "", "", "", "", "", "", "");
  }

  async function openDetail(id: number) {
    setDetailLoading(true); setDetailPayment(null);
    try {
      const res = await api.get<{ data: PaymentDetailRecord }>(`/v1/super-admin/payments/${id}`);
      setDetailPayment(res.data);
    } finally { setDetailLoading(false); }
  }

  async function handleVerify() {
    if (!verifyTarget) return;
    setVerifyLoading(true);
    try {
      await api.post(`/v1/super-admin/payments/${verifyTarget.id}/verify`, {});
      setPayments(prev => prev.map(p => p.id === verifyTarget.id ? { ...p, status: "paid" as const } : p));
      setVerifyTarget(null);
    } finally { setVerifyLoading(false); }
  }

  async function handleRefund() {
    if (!refundTarget) return;
    setRefundLoading(true);
    try {
      await api.post(`/v1/super-admin/payments/${refundTarget.id}/refund`, { reason: refundReason || undefined });
      setPayments(prev => prev.map(p => p.id === refundTarget.id ? { ...p, status: "refunded" as const } : p));
      setRefundTarget(null); setRefundReason("");
    } finally { setRefundLoading(false); }
  }

  const hasFilters = !!(filterStatus || filterMethod || filterPlanId || filterOrgId || searchInput || dateFrom || dateTo);

  const DATE_PRESETS = [
    { key: "bugun",     label: uz.super_admin.date_bugun },
    { key: "kecha",     label: uz.super_admin.date_kecha },
    { key: "shu_hafta", label: uz.super_admin.date_shu_hafta },
    { key: "shu_oy",    label: uz.super_admin.date_shu_oy },
    { key: "otgan_oy",  label: uz.super_admin.date_otgan_oy },
    { key: "maxsus",    label: uz.super_admin.date_maxsus },
  ];

  const TILES = [
    {
      label: uz.super_admin.jami_tushum,
      value: summary ? formatMoney(summary.net_revenue) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "text-[#111827]",
    },
    {
      label: uz.super_admin.bugungi_tushum,
      value: summary ? formatMoney(summary.today_revenue) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9H20M4 12H3m15.07-7.07l-.71.71M6.64 17.36l-.7.7M17.36 17.36l.7.7M6.64 6.64l-.7-.7M12 7a5 5 0 100 10A5 5 0 0012 7z" />
        </svg>
      ),
      color: "text-[#1D4ED8]",
    },
    {
      label: uz.super_admin.shu_oy_tushum,
      value: summary ? formatMoney(summary.monthly_revenue) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: "text-[#166534]",
    },
    {
      label: uz.super_admin.jami_tolov_soni,
      value: summary ? String(summary.total_count) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: "text-[#374151]",
    },
    {
      label: uz.super_admin.to_langan_soni,
      value: summary ? String(summary.paid_count) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "text-[#166534]",
    },
    {
      label: uz.super_admin.kutilmoqda_soni,
      value: summary ? String(summary.pending_count) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "text-[#92400E]",
    },
    {
      label: uz.super_admin.muvaffaqiyatsiz_soni,
      value: summary ? String(summary.failed_count) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "text-[#991B1B]",
    },
    {
      label: uz.super_admin.qaytarilgan_soni,
      value: summary ? String(summary.refunded_count) : "—",
      icon: (
        <svg className="h-5 w-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      color: "text-[#374151]",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">{uz.super_admin.tolovlar}</h1>
        <p className="text-sm text-[#9CA3AF] mt-0.5">Barcha to&apos;lov tranzaksiyalari</p>
      </div>

      {/* 8 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TILES.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wide">{label}</p>
              <div className="h-8 w-8 rounded-lg bg-[#F9FAFB] flex items-center justify-center flex-shrink-0">{icon}</div>
            </div>
            <p className={`text-xl font-bold ${color} truncate`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 space-y-3">
        {/* Row 1: search + status + method */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Qidirish</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Bog'cha, invoice, tranzaksiya..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-all"
              />
            </div>
          </div>
          <div className="w-40">
            <Select label={uz.super_admin.filter_status} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              <option value="paid">{uz.super_admin.to_langan}</option>
              <option value="pending">{uz.super_admin.kutilmoqda_pay}</option>
              <option value="failed">{uz.super_admin.muvaffaqiyatsiz}</option>
              <option value="refunded">{uz.super_admin.qaytarilgan}</option>
            </Select>
          </div>
          <div className="w-40">
            <Select label={uz.super_admin.filter_usul} value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              <option value="manual">{uz.super_admin.manual_pay}</option>
              <option value="payme">{uz.super_admin.payme_pay}</option>
              <option value="click">{uz.super_admin.click_pay}</option>
              <option value="uzcard">{uz.super_admin.uzcard_pay}</option>
              <option value="humo">{uz.super_admin.humo_pay}</option>
              <option value="other">{uz.super_admin.other_pay}</option>
            </Select>
          </div>
          <div className="w-40">
            <Select label={uz.super_admin.filter_plan} value={filterPlanId} onChange={(e) => { setFilterPlanId(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              {plans.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </Select>
          </div>
          <div className="w-44">
            <Select label={uz.super_admin.filter_tashkilot} value={filterOrgId} onChange={(e) => { setFilterOrgId(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              {orgs.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
            </Select>
          </div>
        </div>

        {/* Row 2: date presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#9CA3AF] mr-1">{uz.super_admin.date_oraliq}:</span>
          {DATE_PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => applyPreset(datePreset === key ? "" : key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                datePreset === key
                  ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                  : "border-[#E5E7EB] text-[#6B7280] hover:border-[#7C3AED] hover:text-[#7C3AED]"
              }`}
            >
              {label}
            </button>
          ))}
          {datePreset === "maxsus" && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="py-1 px-2 text-sm rounded-lg border border-[#E5E7EB] outline-none focus:border-[#7C3AED] transition-colors"
              />
              <span className="text-[#9CA3AF] text-xs">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="py-1 px-2 text-sm rounded-lg border border-[#E5E7EB] outline-none focus:border-[#7C3AED] transition-colors"
              />
            </div>
          )}
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto px-3 py-1 text-xs text-[#6B7280] hover:text-[#374151] border border-[#E5E7EB] rounded-full hover:bg-[#F8FAFC] transition-colors">
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#F3F4F6]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-12 bg-[#F3F4F6] rounded" />
                <div className="h-4 w-32 bg-[#F3F4F6] rounded" />
                <div className="h-4 w-40 bg-[#F3F4F6] rounded" />
                <div className="h-4 w-28 bg-[#F3F4F6] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="h-10 w-10 text-[#D1D5DB] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-[#9CA3AF] text-sm">{uz.common.malumot_yoq}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide w-16">ID</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.sana}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Bog&apos;cha</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.invoice_raqam}</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.summa}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.tarif}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.tolov_usuli}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    <th className="px-4 py-3.5 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3.5 text-xs text-[#9CA3AF] font-mono">#{p.id}</td>
                      <td className="px-4 py-3.5 text-[#6B7280] whitespace-nowrap">
                        {fmtDate(p.paid_at ?? p.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.organization ? (
                          <Link href={`/admin/bogchalar/${p.organization.id}`}
                            className="font-medium text-[#111827] hover:text-[#7C3AED] transition-colors">
                            {p.organization.name}
                          </Link>
                        ) : <span className="text-[#9CA3AF]">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.invoice_number
                          ? <span className="font-mono text-xs text-[#6B7280]">{p.invoice_number}</span>
                          : <span className="text-[#D1D5DB]">—</span>}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#111827] whitespace-nowrap text-right">
                        {formatMoney(p.amount, p.currency)}
                      </td>
                      <td className="px-4 py-3.5 text-[#6B7280] whitespace-nowrap">{p.plan_name ?? "—"}</td>
                      <td className="px-4 py-3.5 text-[#6B7280] whitespace-nowrap">{payMethodLabel(p.payment_method)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={payStatusVariant(p.status)}>{payStatusLabel(p.status)}</Badge>
                      </td>
                      <td className="px-4 py-3.5 relative">
                        <button
                          aria-label="Amallar"
                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {openMenuId === p.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-[#E5E7EB] shadow-lg z-10 py-1" onClick={() => setOpenMenuId(null)}>
                            <button
                              className="w-full text-left px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                              onClick={() => openDetail(p.id)}
                            >
                              {uz.super_admin.batafsil}
                            </button>
                            {p.status === "pending" && (
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm text-[#059669] hover:bg-[#F0FDF4] transition-colors"
                                onClick={() => setVerifyTarget(p)}
                              >
                                {uz.super_admin.qayta_tekshirish}
                              </button>
                            )}
                            {p.status === "paid" && (
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                                onClick={() => setRefundTarget(p)}
                              >
                                {uz.super_admin.qaytarish}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F3F4F6]">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      {p.organization
                        ? <Link href={`/admin/bogchalar/${p.organization.id}`} className="font-medium text-[#111827] text-sm hover:text-[#7C3AED]">{p.organization.name}</Link>
                        : <span className="text-[#9CA3AF] text-sm">—</span>}
                      {p.invoice_number && <p className="font-mono text-xs text-[#9CA3AF]">{p.invoice_number}</p>}
                    </div>
                    <Badge variant={payStatusVariant(p.status)}>{payStatusLabel(p.status)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#111827]">{formatMoney(p.amount, p.currency)}</span>
                    <span className="text-[#9CA3AF]">{fmtDate(p.paid_at ?? p.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span>{p.plan_name ?? "—"} · {payMethodLabel(p.payment_method)}</span>
                    <Link href={`/admin/tolovlar/${p.id}`} className="text-[#7C3AED] font-medium">
                      Ko&apos;rish
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <Pagination meta={meta} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────── */}
      <Modal
        open={detailLoading || !!detailPayment}
        title={uz.super_admin.tolov_batafsil}
        onClose={() => setDetailPayment(null)}
      >
        {detailLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="flex gap-4 py-2.5 border-b border-[#F3F4F6]"><div className="h-4 w-28 bg-[#F3F4F6] rounded" /><div className="h-4 w-40 bg-[#F3F4F6] rounded" /></div>)}
          </div>
        ) : detailPayment ? (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              detailPayment.status === "paid"    ? "bg-[#F0FDF4] border border-[#BBF7D0]" :
              detailPayment.status === "pending" ? "bg-[#FFFBEB] border border-[#FDE68A]" :
              detailPayment.status === "failed"  ? "bg-[#FEF2F2] border border-[#FECACA]" :
                                                   "bg-[#F9FAFB] border border-[#E5E7EB]"
            }`}>
              <Badge variant={payStatusVariant(detailPayment.status)}>{payStatusLabel(detailPayment.status)}</Badge>
              <span className="text-lg font-bold text-[#111827]">{formatMoney(detailPayment.amount, detailPayment.currency)}</span>
              <span className="text-xs text-[#9CA3AF] ml-auto">#{detailPayment.id}</span>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              <Row label="To'lov usuli">{payMethodLabel(detailPayment.payment_method)}</Row>
              {detailPayment.transaction_id && (
                <Row label={uz.super_admin.tranzaksiya}>
                  <span className="font-mono text-xs">{detailPayment.transaction_id}</span>
                </Row>
              )}
              {detailPayment.invoice_number && (
                <Row label={uz.super_admin.invoice_raqam}>
                  <span className="font-mono text-xs">{detailPayment.invoice_number}</span>
                </Row>
              )}
              {detailPayment.organization && (
                <Row label="Bog'cha">{detailPayment.organization.name}</Row>
              )}
              {detailPayment.subscription?.plan && (
                <Row label={uz.super_admin.tarif}>{detailPayment.subscription.plan.name}</Row>
              )}
              <Row label="To'langan">{fmtDateTime(detailPayment.paid_at)}</Row>
              {detailPayment.notes && (
                <Row label="Eslatma">{detailPayment.notes}</Row>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link
                href={`/admin/tolovlar/${detailPayment.id}`}
                className="px-4 py-2 text-sm text-[#7C3AED] border border-[#7C3AED] rounded-lg hover:bg-[#F5F3FF] transition-colors"
                onClick={() => setDetailPayment(null)}
              >
                To&apos;liq sahifa
              </Link>
              <button
                onClick={() => setDetailPayment(null)}
                className="px-4 py-2 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F8FAFC] transition-colors"
              >
                {uz.common.yopish}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Verify Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!verifyTarget}
        title={uz.super_admin.tolov_tasdiqlash}
        onClose={() => setVerifyTarget(null)}
      >
        {verifyTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#374151]">
              <span className="font-semibold">#{verifyTarget.id}</span> raqamli to&apos;lovni tasdiqlashni xohlaysizmi?
            </p>
            <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3">
              <p className="text-sm text-[#166534]">
                Summa: <span className="font-bold">{formatMoney(verifyTarget.amount, verifyTarget.currency)}</span>
              </p>
              {verifyTarget.organization && (
                <p className="text-xs text-[#4ADE80] mt-0.5">{verifyTarget.organization.name}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setVerifyTarget(null)}
                disabled={verifyLoading}
                className="px-4 py-2 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
              >
                {uz.common.bekor_qilish}
              </button>
              <button
                onClick={handleVerify}
                disabled={verifyLoading}
                className="px-4 py-2 text-sm bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {verifyLoading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {uz.common.tasdiqlash}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Refund Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!refundTarget}
        title={uz.super_admin.tolov_qaytarish}
        onClose={() => { setRefundTarget(null); setRefundReason(""); }}
      >
        {refundTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#374151]">
              <span className="font-semibold">#{refundTarget.id}</span> raqamli to&apos;lovni qaytarishni xohlaysizmi?
            </p>
            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
              <p className="text-sm text-[#991B1B]">
                Summa: <span className="font-bold">{formatMoney(refundTarget.amount, refundTarget.currency)}</span>
              </p>
              {refundTarget.organization && (
                <p className="text-xs text-[#F87171] mt-0.5">{refundTarget.organization.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {uz.super_admin.refund_sababi} <span className="text-[#9CA3AF] font-normal">(ixtiyoriy)</span>
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                placeholder="Nima sababdan qaytarilmoqda?"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10 transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setRefundTarget(null); setRefundReason(""); }}
                disabled={refundLoading}
                className="px-4 py-2 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
              >
                {uz.common.bekor_qilish}
              </button>
              <button
                onClick={handleRefund}
                disabled={refundLoading}
                className="px-4 py-2 text-sm bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {refundLoading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {uz.super_admin.qaytarish}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Close dropdown on outside click */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
