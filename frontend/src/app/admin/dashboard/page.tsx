"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type {
  DashboardSummaryEnhanced,
  DashboardRecent,
  ReportRevenue,
  ReportSubscriptions,
} from "@/types";

// ── Utility ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "UZS"): string {
  return `${Number(n).toLocaleString("uz-UZ")} ${currency}`;
}

function fmtStr(s: string, currency = "UZS"): string {
  return fmt(parseFloat(s), currency);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ── Date presets ─────────────────────────────────────────────────────────────

type Preset = { label: string; key: string };
const PRESETS: Preset[] = [
  { label: uz.super_admin.date_shu_hafta, key: "week" },
  { label: uz.super_admin.date_shu_oy,   key: "month" },
  { label: uz.super_admin.date_otgan_oy, key: "last_month" },
  { label: uz.super_admin.shu_yil,       key: "year" },
  { label: uz.super_admin.date_maxsus,   key: "custom" },
];

function getPresetRange(key: string): { from: string; to: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt2 = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (key === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: fmt2(mon), to: fmt2(today) };
  }
  if (key === "month") {
    return {
      from: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`,
      to: fmt2(today),
    };
  }
  if (key === "last_month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last  = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: fmt2(first), to: fmt2(last) };
  }
  if (key === "year") {
    return { from: `${today.getFullYear()}-01-01`, to: fmt2(today) };
  }
  return { from: fmt2(today), to: fmt2(today) };
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#F3F4F6] rounded-lg ${className ?? ""}`} />;
}

// ── Error block ───────────────────────────────────────────────────────────────

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <p className="text-sm text-[#6B7280]">{uz.common.yuklash_xatosi}</p>
      <button
        onClick={onRetry}
        className="text-sm text-[#7C3AED] hover:underline font-medium"
      >
        {uz.common.qayta_urinish}
      </button>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  trend,
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label: string };
  accent?: "green" | "blue" | "yellow" | "red" | "purple";
}) {
  const accentMap = {
    green:  "bg-[#DCFCE7] text-[#166534]",
    blue:   "bg-[#DBEAFE] text-[#1E40AF]",
    yellow: "bg-[#FEF9C3] text-[#854D0E]",
    red:    "bg-[#FEE2E2] text-[#991B1B]",
    purple: "bg-[#F5F3FF] text-[#6D28D9]",
  };
  const dot = accentMap[accent ?? "purple"];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex flex-col gap-2">
      <p className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-[#111827] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#6B7280]">{sub}</p>}
      {trend && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
            trend.value >= 0 ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"
          }`}
        >
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}% {trend.label}
        </span>
      )}
      {!trend && accent && <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />}
    </div>
  );
}

// ── Bar chart (SVG) ───────────────────────────────────────────────────────────

function BarChart({ series }: { series: { label: string; total: number }[] }) {
  const max = Math.max(...series.map((s) => s.total), 1);
  return (
    <svg viewBox={`0 0 ${series.length * 14} 60`} className="w-full h-24" preserveAspectRatio="none">
      {series.map((item, i) => {
        const h = Math.max((item.total / max) * 52, item.total > 0 ? 2 : 0);
        return (
          <rect
            key={i}
            x={i * 14 + 1}
            y={60 - h - 4}
            width={12}
            height={h}
            rx={2}
            fill="#7C3AED"
            opacity={0.8}
          >
            <title>{`${item.label}: ${fmt(item.total)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// ── Distribution bar ──────────────────────────────────────────────────────────

function DistBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-[#9CA3AF]">—</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {items.map((item) => (
          <div
            key={item.label}
            style={{ width: `${(item.count / total) * 100}%` }}
            className={item.color}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
            <span className="text-xs text-[#6B7280] truncate">
              {item.label} <span className="font-semibold text-[#374151]">{item.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payment / invoice status badge ───────────────────────────────────────────

function PayStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "error" | "neutral" | "info" }> = {
    paid:      { label: uz.super_admin.to_langan,        variant: "success" },
    pending:   { label: uz.super_admin.kutilmoqda_pay,   variant: "warning" },
    failed:    { label: uz.super_admin.muvaffaqiyatsiz,  variant: "error" },
    refunded:  { label: uz.super_admin.qaytarilgan,      variant: "neutral" },
    draft:     { label: uz.super_admin.invoice_draft,    variant: "neutral" },
    overdue:   { label: uz.super_admin.invoice_overdue,  variant: "error" },
    cancelled: { label: uz.super_admin.bekor,            variant: "neutral" },
  };
  const info = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "error" | "neutral" | "info" }> = {
    active:    { label: uz.super_admin.faol,            variant: "success" },
    trial:     { label: uz.super_admin.sinov,           variant: "info" },
    past_due:  { label: uz.super_admin.past_due,        variant: "warning" },
    expired:   { label: uz.super_admin.muddati_tugagan, variant: "error" },
    cancelled: { label: uz.super_admin.bekor,           variant: "neutral" },
  };
  const info = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ── Sections ──────────────────────────────────────────────────────────────────

function KpiSection({
  dateFrom, dateTo,
}: { dateFrom: string; dateTo: string }) {
  const [data, setData] = useState<DashboardSummaryEnhanced | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<DashboardSummaryEnhanced>(
        `/v1/super-admin/dashboard?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB]">
        <ErrorBlock onRetry={load} />
      </div>
    );
  }

  if (!data) return null;

  const trendVal =
    data.billing.prev_period_paid > 0
      ? ((data.billing.period_paid - data.billing.prev_period_paid) /
          data.billing.prev_period_paid) *
        100
      : null;

  return (
    <div className="space-y-4">
      {/* Row 1: org + sub KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title={uz.super_admin.jami_bogchalar}
          value={data.jami_bogchalar}
          sub={`${data.nofaol_bogchalar} nofaol`}
          accent="purple"
        />
        <KpiCard
          title={uz.super_admin.faol_bogchalar}
          value={data.faol_bogchalar}
          accent="green"
        />
        <KpiCard
          title={uz.super_admin.faol_obunalar}
          value={data.obuna_holati.active}
          sub={`${data.obuna_holati.trial} ${uz.super_admin.sinov}`}
          accent="blue"
        />
        <KpiCard
          title={uz.super_admin.muddati_yaqin}
          value={data.muddati_yaqin}
          sub="14 kun ichida"
          accent="yellow"
        />
      </div>

      {/* Row 2: revenue + users KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title={uz.super_admin.jami_foydalanuvchilar_kpi}
          value={data.jami_foydalanuvchilar}
          accent="purple"
        />
        <KpiCard
          title={uz.super_admin.yangi_bogchalar_davr}
          value={data.yangi_bogchalar}
          accent="green"
        />
        <KpiCard
          title={uz.super_admin.davr_tushum_kpi}
          value={fmt(data.billing.period_paid)}
          trend={
            trendVal !== null
              ? {
                  value: trendVal,
                  label: uz.super_admin.oldingi_davr,
                }
              : undefined
          }
          accent="blue"
        />
        <KpiCard
          title={uz.super_admin.mrr}
          value={fmt(data.billing.mrr)}
          sub={`ARR: ${fmt(data.billing.arr)}`}
          accent="purple"
        />
      </div>

      {/* Subscription status distribution */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <h2 className="text-sm font-semibold text-[#111827] mb-4">{uz.super_admin.obuna_holati}</h2>
        <DistBar
          items={[
            { label: uz.super_admin.faol,            count: data.obuna_holati.active,    color: "bg-green-400" },
            { label: uz.super_admin.sinov,            count: data.obuna_holati.trial,     color: "bg-blue-400" },
            { label: uz.super_admin.past_due,         count: data.obuna_holati.past_due,  color: "bg-yellow-400" },
            { label: uz.super_admin.muddati_tugagan,  count: data.obuna_holati.expired,   color: "bg-red-400" },
            { label: uz.super_admin.bekor,            count: data.obuna_holati.cancelled, color: "bg-gray-300" },
          ]}
        />
      </div>

      {/* Billing summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: uz.super_admin.gross_tushum,      value: fmt(data.billing.total_paid) },
          { label: uz.super_admin.net_tushum,        value: fmt(data.billing.total_paid - data.billing.total_refunded) },
          { label: uz.super_admin.kutilayotgan_tushum, value: fmt(data.billing.pending_revenue) },
          { label: uz.super_admin.qaytarilgan_summa, value: fmt(data.billing.total_refunded) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
            <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-bold text-[#111827]">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent orgs table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.oxirgi_bogchalar}</h2>
          <Link href="/admin/bogchalar" className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium">
            {uz.super_admin.barchasini_korish}
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {data.oxirgi_bogchalar.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">
              {uz.common.malumot_yoq}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                    {uz.super_admin.bogchalar}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">
                    {uz.super_admin.obuna}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden md:table-cell">
                    {uz.super_admin.tarif}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {data.oxirgi_bogchalar.map((org) => (
                  <tr key={org.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] font-semibold text-xs flex-shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[#111827] text-sm">{org.name}</p>
                          <p className="text-xs text-[#9CA3AF]">{org.phone ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {org.subscription ? (
                        <SubStatusBadge status={org.subscription.status} />
                      ) : (
                        <span className="text-[#D1D5DB] text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[#6B7280]">
                      {org.subscription?.plan ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/bogchalar/${org.id}`}
                        className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium"
                      >
                        {uz.super_admin.batafsil}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueTrendSection({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [data, setData] = useState<ReportRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ReportRevenue>(
        `/v1/super-admin/reports/revenue?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.daromad_dinamikasi}</h2>
        {data && (
          <span className="text-xs text-[#6B7280]">
            {uz.super_admin.jami}: <strong>{fmt(data.total)}</strong>
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-28" />
      ) : error ? (
        <ErrorBlock onRetry={load} />
      ) : !data || data.series.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] text-center py-6">{uz.super_admin.hech_daromad_yoq}</p>
      ) : (
        <div className="space-y-4">
          <BarChart series={data.series.map((s) => ({ label: s.label, total: s.total }))} />
          {data.by_plan.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                {uz.super_admin.tarif_boyicha}
              </p>
              {data.by_plan.map((p) => (
                <div key={p.plan_name} className="flex justify-between text-sm">
                  <span className="text-[#374151]">{p.plan_name}</span>
                  <span className="font-medium text-[#111827]">{fmt(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubsDistSection({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [data, setData] = useState<ReportSubscriptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ReportSubscriptions>(
        `/v1/super-admin/reports/subscriptions?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <h2 className="text-sm font-semibold text-[#111827] mb-4">{uz.super_admin.tarif_taqsimoti}</h2>
      {loading ? (
        <Skeleton className="h-28" />
      ) : error ? (
        <ErrorBlock onRetry={load} />
      ) : !data ? null : (
        <div className="space-y-4">
          <DistBar
            items={[
              { label: uz.super_admin.faol,           count: data.status_distribution.active,    color: "bg-green-400" },
              { label: uz.super_admin.sinov,           count: data.status_distribution.trial,     color: "bg-blue-400" },
              { label: uz.super_admin.past_due,        count: data.status_distribution.past_due,  color: "bg-yellow-400" },
              { label: uz.super_admin.muddati_tugagan, count: data.status_distribution.expired,   color: "bg-red-400" },
              { label: uz.super_admin.bekor,           count: data.status_distribution.cancelled, color: "bg-gray-300" },
            ]}
          />
          {data.plan_distribution.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#F3F4F6]">
              {data.plan_distribution.map((p) => (
                <div key={p.plan_id} className="flex justify-between text-sm">
                  <span className="text-[#374151]">{p.plan_name}</span>
                  <span className="font-medium text-[#111827]">{p.count}</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#F3F4F6]">
            <div>
              <p className="text-xs text-[#9CA3AF]">{uz.super_admin.yangi_obunalar}</p>
              <p className="font-semibold text-[#111827]">{data.new_in_period}</p>
            </div>
            <div>
              <p className="text-xs text-[#9CA3AF]">{uz.super_admin.yaqin_tugaydi}</p>
              <p className="font-semibold text-[#111827]">{data.expiring_soon}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecentSection() {
  const [data, setData] = useState<DashboardRecent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<DashboardRecent>("/v1/super-admin/dashboard/recent");
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB]">
        <ErrorBlock onRetry={load} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Payments + Invoices */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.oxirgi_tolovlar}</h2>
            <Link href="/admin/tolovlar" className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium">
              {uz.super_admin.barchasini_korish}
            </Link>
          </div>
          {data.payments.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">{uz.super_admin.hech_tolov_yoq}</p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111827] truncate">
                      {p.organization?.name ?? "—"}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">{fmtTime(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-semibold text-[#111827]">
                      {fmtStr(p.amount, p.currency)}
                    </span>
                    <PayStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.oxirgi_invoicelar}</h2>
            <Link href="/admin/invoicelar" className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium">
              {uz.super_admin.barchasini_korish}
            </Link>
          </div>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">{uz.super_admin.hech_invoice_yoq}</p>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {data.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111827] truncate">
                      {inv.organization?.name ?? "—"}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">{inv.invoice_number}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-sm font-semibold text-[#111827]">
                      {fmtStr(inv.amount, inv.currency)}
                    </span>
                    <PayStatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-semibold text-[#111827]">{uz.super_admin.oxirgi_faoliyat_logi}</h2>
          <Link href="/admin/faoliyat" className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium">
            {uz.super_admin.barchasini_korish}
          </Link>
        </div>
        {data.activity.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">{uz.super_admin.faollik_yoq}</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {data.activity.map((log) => (
              <div key={log.id} className="flex items-start justify-between px-5 py-3 gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-[#F5F3FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[#7C3AED] text-xs font-bold">
                      {(log.user?.name ?? log.organization?.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#111827] truncate">{log.description}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {log.user?.name ?? "—"}
                      {log.organization && ` · ${log.organization.name}`}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#9CA3AF] flex-shrink-0">{fmtTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: uz.super_admin.bogchalarni_boshqarish,       href: "/admin/bogchalar",   icon: "🏫" },
    { label: uz.super_admin.obunalarni_boshqarish,        href: "/admin/obunalar",    icon: "📋" },
    { label: uz.super_admin.tolovlarni_boshqarish,        href: "/admin/tolovlar",    icon: "💳" },
    { label: uz.super_admin.invoicelarni_boshqarish,      href: "/admin/invoicelar",  icon: "🧾" },
    { label: uz.super_admin.foydalanuvchilarni_boshqarish, href: "/admin/foydalanuvchilar", icon: "👤" },
    { label: uz.super_admin.hisobotlarni_korish,          href: "/admin/hisobotlar",  icon: "📊" },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <h2 className="text-sm font-semibold text-[#111827] mb-4">{uz.super_admin.tez_amallar}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#E5E7EB] hover:border-[#7C3AED] hover:bg-[#F5F3FF] transition-colors group"
          >
            <span className="text-base">{a.icon}</span>
            <span className="text-sm text-[#374151] group-hover:text-[#7C3AED] font-medium">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Date filter bar ───────────────────────────────────────────────────────────

function DateFilterBar({
  activePreset,
  dateFrom,
  dateTo,
  customFrom,
  customTo,
  onPresetSelect,
  onCustomFromChange,
  onCustomToChange,
  onApply,
}: {
  activePreset: string;
  dateFrom: string;
  dateTo: string;
  customFrom: string;
  customTo: string;
  onPresetSelect: (key: string) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mr-1">
          {uz.super_admin.davr_tanlash}
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPresetSelect(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePreset === p.key
                ? "bg-[#7C3AED] text-white"
                : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E9D5FF]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {activePreset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
            />
            <span className="text-[#9CA3AF] text-xs">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
            />
            <button
              onClick={onApply}
              className="px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-xs font-medium hover:bg-[#6D28D9] transition-colors"
            >
              {uz.super_admin.filtrlash_btn}
            </button>
          </div>
        )}
        {activePreset !== "custom" && (
          <span className="text-xs text-[#9CA3AF] ml-auto">
            {fmtDate(dateFrom)} — {fmtDate(dateTo)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  const defaultRange = getPresetRange("month");
  const [activePreset, setActivePreset] = useState("month");
  const [dateFrom, setDateFrom]         = useState(defaultRange.from);
  const [dateTo, setDateTo]             = useState(defaultRange.to);
  const [customFrom, setCustomFrom]     = useState(defaultRange.from);
  const [customTo, setCustomTo]         = useState(defaultRange.to);

  function handlePresetSelect(key: string) {
    setActivePreset(key);
    if (key !== "custom") {
      const range = getPresetRange(key);
      setDateFrom(range.from);
      setDateTo(range.to);
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
  }

  function handleApplyCustom() {
    if (customFrom && customTo) {
      setDateFrom(customFrom);
      setDateTo(customTo);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">
          {uz.super_admin.sarlavha}
        </h1>
        <p className="text-[#9CA3AF] mt-1 text-sm">{uz.super_admin.platforma_holati}</p>
      </div>

      {/* Date filter */}
      <DateFilterBar
        activePreset={activePreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        customFrom={customFrom}
        customTo={customTo}
        onPresetSelect={handlePresetSelect}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onApply={handleApplyCustom}
      />

      {/* KPIs + recent orgs */}
      <KpiSection dateFrom={dateFrom} dateTo={dateTo} />

      {/* Revenue trend + sub distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <RevenueTrendSection dateFrom={dateFrom} dateTo={dateTo} />
        <SubsDistSection     dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {/* Recent financial activity + audit log */}
      <RecentSection />

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
