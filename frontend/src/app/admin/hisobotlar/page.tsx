"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { formatUzDate, localIsoDate } from "@/lib/dates";
import { BILLING_ENABLED } from "@/lib/features";
import Badge from "@/components/ui/Badge";
import uz, { intlLocale } from "@/i18n";
import type {
  ReportOverview,
  ReportRevenue,
  ReportSubscriptions,
  ReportOrganizations,
  ReportUsers,
  Plan,
} from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Helpers ────────────────────────────────────────────────────────

function fmt(amount: number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString(intlLocale())} ${currency}`;
}

// Mahalliy sana va o'zbekcha format (toLocaleDateString("uz-UZ") brauzerda «2026 M11 5» ko'rinishini berardi)
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return formatUzDate(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : localIsoDate(new Date(iso)));
}

function getPresetRange(preset: string): [string, string] {
  const now = new Date();
  // UTC emas — mahalliy sana (Toshkentda oy boshi oldingi kunga siljimasin)
  const pad = (d: Date) => localIsoDate(d);
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
    <div className="flex items-center justify-center h-40 text-[var(--text-3)] text-sm">
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
                className="fill-[var(--primary)] opacity-80 hover:opacity-100 transition-opacity"
              />
              <title>{`${item.label}: ${fmt(item.total)}`}</title>
              {visible.length <= 15 && (
                <text
                  x={x + barW / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-[var(--text-3)]"
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
        <span className="text-sm text-[var(--label)]">{label}</span>
        <span className="text-sm font-medium text-[var(--text)]">{value} <span className="text-[var(--text-3)] font-normal text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border-2)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ title, value, sub, accent }: { title: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${accent ? "border-[var(--primary)]" : "border-[var(--border)]"}`}>
      <p className="text-xs text-[var(--text-3)] uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-xl font-bold truncate ${accent ? "text-[var(--primary)]" : "text-[var(--text)]"}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-3)] mt-1">{sub}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────

function Skeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[var(--border)] p-5 animate-pulse">
          <div className="h-3 w-24 bg-[var(--border-2)] rounded mb-3" />
          <div className="h-6 w-32 bg-[var(--border-2)] rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] py-12 flex flex-col items-center gap-3">
      <p className="text-[var(--text-2)]">{uz.common.yuklash_xatosi}</p>
      <button onClick={onRetry} className="text-sm text-[var(--primary)] hover:underline">{uz.common.qayta_urinish}</button>
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
        <h3 className="text-sm font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3">{uz.matn.tashkilotlar}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title={uz.super_admin.jami_bogchalar}      value={data.organizations.total}    sub={uz.matn.jami_royxatda} />
          <KpiCard title={uz.super_admin.faol_bogchalar}      value={data.organizations.active}   sub={uz.matn.faol} accent />
          <KpiCard title={uz.super_admin.nofaol_bogchalar}    value={data.organizations.inactive} sub={uz.matn.nofaol} />
          <KpiCard title={uz.super_admin.yangi_bogchalar}     value={data.organizations.new}      sub={uz.matn.tanlangan_davrda} />
        </div>
      </div>

      {/* Sub KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3">{uz.matn.obunalar}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="MRR"                               value={fmt(data.subscriptions.mrr)} sub={uz.matn.oylik_takrorlanuvchi} accent />
          <KpiCard title="ARR"                               value={fmt(data.subscriptions.arr)} sub={uz.matn.yillik_takrorlanuvchi} />
          <KpiCard title={uz.super_admin.yangi_obunalar}    value={data.subscriptions.new}       sub={uz.matn.tanlangan_davrda} />
          <KpiCard title={uz.super_admin.muddati_yaqin}     value={data.subscriptions.expired + data.subscriptions.past_due} sub={uz.matn.muddati_tugagan_otgan} />
        </div>

        {/* Status breakdown */}
        <div className="mt-4 bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.holat_taqsimoti}</p>
          <div className="space-y-3">
            <DistBar label={uz.super_admin.faol}            value={data.subscriptions.active}    total={subTotal} color="#16A34A" />
            <DistBar label={uz.super_admin.sinov}           value={data.subscriptions.trial}     total={subTotal} color="var(--primary)" />
            <DistBar label={uz.super_admin.past_due}        value={data.subscriptions.past_due}  total={subTotal} color="#D97706" />
            <DistBar label={uz.super_admin.muddati_tugagan} value={data.subscriptions.expired}   total={subTotal} color="#DC2626" />
            <DistBar label={uz.super_admin.bekor}           value={data.subscriptions.cancelled} total={subTotal} color="var(--text-3)" />
          </div>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3">{uz.matn.daromad}</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title={uz.super_admin.net_tushum_hisobot}    value={fmt(data.revenue.total_paid)}      sub={uz.matn.jami_tolangan} accent />
          <KpiCard title={uz.super_admin.davr_tushum}           value={fmt(data.revenue.period_paid)}     sub={uz.matn.tanlangan_davrda} />
          <KpiCard title={uz.super_admin.kutilayotgan_tushum}   value={fmt(data.revenue.total_pending)}   sub={uz.matn.kutilayotgan} />
          <KpiCard title={uz.super_admin.qaytarilgan}           value={fmt(data.revenue.total_refunded)}  sub={uz.matn.qaytarilgan} />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard title={uz.super_admin.gross_tushum_hisobot}  value={fmt(data.revenue.gross_revenue)}      />
          <KpiCard title={uz.super_admin.ort_tushum_bogcha}     value={fmt(data.revenue.avg_revenue_per_org)} sub={uz.matn.kamida_1_ta_tolov_bolgan} />
        </div>
      </div>

      {/* Invoice KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3">{uz.matn.invoicelar}</h3>
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
        <KpiCard title={uz.super_admin.jami_tushum}  value={fmt(data.total)}                                    sub={uz.matn.tanlangan_davr} accent />
        <KpiCard title={uz.super_admin.tolov_soni}   value={data.series.reduce((s, i) => s + i.count, 0) + " ta"} />
        <KpiCard title={uz.matn.tarif_boyicha} value={data.by_plan.length + uz.matn.ta_tarif} />
        <KpiCard title={uz.matn.usul_boyicha}  value={data.by_method.length + uz.matn.ta_usul} />
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5">
        <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.daromad_dinamikasi}</p>
        <BarChart data={data.series} height={180} />
      </div>

      {/* By plan + by method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tarif_boyicha}</p>
          {data.by_plan.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">{uz.super_admin.hech_daromad_yoq}</p>
          ) : (
            <div className="space-y-3">
              {data.by_plan.map((p) => (
                <DistBar key={p.plan_name} label={p.plan_name} value={p.total}
                  total={data.total || 1} color="var(--primary)" />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tolov_usuli_taqsimot}</p>
          {data.by_method.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">{uz.super_admin.hech_daromad_yoq}</p>
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
        <label className="text-sm text-[var(--text-2)]">{uz.super_admin.filter_plan}:</label>
        <select
          value={planFilter}
          onChange={(e) => setPlan(e.target.value)}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        >
          <option value="">{uz.common.hammasi}</option>
          {plans.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR"                              value={fmt(data.mrr)} sub={uz.matn.faol_obunalar} accent />
        <KpiCard title="ARR"                              value={fmt(data.arr)} sub={uz.matn.yillik} />
        <KpiCard title={uz.super_admin.yangi_obunalar}   value={data.new_in_period} sub={uz.matn.tanlangan_davrda} />
        <KpiCard title={uz.super_admin.yaqin_tugaydi}    value={data.expiring_soon} sub={uz.matn.m_30_kun_ichida} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title={uz.super_admin.bekor_davr}   value={data.cancelled_in_period} />
        <KpiCard title={uz.super_admin.tugagan_davr} value={data.expired_in_period} />
        <KpiCard title={uz.super_admin.faol_obunalar} value={sd.active} accent />
      </div>

      {/* Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.holat_taqsimoti}</p>
          <div className="space-y-3">
            <DistBar label={uz.super_admin.faol}            value={sd.active}    total={total} color="#16A34A" />
            <DistBar label={uz.super_admin.sinov}           value={sd.trial}     total={total} color="var(--primary)" />
            <DistBar label={uz.super_admin.past_due}        value={sd.past_due}  total={total} color="#D97706" />
            <DistBar label={uz.super_admin.muddati_tugagan} value={sd.expired}   total={total} color="#DC2626" />
            <DistBar label={uz.super_admin.bekor}           value={sd.cancelled} total={total} color="var(--text-3)" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tarif_taqsimoti}</p>
          {data.plan_distribution.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">{uz.common.malumot_yoq}</p>
          ) : (
            <div className="space-y-3">
              {data.plan_distribution.map((p) => {
                const planTotal = data.plan_distribution.reduce((s, x) => s + x.count, 0) || 1;
                return (
                  <DistBar key={p.plan_id} label={p.plan_name} value={p.count} total={planTotal} color="var(--primary)" />
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
      {BILLING_ENABLED && <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--text-2)]">{uz.super_admin.filter_plan}:</label>
        <select
          value={planFilter}
          onChange={(e) => setPlan(e.target.value)}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        >
          <option value="">{uz.common.hammasi}</option>
          {plans.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard title={uz.super_admin.jami_bogchalar}           value={counts.total}                sub={uz.matn.jami_royxatda} />
        <KpiCard title={uz.super_admin.faol_bogchalar}           value={counts.active}               sub={uz.matn.faol} accent />
        <KpiCard title={uz.super_admin.nofaol_bogchalar}         value={counts.inactive}
          sub={counts.suspended ? `${uz.super_admin.toxtatilgan_soni}: ${counts.suspended}` : undefined} />
        <KpiCard title={uz.super_admin.yangi_bogchalar}          value={counts.new_in_period}        sub={uz.matn.tanlangan_davrda} />
        {BILLING_ENABLED && <KpiCard title={uz.super_admin.tollanmagan_invoice_bor}  value={counts.with_unpaid_invoices} />}
        {BILLING_ENABLED && <KpiCard title={uz.super_admin.tugagan_obuna_bor}        value={counts.with_expired_subs}    />}
      </div>

      <p data-testid="hisob-qoidasi" className="text-xs text-[var(--text-2)]">
        {uz.super_admin.hisob_qoidasi}
        {(counts.archived ?? 0) > 0 && <> · {counts.archived} {uz.super_admin.arxiv_izoh}</>}
      </p>

      {/* Plan distribution */}
      {BILLING_ENABLED && data.plan_distribution.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tarif_taqsimoti}</p>
          <div className="space-y-3">
            {data.plan_distribution.map((p) => {
              const planTotal = data.plan_distribution.reduce((s, x) => s + x.count, 0) || 1;
              return (
                <DistBar key={p.plan_id} label={p.plan_name} value={p.count} total={planTotal} color="var(--primary)" />
              );
            })}
          </div>
        </div>
      )}

      {/* Growth chart */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5">
        <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tashkilot_osishi}</p>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${data.growth_series.length * 44} 140`} width="100%" style={{ minWidth: 400 }}>
            {data.growth_series.map((item, i) => {
              const barH = Math.max(2, (item.count / growthMax) * 100);
              const x    = i * 44;
              return (
                <g key={item.period}>
                  <rect x={x + 4} y={110 - barH} width={36} height={barH} rx={3}
                    className="fill-[var(--primary)] opacity-70 hover:opacity-100 transition-opacity" />
                  <text x={x + 22} y={128} textAnchor="middle" fontSize={9} className="fill-[var(--text-3)]">
                    {item.label.slice(0, 3)}
                  </text>
                  {item.count > 0 && (
                    <text x={x + 22} y={106 - barH} textAnchor="middle" fontSize={9} className="fill-[var(--primary)]">
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
    super_admin: "var(--primary)",
    admin:       "var(--primary)",
    teacher:     "#0891B2",
    parent:      "#16A34A",
  };
  const roleTotal = Object.values(data.by_role).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={uz.foydalanuvchilar.sarlavha}            value={data.counts.total}         sub={uz.matn.jami} />
        <KpiCard title={uz.common.faol}                          value={data.counts.active}         sub={uz.matn.faol} accent />
        <KpiCard title={uz.super_admin.nofaol_foydalanuvchilar}  value={data.counts.inactive}       />
        <KpiCard title={uz.super_admin.yangi_foydalanuvchilar}   value={data.counts.new_in_period}  sub={uz.matn.tanlangan_davrda} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By role */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.rol_boyicha}</p>
          <div className="space-y-3">
            {(Object.entries(data.by_role) as [string, number][]).map(([role, count]) => (
              <DistBar key={role} label={roleLabels[role] ?? role} value={count} total={roleTotal} color={roleColors[role] ?? "var(--text-2)"} />
            ))}
          </div>
        </div>

        {/* By org top 10 */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <p className="text-sm font-semibold text-[var(--text)] mb-4">{uz.super_admin.tashkilot_boyicha}</p>
          {data.by_organization.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">{uz.common.malumot_yoq}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-xs font-semibold text-[var(--text-2)] uppercase">{uz.matn.tashkilot}</th>
                  <th className="text-right py-2 text-xs font-semibold text-[var(--text-2)] uppercase">{uz.matn.foydalanuvchi}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-2)]">
                {data.by_organization.map((row) => (
                  <tr key={row.organization_id} className="hover:bg-[var(--surface-2)]">
                    <td className="py-2.5 text-[var(--label)]">{row.organization_name}</td>
                    <td className="py-2.5 text-right font-medium text-[var(--text)]">{row.count}</td>
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
  { key: "bugun",    get label() { return uz.super_admin.date_bugun; } },
  { key: "shu_hafta", get label() { return uz.super_admin.date_shu_hafta; } },
  { key: "shu_oy",   get label() { return uz.super_admin.date_shu_oy; } },
  { key: "otgan_oy", get label() { return uz.super_admin.date_otgan_oy; } },
  { key: "shu_yil",  get label() { return uz.super_admin.shu_yil; } },
  { key: "maxsus",   get label() { return uz.super_admin.date_maxsus; } },
];

// ── Main Page ─────────────────────────────────────────────────────

type Tab = "umumiy" | "daromad" | "obunalar" | "tashkilotlar" | "foydalanuvchilar";

export default function HisobotlarPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  // Billing o'chiq bo'lsa (MVP) — faqat tashkilotlar va foydalanuvchilar hisobotlari
  const [activeTab, setActiveTab]         = useState<Tab>(BILLING_ENABLED ? "umumiy" : "tashkilotlar");
  const [preset, setPreset]               = useState("shu_oy");
  const [dateFrom, setDateFrom]           = useState(() => getPresetRange("shu_oy")[0]);
  const [dateTo, setDateTo]               = useState(() => getPresetRange("shu_oy")[1]);
  const [customFrom, setCustomFrom]       = useState("");
  const [customTo, setCustomTo]           = useState("");
  const [plans, setPlans]                 = useState<Plan[]>([]);
  const [appliedFrom, setAppliedFrom]     = useState(dateFrom);
  const [appliedTo, setAppliedTo]         = useState(dateTo);

  useEffect(() => {
    if (!BILLING_ENABLED) return;
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

  const ALL_TABS: { key: Tab; label: string; billing?: true }[] = [
    { key: "umumiy",          label: uz.super_admin.umumiy, billing: true },
    { key: "daromad",         label: uz.super_admin.daromad_hisoboti, billing: true },
    { key: "obunalar",        label: uz.super_admin.obuna_hisoboti, billing: true },
    { key: "tashkilotlar",    label: uz.super_admin.tashkilot_hisoboti },
    { key: "foydalanuvchilar",label: uz.super_admin.foydalanuvchi_hisoboti },
  ];
  const TABS = ALL_TABS.filter((t) => BILLING_ENABLED || !t.billing);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.hisobotlar}</h1>
        <p className="text-[var(--text-3)] mt-1 text-sm">{uz.super_admin.hisobotlar_tavsif}</p>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-3">{uz.super_admin.davr_tanlash}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                preset === p.key
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "maxsus" && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--text-2)]">{uz.super_admin.boshlanish_sanasi_f}:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--text-2)]">{uz.super_admin.tugash_sanasi_f}:</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
              className="px-4 py-1.5 text-sm bg-[var(--primary)] text-white rounded-lg disabled:opacity-40 hover:bg-[var(--primary-h)] transition-colors"
            >
              {uz.super_admin.filtrlash_btn}
            </button>
          </div>
        )}

        <p className="text-xs text-[var(--text-3)] mt-2">
          {fmtDate(appliedFrom)} — {fmtDate(appliedTo)}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-1 overflow-x-auto" aria-label={uz.matn.hisobot_bolimlari}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--label)] hover:border-[var(--border-strong)]"
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
