"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type {
  ReportOverview,
  ReportRevenue,
  ReportSubscriptions,
  ReportOrganizations,
  ReportUsers,
  Plan,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function fmt(amount: number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

function getPresetRange(preset: string): [string, string] {
  const now = new Date();
  const pad = (d: Date) => d.toISOString().split("T")[0];
  switch (preset) {
    case "bugun":      return [pad(now), pad(now)];
    case "shu_hafta": {
      const s = new Date(now);
      s.setDate(s.getDate() - (s.getDay() === 0 ? 6 : s.getDay() - 1));
      return [pad(s), pad(now)];
    }
    case "shu_oy":
      return [pad(new Date(now.getFullYear(), now.getMonth(), 1)), pad(now)];
    case "otgan_oy": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return [pad(s), pad(e)];
    }
    case "shu_yil":
      return [pad(new Date(now.getFullYear(), 0, 1)), pad(now)];
    default:
      return [pad(new Date(now.getFullYear(), now.getMonth(), 1)), pad(now)];
  }
}

// ── SVG Bar Chart ──────────────────────────────────────────────────

interface BarItem { label: string; total: number; count?: number }

function BarChart({ data, height = 160 }: { data: BarItem[]; height?: number }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-[#B8AAB2] text-sm">
      {uz.super_admin.hech_daromad_yoq}
    </div>
  );

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  // show at most 30 bars, aggregate if more
  const visible = data.length <= 30 ? data : data;
  const barW = Math.max(4, Math.min(24, Math.floor(600 / visible.length) - 2));
  const gap = Math.max(1, Math.min(4, Math.floor(600 / visible.length) - barW));
  const svgW = visible.length * (barW + gap);
  const padTop = 10;
  const padBot = 24;
  const chartH = height - padBot - padTop;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgW} ${height}`}
        width="100%"
        style={{ minWidth: Math.min(svgW, 300) }}
        className="select-none"
      >
        {visible.map((item, i) => {
          const barH = Math.max(2, (item.total / maxVal) * chartH);
          const x = i * (barW + gap);
          const y = padTop + chartH - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                className="fill-[#8E315D] opacity-80 hover:opacity-100 transition-opacity"
              />
              <title>{`${item.label}: ${fmt(item.total)}`}</title>
              {visible.length <= 15 && (
                <text
                  x={x + barW / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-[#B8AAB2]"
                >
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Simple horizontal bar for distributions ──────────────────────

function DistBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[#3D3240]">{label}</span>
        <span className="text-sm font-medium text-[#29232A]">{value} <span className="text-[#B8AAB2] font-normal text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-[#F2ECF0] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ title, value, sub, accent }: { title: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${accent ? "border-[#8E315D]" : "border-[#EDE3E8]"}`}>
      <p className="text-xs text-[#B8AAB2] uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-xl font-bold truncate ${accent ? "text-[#8E315D]" : "text-[#29232A]"}`}>{value}</p>
      {sub && <p className="text-xs text-[#B8AAB2] mt-1">{sub}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────

function Skeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[#EDE3E8] p-5 animate-pulse">
          <div className="h-3 w-24 bg-[#F2ECF0] rounded mb-3" />
          <div className="h-6 w-32 bg-[#F2ECF0] rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] py-12 flex flex-col items-center gap-3">
      <p className="text-[#766B73]">{uz.common.yuklash_xatosi}</p>
      <button onClick={onRetry} className="text-sm text-[#8E315D] hover:underline">{uz.common.qayta_urinish}</button>
    </div>
  );
}

// ── Sub-status badge helper ───────────────────────────────────────

function SubBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "info" | "error" }> = {
    active:    { label: uz.super_admin.faol,            variant: "success" },
    trial:     { label: uz.super_admin.sinov,           variant: "info" },
    past_due:  { label: uz.super_admin.past_due,        variant: "warning" },
    expired:   { label: uz.super_admin.muddati_tugagan, variant: "error" },
    cancelled: { label: uz.super_admin.bekor,           variant: "neutral" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

// ── Tab: Overview ─────────────────────────────────────────────────

function OverviewTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [data, setData]       = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ReportOverview>(
        `/v1/super-admin/reports/overview?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton count={8} />;
  if (error)   return <ErrorBlock onRetry={load} />;
  if (!data)   return null;

  const subTotal = data.subscriptions.active + data.subscriptions.trial +
    data.subscriptions.past_due + data.subscriptions.expired + data.subscriptions.cancelled;

  return (
    <div className="space-y-6">
      {/* Org KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[#766B73] uppercase tracking-wide mb-3">Tashkilotlar</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title={uz.super_admin.jami_bogchalar}      value={data.organizations.total}    sub="Jami ro'yxatda" />
          <KpiCard title={uz.super_admin.faol_bogchalar}      value={data.organizations.active}   sub="Faol" accent />
          <KpiCard title={uz.super_admin.nofaol_bogchalar}    value={data.organizations.inactive} sub="Nofaol" />
          <KpiCard title={uz.super_admin.yangi_bogchalar}     value={data.organizations.new}      sub="Tanlangan davrda" />
        </div>
      </div>

      {/* Sub KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[#766B73] uppercase tracking-wide mb-3">Obunalar</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="MRR"                               value={fmt(data.subscriptions.mrr)} sub="Oylik takrorlanuvchi" accent />
          <KpiCard title="ARR"                               value={fmt(data.subscriptions.arr)} sub="Yillik takrorlanuvchi" />
          <KpiCard title={uz.super_admin.yangi_obunalar}    value={data.subscriptions.new}       sub="Tanlangan davrda" />
          <KpiCard title={uz.super_admin.muddati_yaqin}     value={data.subscriptions.expired + data.subscriptions.past_due} sub="Muddati tugagan/o'tgan" />
        </div>

        {/* Status breakdown */}
        <div className="mt-4 bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.holat_taqsimoti}</p>
          <div className="space-y-3">
            <DistBar label={uz.super_admin.faol}            value={data.subscriptions.active}    total={subTotal} color="#16A34A" />
            <DistBar label={uz.super_admin.sinov}           value={data.subscriptions.trial}     total={subTotal} color="#8E315D" />
            <DistBar label={uz.super_admin.past_due}        value={data.subscriptions.past_due}  total={subTotal} color="#D97706" />
            <DistBar label={uz.super_admin.muddati_tugagan} value={data.subscriptions.expired}   total={subTotal} color="#DC2626" />
            <DistBar label={uz.super_admin.bekor}           value={data.subscriptions.cancelled} total={subTotal} color="#B8AAB2" />
          </div>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[#766B73] uppercase tracking-wide mb-3">Daromad</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title={uz.super_admin.net_tushum_hisobot}    value={fmt(data.revenue.total_paid)}      sub="Jami to'langan" accent />
          <KpiCard title={uz.super_admin.davr_tushum}           value={fmt(data.revenue.period_paid)}     sub="Tanlangan davrda" />
          <KpiCard title={uz.super_admin.kutilayotgan_tushum}   value={fmt(data.revenue.total_pending)}   sub="Kutilayotgan" />
          <KpiCard title={uz.super_admin.qaytarilgan}           value={fmt(data.revenue.total_refunded)}  sub="Qaytarilgan" />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard title={uz.super_admin.gross_tushum_hisobot}  value={fmt(data.revenue.gross_revenue)}      />
          <KpiCard title={uz.super_admin.ort_tushum_bogcha}     value={fmt(data.revenue.avg_revenue_per_org)} sub="Kamida 1 ta to'lov bo'lgan bog'chalar bo'yicha" />
        </div>
      </div>

      {/* Invoice KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[#766B73] uppercase tracking-wide mb-3">Invoicelar</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title={uz.super_admin.jami_invoice}           value={data.invoices.total}               />
          <KpiCard title={uz.super_admin.tolangan_invoice}       value={data.invoices.paid}                sub={fmt(data.invoices.paid_amount)} accent />
          <KpiCard title={uz.super_admin.kutilayotgan_invoice}   value={data.invoices.pending + data.invoices.overdue} sub={fmt(data.invoices.pending_amount)} />
          <KpiCard title={uz.super_admin.invoice_overdue}        value={data.invoices.overdue}             />
        </div>
      </div>
    </div>
  );
}

// ── Tab: Revenue ──────────────────────────────────────────────────

function RevenueTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [data, setData]       = useState<ReportRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

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

  if (loading) return <Skeleton count={4} />;
  if (error)   return <ErrorBlock onRetry={load} />;
  if (!data)   return null;

  const methodLabel: Record<string, string> = {
    manual: uz.super_admin.manual_pay,
    payme:  uz.super_admin.payme_pay,
    click:  uz.super_admin.click_pay,
    uzcard: uz.super_admin.uzcard_pay,
    humo:   uz.super_admin.humo_pay,
    other:  uz.super_admin.other_pay,
  };
  const methodTotal = data.by_method.reduce((s, m) => s + m.total, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={uz.super_admin.jami_tushum}  value={fmt(data.total)}                                    sub="Tanlangan davr" accent />
        <KpiCard title={uz.super_admin.tolov_soni}   value={data.series.reduce((s, i) => s + i.count, 0) + " ta"} />
        <KpiCard title="Tarif bo'yicha" value={data.by_plan.length + " ta tarif"} />
        <KpiCard title="Usul bo'yicha"  value={data.by_method.length + " ta usul"} />
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
        <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.daromad_dinamikasi}</p>
        <BarChart data={data.series} height={180} />
      </div>

      {/* By plan + by method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tarif_boyicha}</p>
          {data.by_plan.length === 0 ? (
            <p className="text-sm text-[#B8AAB2]">{uz.super_admin.hech_daromad_yoq}</p>
          ) : (
            <div className="space-y-3">
              {data.by_plan.map((p) => (
                <DistBar key={p.plan_name} label={p.plan_name} value={p.total}
                  total={data.total || 1} color="#8E315D" />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tolov_usuli_taqsimot}</p>
          {data.by_method.length === 0 ? (
            <p className="text-sm text-[#B8AAB2]">{uz.super_admin.hech_daromad_yoq}</p>
          ) : (
            <div className="space-y-3">
              {data.by_method.map((m) => (
                <DistBar
                  key={m.method}
                  label={methodLabel[m.method] ?? m.method}
                  value={m.total}
                  total={methodTotal}
                  color="#0EA5E9"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Subscriptions ────────────────────────────────────────────

function SubscriptionsTab({ dateFrom, dateTo, plans }: { dateFrom: string; dateTo: string; plans: Plan[] }) {
  const [data, setData]         = useState<ReportSubscriptions | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [planFilter, setPlan]   = useState("");

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const planParam = planFilter ? `&plan_id=${planFilter}` : "";
      const res = await api.get<ReportSubscriptions>(
        `/v1/super-admin/reports/subscriptions?date_from=${dateFrom}&date_to=${dateTo}${planParam}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, planFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton count={6} />;
  if (error)   return <ErrorBlock onRetry={load} />;
  if (!data)   return null;

  const sd    = data.status_distribution;
  const total = sd.active + sd.trial + sd.past_due + sd.expired + sd.cancelled;

  return (
    <div className="space-y-6">
      {/* Plan filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[#766B73]">{uz.super_admin.filter_plan}:</label>
        <select
          value={planFilter}
          onChange={(e) => setPlan(e.target.value)}
          className="text-sm border border-[#EDE3E8] rounded-lg px-3 py-1.5 text-[#3D3240] focus:outline-none focus:ring-2 focus:ring-[#8E315D]/20"
        >
          <option value="">{uz.common.hammasi}</option>
          {plans.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR"                              value={fmt(data.mrr)} sub="Faol obunalar" accent />
        <KpiCard title="ARR"                              value={fmt(data.arr)} sub="Yillik" />
        <KpiCard title={uz.super_admin.yangi_obunalar}   value={data.new_in_period} sub="Tanlangan davrda" />
        <KpiCard title={uz.super_admin.yaqin_tugaydi}    value={data.expiring_soon} sub="30 kun ichida" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title={uz.super_admin.bekor_davr}   value={data.cancelled_in_period} />
        <KpiCard title={uz.super_admin.tugagan_davr} value={data.expired_in_period} />
        <KpiCard title={uz.super_admin.faol_obunalar} value={sd.active} accent />
      </div>

      {/* Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.holat_taqsimoti}</p>
          <div className="space-y-3">
            <DistBar label={uz.super_admin.faol}            value={sd.active}    total={total} color="#16A34A" />
            <DistBar label={uz.super_admin.sinov}           value={sd.trial}     total={total} color="#8E315D" />
            <DistBar label={uz.super_admin.past_due}        value={sd.past_due}  total={total} color="#D97706" />
            <DistBar label={uz.super_admin.muddati_tugagan} value={sd.expired}   total={total} color="#DC2626" />
            <DistBar label={uz.super_admin.bekor}           value={sd.cancelled} total={total} color="#B8AAB2" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tarif_taqsimoti}</p>
          {data.plan_distribution.length === 0 ? (
            <p className="text-sm text-[#B8AAB2]">{uz.common.malumot_yoq}</p>
          ) : (
            <div className="space-y-3">
              {data.plan_distribution.map((p) => {
                const planTotal = data.plan_distribution.reduce((s, x) => s + x.count, 0) || 1;
                return (
                  <DistBar key={p.plan_id} label={p.plan_name} value={p.count} total={planTotal} color="#8E315D" />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Organizations ────────────────────────────────────────────

function OrganizationsTab({ dateFrom, dateTo, plans }: { dateFrom: string; dateTo: string; plans: Plan[] }) {
  const [data, setData]       = useState<ReportOrganizations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [planFilter, setPlan] = useState("");

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const planParam = planFilter ? `&plan_id=${planFilter}` : "";
      const res = await api.get<ReportOrganizations>(
        `/v1/super-admin/reports/organizations?date_from=${dateFrom}&date_to=${dateTo}${planParam}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, planFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton count={6} />;
  if (error)   return <ErrorBlock onRetry={load} />;
  if (!data)   return null;

  const { counts } = data;
  const growthMax = Math.max(...data.growth_series.map((g) => g.count), 1);

  return (
    <div className="space-y-6">
      {/* Plan filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[#766B73]">{uz.super_admin.filter_plan}:</label>
        <select
          value={planFilter}
          onChange={(e) => setPlan(e.target.value)}
          className="text-sm border border-[#EDE3E8] rounded-lg px-3 py-1.5 text-[#3D3240] focus:outline-none focus:ring-2 focus:ring-[#8E315D]/20"
        >
          <option value="">{uz.common.hammasi}</option>
          {plans.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title={uz.super_admin.jami_bogchalar}           value={counts.total}                sub="Jami ro'yxatda" />
        <KpiCard title={uz.super_admin.faol_bogchalar}           value={counts.active}               sub="Faol" accent />
        <KpiCard title={uz.super_admin.nofaol_bogchalar}         value={counts.inactive}             />
        <KpiCard title={uz.super_admin.yangi_bogchalar}          value={counts.new_in_period}        sub="Tanlangan davrda" />
        <KpiCard title={uz.super_admin.tollanmagan_invoice_bor}  value={counts.with_unpaid_invoices} />
        <KpiCard title={uz.super_admin.tugagan_obuna_bor}        value={counts.with_expired_subs}    />
      </div>

      {/* Plan distribution */}
      {data.plan_distribution.length > 0 && (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tarif_taqsimoti}</p>
          <div className="space-y-3">
            {data.plan_distribution.map((p) => {
              const planTotal = data.plan_distribution.reduce((s, x) => s + x.count, 0) || 1;
              return (
                <DistBar key={p.plan_id} label={p.plan_name} value={p.count} total={planTotal} color="#8E315D" />
              );
            })}
          </div>
        </div>
      )}

      {/* Growth chart */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
        <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tashkilot_osishi}</p>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${data.growth_series.length * 44} 140`} width="100%" style={{ minWidth: 400 }}>
            {data.growth_series.map((item, i) => {
              const barH = Math.max(2, (item.count / growthMax) * 100);
              const x    = i * 44;
              return (
                <g key={item.period}>
                  <rect x={x + 4} y={110 - barH} width={36} height={barH} rx={3}
                    className="fill-[#8E315D] opacity-70 hover:opacity-100 transition-opacity" />
                  <text x={x + 22} y={128} textAnchor="middle" fontSize={9} className="fill-[#B8AAB2]">
                    {item.label.slice(0, 3)}
                  </text>
                  {item.count > 0 && (
                    <text x={x + 22} y={106 - barH} textAnchor="middle" fontSize={9} className="fill-[#8E315D]">
                      {item.count}
                    </text>
                  )}
                  <title>{`${item.label}: ${item.count}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Users ────────────────────────────────────────────────────

function UsersTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [data, setData]       = useState<ReportUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ReportUsers>(
        `/v1/super-admin/reports/users?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error)   return <ErrorBlock onRetry={load} />;
  if (!data)   return null;

  const roleLabels: Record<string, string> = {
    super_admin: uz.foydalanuvchilar.rol_super_admin,
    admin:       uz.foydalanuvchilar.rol_admin,
    teacher:     uz.foydalanuvchilar.rol_teacher,
    parent:      uz.foydalanuvchilar.rol_parent,
  };
  const roleColors: Record<string, string> = {
    super_admin: "#8E315D",
    admin:       "#8E315D",
    teacher:     "#0891B2",
    parent:      "#16A34A",
  };
  const roleTotal = Object.values(data.by_role).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={uz.foydalanuvchilar.sarlavha}            value={data.counts.total}         sub="Jami" />
        <KpiCard title={uz.common.faol}                          value={data.counts.active}         sub="Faol" accent />
        <KpiCard title={uz.super_admin.nofaol_foydalanuvchilar}  value={data.counts.inactive}       />
        <KpiCard title={uz.super_admin.yangi_foydalanuvchilar}   value={data.counts.new_in_period}  sub="Tanlangan davrda" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By role */}
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.rol_boyicha}</p>
          <div className="space-y-3">
            {(Object.entries(data.by_role) as [string, number][]).map(([role, count]) => (
              <DistBar key={role} label={roleLabels[role] ?? role} value={count} total={roleTotal} color={roleColors[role] ?? "#766B73"} />
            ))}
          </div>
        </div>

        {/* By org top 10 */}
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <p className="text-sm font-semibold text-[#29232A] mb-4">{uz.super_admin.tashkilot_boyicha}</p>
          {data.by_organization.length === 0 ? (
            <p className="text-sm text-[#B8AAB2]">{uz.common.malumot_yoq}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EDE3E8]">
                  <th className="text-left py-2 text-xs font-semibold text-[#766B73] uppercase">Tashkilot</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#766B73] uppercase">Foydalanuvchi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF0]">
                {data.by_organization.map((row) => (
                  <tr key={row.organization_id} className="hover:bg-[#FAF5F8]">
                    <td className="py-2.5 text-[#3D3240]">{row.organization_name}</td>
                    <td className="py-2.5 text-right font-medium text-[#29232A]">{row.count}</td>
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

// ── Date filter bar ───────────────────────────────────────────────

const PRESETS = [
  { key: "bugun",    label: uz.super_admin.date_bugun },
  { key: "shu_hafta", label: uz.super_admin.date_shu_hafta },
  { key: "shu_oy",   label: uz.super_admin.date_shu_oy },
  { key: "otgan_oy", label: uz.super_admin.date_otgan_oy },
  { key: "shu_yil",  label: uz.super_admin.shu_yil },
  { key: "maxsus",   label: uz.super_admin.date_maxsus },
];

// ── Main Page ─────────────────────────────────────────────────────

type Tab = "umumiy" | "daromad" | "obunalar" | "tashkilotlar" | "foydalanuvchilar";

export default function HisobotlarPage() {
  const [activeTab, setActiveTab]         = useState<Tab>("umumiy");
  const [preset, setPreset]               = useState("shu_oy");
  const [dateFrom, setDateFrom]           = useState(() => getPresetRange("shu_oy")[0]);
  const [dateTo, setDateTo]               = useState(() => getPresetRange("shu_oy")[1]);
  const [customFrom, setCustomFrom]       = useState("");
  const [customTo, setCustomTo]           = useState("");
  const [plans, setPlans]                 = useState<Plan[]>([]);
  const [appliedFrom, setAppliedFrom]     = useState(dateFrom);
  const [appliedTo, setAppliedTo]         = useState(dateTo);

  useEffect(() => {
    api.get<{ data: Plan[] }>("/v1/super-admin/plans")
      .then((res) => setPlans(res.data ?? []))
      .catch(() => {});
  }, []);

  function applyPreset(key: string) {
    setPreset(key);
    if (key !== "maxsus") {
      const [f, t] = getPresetRange(key);
      setDateFrom(f);
      setDateTo(t);
      setAppliedFrom(f);
      setAppliedTo(t);
    }
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
    setDateFrom(customFrom);
    setDateTo(customTo);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "umumiy",          label: uz.super_admin.umumiy },
    { key: "daromad",         label: uz.super_admin.daromad_hisoboti },
    { key: "obunalar",        label: uz.super_admin.obuna_hisoboti },
    { key: "tashkilotlar",    label: uz.super_admin.tashkilot_hisoboti },
    { key: "foydalanuvchilar",label: uz.super_admin.foydalanuvchi_hisoboti },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#29232A]">{uz.super_admin.hisobotlar}</h1>
        <p className="text-[#B8AAB2] mt-1 text-sm">{uz.super_admin.hisobotlar_tavsif}</p>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] p-4">
        <p className="text-xs font-semibold text-[#766B73] uppercase tracking-wide mb-3">{uz.super_admin.davr_tanlash}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                preset === p.key
                  ? "bg-[#8E315D] text-white border-[#8E315D]"
                  : "border-[#EDE3E8] text-[#3D3240] hover:bg-[#FFF9F5]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "maxsus" && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#766B73]">{uz.super_admin.boshlanish_sanasi_f}:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm border border-[#EDE3E8] rounded-lg px-3 py-1.5 text-[#3D3240] focus:outline-none focus:ring-2 focus:ring-[#8E315D]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#766B73]">{uz.super_admin.tugash_sanasi_f}:</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm border border-[#EDE3E8] rounded-lg px-3 py-1.5 text-[#3D3240] focus:outline-none focus:ring-2 focus:ring-[#8E315D]/20"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
              className="px-4 py-1.5 text-sm bg-[#8E315D] text-white rounded-lg disabled:opacity-40 hover:bg-[#742548] transition-colors"
            >
              {uz.super_admin.filtrlash_btn}
            </button>
          </div>
        )}

        <p className="text-xs text-[#B8AAB2] mt-2">
          {fmtDate(appliedFrom)} — {fmtDate(appliedTo)}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#EDE3E8]">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Hisobot bo'limlari">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#8E315D] text-[#8E315D]"
                  : "border-transparent text-[#766B73] hover:text-[#3D3240] hover:border-[#D9C9D1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "umumiy"          && <OverviewTab       dateFrom={appliedFrom} dateTo={appliedTo} />}
        {activeTab === "daromad"         && <RevenueTab        dateFrom={appliedFrom} dateTo={appliedTo} />}
        {activeTab === "obunalar"        && <SubscriptionsTab  dateFrom={appliedFrom} dateTo={appliedTo} plans={plans} />}
        {activeTab === "tashkilotlar"    && <OrganizationsTab  dateFrom={appliedFrom} dateTo={appliedTo} plans={plans} />}
        {activeTab === "foydalanuvchilar"&& <UsersTab          dateFrom={appliedFrom} dateTo={appliedTo} />}
      </div>
    </div>
  );
}
