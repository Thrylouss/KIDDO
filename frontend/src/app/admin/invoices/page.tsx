"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import uz, { intlLocale } from "@/i18n";
import type {
  PaginatedResponse, OrganizationSummary,
  InvoiceRecord, InvoiceDetailRecord, InvoiceSummary,
} from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString(intlLocale())} ${currency}`;
}

function invStatusVariant(s: string): "success" | "warning" | "error" | "neutral" {
  if (s === "paid")    return "success";
  if (s === "pending") return "warning";
  if (s === "overdue") return "error";
  return "neutral";
}

function invStatusLabel(s: string): string {
  return ({
    draft:     uz.super_admin.invoice_draft,
    pending:   uz.super_admin.invoice_pending_status,
    paid:      uz.super_admin.invoice_paid_status,
    overdue:   uz.super_admin.invoice_overdue,
    cancelled: uz.super_admin.invoice_cancelled_status,
  } as Record<string, string>)[s] ?? s;
}

// ── Pagination ─────────────────────────────────────────────────────

function Pagination({
  meta, onPage,
}: { meta: { current_page: number; last_page: number; total: number }; onPage: (p: number) => void }) {
  if (meta.last_page <= 1) return null;
  const pages = Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border)]">
      <p className="text-sm text-[var(--text-2)]">{uz.matn.jami} {meta.total} {uz.matn.ta}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--label)] disabled:opacity-40 hover:bg-[var(--hover)] transition-colors"
        >{uz.matn.oldingi}</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              p === meta.current_page
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"
            }`}
          >{p}</button>
        ))}
        <button
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page === meta.last_page}
          className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--label)] disabled:opacity-40 hover:bg-[var(--hover)] transition-colors"
        >{uz.matn.keyingi}</button>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--label)] hover:bg-[var(--border-2)] transition-colors">
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
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--border-2)] last:border-0">
      <span className="w-36 flex-shrink-0 text-sm text-[var(--text-2)]">{label}</span>
      <span className="flex-1 text-sm font-medium text-[var(--text)]">{children}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function InvoicesPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [invoices,       setInvoices]       = useState<InvoiceRecord[]>([]);
  const [summary,        setSummary]        = useState<InvoiceSummary | null>(null);
  const [meta,           setMeta]           = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [loading,        setLoading]        = useState(true);
  const [orgs,           setOrgs]           = useState<OrganizationSummary[]>([]);

  const [searchInput,    setSearchInput]    = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterOrgId,    setFilterOrgId]    = useState("");
  const [page,           setPage]           = useState(1);

  const [detailInvoice,  setDetailInvoice]  = useState<InvoiceDetailRecord | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<InvoiceRecord | null>(null);
  const [markPaidLoading,setMarkPaidLoading]= useState(false);
  const [cancelTarget,   setCancelTarget]   = useState<InvoiceRecord | null>(null);
  const [cancelReason,   setCancelReason]   = useState("");
  const [cancelLoading,  setCancelLoading]  = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [createLoading,  setCreateLoading]  = useState(false);
  const [createForm,     setCreateForm]     = useState({
    organization_id: "", amount: "", status: "pending", due_at: "", notes: "",
  });
  const [openMenuId,     setOpenMenuId]     = useState<number | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    api.get<PaginatedResponse<OrganizationSummary>>("/v1/super-admin/organizations?per_page=100")
      .then((o) => setOrgs(o.data))
      .catch(() => {});
  }, []);

  const load = useCallback(async (
    p: number, search: string, status: string, orgId: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: "20", summary: "true" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (orgId)  params.set("organization_id", orgId);
      const res = await api.get<PaginatedResponse<InvoiceRecord> & { summary?: InvoiceSummary }>(
        `/v1/super-admin/invoices?${params}`,
      );
      setInvoices(res.data);
      setMeta(res.meta);
      if (res.summary) setSummary(res.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load(page, searchInput, filterStatus, filterOrgId);
  }, [load, page, filterStatus, filterOrgId]);

  function handleSearch(value: string) {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1, value, filterStatus, filterOrgId);
    }, 350);
  }

  function clearFilters() {
    setFilterStatus(""); setFilterOrgId(""); setSearchInput(""); setPage(1);
    load(1, "", "", "");
  }

  async function openDetail(id: number) {
    setDetailLoading(true); setDetailInvoice(null);
    try {
      const res = await api.get<{ data: InvoiceDetailRecord }>(`/v1/super-admin/invoices/${id}`);
      setDetailInvoice(res.data);
    } finally { setDetailLoading(false); }
  }

  async function handleMarkPaid() {
    if (!markPaidTarget) return;
    setMarkPaidLoading(true);
    try {
      await api.patch(`/v1/super-admin/invoices/${markPaidTarget.id}/mark-paid`, {});
      setInvoices(prev => prev.map(inv =>
        inv.id === markPaidTarget.id ? { ...inv, status: "paid" as const, paid_at: new Date().toISOString() } : inv,
      ));
      setMarkPaidTarget(null);
      load(page, searchInput, filterStatus, filterOrgId);
    } finally { setMarkPaidLoading(false); }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await api.patch(`/v1/super-admin/invoices/${cancelTarget.id}/cancel`, {
        reason: cancelReason || undefined,
      });
      setInvoices(prev => prev.map(inv =>
        inv.id === cancelTarget.id ? { ...inv, status: "cancelled" as const } : inv,
      ));
      setCancelTarget(null); setCancelReason("");
      load(page, searchInput, filterStatus, filterOrgId);
    } finally { setCancelLoading(false); }
  }

  async function handleCreate() {
    setCreateLoading(true);
    try {
      await api.post("/v1/super-admin/invoices", {
        organization_id: Number(createForm.organization_id),
        amount: Number(createForm.amount),
        status: createForm.status,
        due_at: createForm.due_at || undefined,
        notes: createForm.notes || undefined,
      });
      setCreateOpen(false);
      setCreateForm({ organization_id: "", amount: "", status: "pending", due_at: "", notes: "" });
      load(page, searchInput, filterStatus, filterOrgId);
    } finally { setCreateLoading(false); }
  }

  const hasFilters = !!(filterStatus || filterOrgId || searchInput);

  const TILES = [
    {
      label: uz.super_admin.invoice_jami,
      value: summary ? String(summary.total) : "—",
      color: "text-[var(--text)]",
      icon: (
        <svg className="h-5 w-5 text-[var(--text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.invoice_pending_soni,
      value: summary ? String(summary.pending) : "—",
      color: "text-[var(--warning-text)]",
      icon: (
        <svg className="h-5 w-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.invoice_paid_soni,
      value: summary ? String(summary.paid) : "—",
      color: "text-[var(--success)]",
      icon: (
        <svg className="h-5 w-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.invoice_overdue_soni,
      value: summary ? String(summary.overdue) : "—",
      color: "text-[var(--error)]",
      icon: (
        <svg className="h-5 w-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.invoice_pending_amount,
      value: summary ? formatMoney(summary.total_pending_amount) : "—",
      color: "text-[var(--warning-text)]",
      icon: (
        <svg className="h-5 w-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.invoice_paid_amount,
      value: summary ? formatMoney(summary.total_paid_amount) : "—",
      color: "text-[var(--success)]",
      icon: (
        <svg className="h-5 w-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.invoices}</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{uz.matn.barcha_hisob_fakturalar}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-h)] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {uz.super_admin.invoice_qoshish}
        </button>
      </div>

      {IS_DEMO && (
        <div data-testid="demo-banner" className="flex items-center gap-2.5 rounded-xl bg-[var(--primary-lt)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--primary-h)]">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {uz.matn.demo_rejimi_malumotlar_saqlanmaydi_amall}
        </div>
      )}

      {/* 6 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[var(--text-3)] uppercase tracking-wide">{label}</p>
              <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">{icon}</div>
            </div>
            <p className={`text-xl font-bold ${color} truncate`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{uz.matn.qidirish}</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={uz.matn.invoice_raqami_yoki_bogcha}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>
          </div>
          <div className="w-44">
            <Select label={uz.super_admin.filter_status} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              <option value="draft">{uz.super_admin.invoice_draft}</option>
              <option value="pending">{uz.super_admin.invoice_pending_status}</option>
              <option value="paid">{uz.super_admin.invoice_paid_status}</option>
              <option value="overdue">{uz.super_admin.invoice_overdue}</option>
              <option value="cancelled">{uz.super_admin.invoice_cancelled_status}</option>
            </Select>
          </div>
          <div className="w-44">
            <Select label={uz.super_admin.filter_tashkilot} value={filterOrgId} onChange={(e) => { setFilterOrgId(e.target.value); setPage(1); }}>
              <option value="">{uz.common.hammasi}</option>
              {orgs.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors">
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
                <div className="h-4 w-28 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-32 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-40 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-28 bg-[var(--border-2)] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="h-10 w-10 text-[var(--border-strong)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[var(--text-3)] text-sm">{uz.common.malumot_yoq}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.invoice_raqam}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.sana}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.matn.bogcha}</th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.summa}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.invoice_muddati}</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    <th className="px-4 py-3.5 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-2)]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-[var(--text-2)]">{inv.invoice_number}</span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-2)] whitespace-nowrap">
                        {fmtDate(inv.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        {inv.organization ? (
                          <Link href={`/admin/bogchalar/${inv.organization.id}`}
                            className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors">
                            {inv.organization.name}
                          </Link>
                        ) : <span className="text-[var(--text-3)]">—</span>}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[var(--text)] whitespace-nowrap text-right">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-2)] whitespace-nowrap">
                        {fmtDate(inv.due_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={invStatusVariant(inv.status)}>{invStatusLabel(inv.status)}</Badge>
                      </td>
                      <td className="px-4 py-3.5 relative">
                        <button
                          aria-label={uz.matn.amallar}
                          onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                          className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--label)] hover:bg-[var(--border-2)] transition-colors"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {openMenuId === inv.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-[var(--border)] shadow-lg z-10 py-1" onClick={() => setOpenMenuId(null)}>
                            <button
                              className="w-full text-left px-4 py-2.5 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors"
                              onClick={() => openDetail(inv.id)}
                            >
                              {uz.super_admin.batafsil}
                            </button>
                            {(inv.status === "pending" || inv.status === "overdue" || inv.status === "draft") && (
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm text-[#059669] hover:bg-[var(--success-soft)] transition-colors"
                                onClick={() => setMarkPaidTarget(inv)}
                              >
                                {uz.super_admin.invoice_tolash}
                              </button>
                            )}
                            {inv.status !== "paid" && inv.status !== "cancelled" && (
                              <button
                                className="w-full text-left px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[var(--error-soft)] transition-colors"
                                onClick={() => setCancelTarget(inv)}
                              >
                                {uz.common.bekor_qilish}
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
            <div className="md:hidden divide-y divide-[var(--border-2)]">
              {invoices.map((inv) => (
                <div key={inv.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-[var(--text-2)]">{inv.invoice_number}</span>
                      {inv.organization && (
                        <p className="font-medium text-[var(--text)] text-sm mt-0.5">
                          {inv.organization.name}
                        </p>
                      )}
                    </div>
                    <Badge variant={invStatusVariant(inv.status)}>{invStatusLabel(inv.status)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[var(--text)]">{formatMoney(inv.amount, inv.currency)}</span>
                    <span className="text-[var(--text-3)] text-xs">{fmtDate(inv.due_at)}</span>
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
        open={detailLoading || !!detailInvoice}
        title={uz.super_admin.invoice_batafsil}
        onClose={() => setDetailInvoice(null)}
      >
        {detailLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 py-2.5 border-b border-[var(--border-2)]">
                <div className="h-4 w-28 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-40 bg-[var(--border-2)] rounded" />
              </div>
            ))}
          </div>
        ) : detailInvoice ? (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              detailInvoice.status === "paid"    ? "bg-[var(--success-soft)] border border-[var(--success-border)]" :
              detailInvoice.status === "pending" ? "bg-[var(--warning-soft)] border border-[var(--warning-border)]" :
              detailInvoice.status === "overdue" ? "bg-[var(--error-soft)] border border-[var(--error-border)]" :
                                                   "bg-[var(--surface-2)] border border-[var(--border)]"
            }`}>
              <Badge variant={invStatusVariant(detailInvoice.status)}>{invStatusLabel(detailInvoice.status)}</Badge>
              <span className="text-lg font-bold text-[var(--text)]">{formatMoney(detailInvoice.amount, detailInvoice.currency)}</span>
              <span className="font-mono text-xs text-[var(--text-3)] ml-auto">{detailInvoice.invoice_number}</span>
            </div>
            <div className="divide-y divide-[var(--border-2)]">
              {detailInvoice.organization && (
                <Row label={uz.matn.bogcha}>{detailInvoice.organization.name}</Row>
              )}
              <Row label={uz.super_admin.invoice_muddati}>{fmtDate(detailInvoice.due_at)}</Row>
              {detailInvoice.paid_at && (
                <Row label={uz.matn.tolangan_sana}>{fmtDateTime(detailInvoice.paid_at)}</Row>
              )}
              <Row label={uz.super_admin.sana}>{fmtDate(detailInvoice.created_at)}</Row>
              {detailInvoice.notes && (
                <Row label={uz.super_admin.eslatma}>{detailInvoice.notes}</Row>
              )}
              {detailInvoice.payments && detailInvoice.payments.length > 0 && (
                <div className="py-2.5">
                  <p className="text-sm text-[var(--text-2)] mb-2">{uz.matn.tolovlar}{detailInvoice.payments.length})</p>
                  <div className="space-y-1.5">
                    {detailInvoice.payments.map((pay) => (
                      <div key={pay.id} className="flex items-center justify-between text-xs bg-[var(--surface-2)] rounded-lg px-3 py-2">
                        <span className="text-[var(--label)] font-medium">{formatMoney(pay.amount, pay.currency)}</span>
                        <Badge variant={pay.status === "paid" ? "success" : pay.status === "pending" ? "warning" : "error"}>
                          {pay.status}
                        </Badge>
                        <span className="text-[var(--text-3)]">{fmtDate(pay.paid_at ?? pay.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDetailInvoice(null)}
                className="px-4 py-2 text-sm text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors"
              >
                {uz.common.yopish}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── Mark Paid Modal ───────────────────────────────────────── */}
      <Modal
        open={!!markPaidTarget}
        title={uz.super_admin.invoice_tolash_modal}
        onClose={() => setMarkPaidTarget(null)}
      >
        {markPaidTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--label)]">
              <span className="font-mono font-semibold">{markPaidTarget.invoice_number}</span> {uz.matn.raqamli_hisob_fakturani_tolangan_deb}
            </p>
            <div className="rounded-xl bg-[var(--success-soft)] border border-[var(--success-border)] px-4 py-3">
              <p className="text-sm text-[var(--success)]">
                {uz.matn.summa} <span className="font-bold">{formatMoney(markPaidTarget.amount, markPaidTarget.currency)}</span>
              </p>
              {markPaidTarget.organization && (
                <p className="text-xs text-[#4ADE80] mt-0.5">{markPaidTarget.organization.name}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setMarkPaidTarget(null)}
                disabled={markPaidLoading}
                className="px-4 py-2 text-sm text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
              >
                {uz.common.bekor_qilish}
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={markPaidLoading}
                className="px-4 py-2 text-sm bg-[#059669] text-white rounded-lg hover:bg-[var(--success)] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {markPaidLoading && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {uz.super_admin.invoice_tolash}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Cancel Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!cancelTarget}
        title={uz.super_admin.invoice_bekor_modal}
        onClose={() => { setCancelTarget(null); setCancelReason(""); }}
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--label)]">
              <span className="font-mono font-semibold">{cancelTarget.invoice_number}</span> {uz.matn.raqamli_hisob_fakturani_bekor_qilmoqchim}
            </p>
            <div className="rounded-xl bg-[var(--error-soft)] border border-[var(--error-border)] px-4 py-3">
              <p className="text-sm text-[var(--error)]">
                {uz.matn.summa} <span className="font-bold">{formatMoney(cancelTarget.amount, cancelTarget.currency)}</span>
              </p>
              {cancelTarget.organization && (
                <p className="text-xs text-[#F87171] mt-0.5">{cancelTarget.organization.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                {uz.super_admin.invoice_bekor_sababi} <span className="text-[var(--text-3)] font-normal">{uz.matn.ixtiyoriy}</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder={uz.matn.nima_sababdan_bekor_qilinmoqda}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                disabled={cancelLoading}
                className="px-4 py-2 text-sm text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
              >
                {uz.common.bekor_qilish}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="px-4 py-2 text-sm bg-[#DC2626] text-white rounded-lg hover:bg-[var(--error-text)] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {cancelLoading && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {uz.common.bekor_qilish}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Modal ──────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        title={uz.super_admin.invoice_qoshish}
        onClose={() => { setCreateOpen(false); setCreateForm({ organization_id: "", amount: "", status: "pending", due_at: "", notes: "" }); }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
              {uz.matn.bogcha} <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={createForm.organization_id}
              onChange={(e) => setCreateForm(f => ({ ...f, organization_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            >
              <option value="">{uz.common.tanlang}</option>
              {orgs.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
              {uz.super_admin.summa} (UZS) <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="number"
              value={createForm.amount}
              onChange={(e) => setCreateForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              min="0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{uz.super_admin.holat}</label>
            <select
              value={createForm.status}
              onChange={(e) => setCreateForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            >
              <option value="pending">{uz.super_admin.invoice_pending_status}</option>
              <option value="draft">{uz.super_admin.invoice_draft}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{uz.super_admin.invoice_muddati}</label>
            <input
              type="date"
              value={createForm.due_at}
              onChange={(e) => setCreateForm(f => ({ ...f, due_at: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{uz.super_admin.eslatma}</label>
            <textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={uz.matn.qoshimcha_izoh}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setCreateOpen(false); setCreateForm({ organization_id: "", amount: "", status: "pending", due_at: "", notes: "" }); }}
              disabled={createLoading}
              className="px-4 py-2 text-sm text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
            >
              {uz.common.bekor_qilish}
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !createForm.organization_id || !createForm.amount}
              className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-h)] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {createLoading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {uz.common.saqlash}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close dropdown on outside click */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
