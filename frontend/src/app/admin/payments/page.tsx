"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import uz, { intlLocale } from "@/i18n";
import type { PaginatedResponse, PaymentSummary } from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Payment type ───────────────────────────────────────────────────

interface Payment {
  id: number;
  organization: { id: number; name: string } | null;
  subscription_id: number | null;
  invoice_number: string | null;
  amount: string;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  payment_method: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  due_at: string | null;
  plan_name: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString(intlLocale())} ${currency}`;
}

function payStatusVariant(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid")     return "success";
  if (status === "pending")  return "warning";
  if (status === "failed")   return "error";
  return "neutral";
}

function payStatusLabel(status: string): string {
  return {
    paid:     uz.super_admin.to_langan,
    pending:  uz.super_admin.kutilmoqda_pay,
    failed:   uz.super_admin.muvaffaqiyatsiz,
    refunded: uz.super_admin.qaytarilgan,
  }[status] ?? status;
}

function payMethodLabel(method: string | null): string {
  if (!method) return "—";
  return {
    manual: uz.super_admin.manual_pay,
    payme:  uz.super_admin.payme_pay,
    click:  uz.super_admin.click_pay,
    uzcard: uz.super_admin.uzcard_pay,
    humo:   uz.super_admin.humo_pay,
    other:  uz.super_admin.other_pay,
  }[method] ?? method;
}

// ── Pagination ─────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────

export default function PaymentsPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary,  setSummary]  = useState<PaymentSummary | null>(null);
  const [meta,     setMeta]     = useState({ current_page: 1, last_page: 1, total: 0, per_page: 15 });
  const [loading,  setLoading]  = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [page,         setPage]         = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15", summary: "true" });
      if (filterStatus) params.set("status", filterStatus);
      if (filterMethod) params.set("payment_method", filterMethod);
      const res = await api.get<PaginatedResponse<Payment> & { summary?: PaymentSummary }>(
        `/v1/super-admin/payments?${params}`
      );
      setPayments(res.data);
      setMeta(res.meta);
      if (res.summary) setSummary(res.summary);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterMethod]);

  useEffect(() => { load(); }, [load]);

  const revenueTiles = [
    {
      label: uz.super_admin.jami_tushum,
      value: summary ? formatMoney(summary.total_revenue) : "—",
      color: "text-[var(--text)]",
      icon: (
        <svg className="h-5 w-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.shu_oy_tushum,
      value: summary ? formatMoney(summary.monthly_revenue) : "—",
      color: "text-[var(--success)]",
      icon: (
        <svg className="h-5 w-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.kutilayotgan_tushum,
      value: summary ? formatMoney(summary.pending_revenue) : "—",
      color: "text-[var(--warning-text)]",
      icon: (
        <svg className="h-5 w-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: uz.super_admin.muvaffaqiyatsiz_tolov,
      value: summary ? String(summary.failed_count) : "—",
      color: "text-[var(--error)]",
      icon: (
        <svg className="h-5 w-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.tolovlar}</h1>
        <p className="text-sm text-[var(--text-3)] mt-0.5">{uz.matn.barcha_tolov_tranzaksiyalari}</p>
      </div>

      {/* Revenue tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {revenueTiles.map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[var(--text-3)] uppercase tracking-wide">{label}</p>
              <div className="h-8 w-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

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
              <option value="paid">{uz.super_admin.to_langan}</option>
              <option value="pending">{uz.super_admin.kutilmoqda_pay}</option>
              <option value="failed">{uz.super_admin.muvaffaqiyatsiz}</option>
              <option value="refunded">{uz.super_admin.qaytarilgan}</option>
            </Select>
          </div>
          <div className="w-44">
            <Select
              label={uz.super_admin.filter_usul}
              value={filterMethod}
              onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
            >
              <option value="">{uz.common.hammasi}</option>
              <option value="manual">{uz.super_admin.manual_pay}</option>
              <option value="payme">{uz.super_admin.payme_pay}</option>
              <option value="click">{uz.super_admin.click_pay}</option>
              <option value="uzcard">{uz.super_admin.uzcard_pay}</option>
              <option value="humo">{uz.super_admin.humo_pay}</option>
              <option value="other">{uz.super_admin.other_pay}</option>
            </Select>
          </div>
          {(filterStatus || filterMethod) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterMethod(""); setPage(1); }}
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
                <div className="h-4 w-32 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-40 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-28 bg-[var(--border-2)] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="h-10 w-10 text-[var(--border-strong)] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-[var(--text-3)] text-sm">{uz.common.malumot_yoq}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.sana}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.matn.bogcha}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.invoice_raqam}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.summa}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.tarif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.tolov_usuli}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.holat}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-2)]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3.5 text-[var(--text-2)]">
                        {fmtDate(p.paid_at ?? p.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.organization ? (
                          <Link
                            href={`/admin/bogchalar/${p.organization.id}`}
                            className="font-medium text-[var(--text)] hover:text-[var(--primary)] transition-colors"
                          >
                            {p.organization.name}
                          </Link>
                        ) : (
                          <span className="text-[var(--text-3)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.invoice_number ? (
                          <span className="font-mono text-xs text-[var(--text-2)]">{p.invoice_number}</span>
                        ) : (
                          <span className="text-[var(--border-strong)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[var(--text)]">
                        {formatMoney(p.amount, p.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-2)]">{p.plan_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-[var(--text-2)]">{payMethodLabel(p.payment_method)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={payStatusVariant(p.status)}>{payStatusLabel(p.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[var(--border-2)]">
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      {p.organization ? (
                        <Link href={`/admin/bogchalar/${p.organization.id}`} className="font-medium text-[var(--text)] text-sm hover:text-[var(--primary)]">
                          {p.organization.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-3)] text-sm">—</span>
                      )}
                      {p.invoice_number && (
                        <p className="font-mono text-xs text-[var(--text-3)]">{p.invoice_number}</p>
                      )}
                    </div>
                    <Badge variant={payStatusVariant(p.status)}>{payStatusLabel(p.status)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[var(--text)]">{formatMoney(p.amount, p.currency)}</span>
                    <span className="text-[var(--text-3)]">{fmtDate(p.paid_at ?? p.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                    <span>{p.plan_name ?? "—"}</span>
                    <span>·</span>
                    <span>{payMethodLabel(p.payment_method)}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination meta={meta} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>
    </div>
  );
}
