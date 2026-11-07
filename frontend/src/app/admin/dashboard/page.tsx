"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type {
  AttendanceTotals,
  DashboardSummaryEnhanced,
  OrganizationSummary,
  PaginatedResponse,
} from "@/types";

const t = uz.platforma;

// ── Utility ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : Number(n).toLocaleString("uz-UZ");
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#EDE3E8] rounded-lg ${className ?? ""}`} />;
}

// ── Error block ───────────────────────────────────────────────────────────────

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <p className="text-sm text-[#766B73]">{uz.common.yuklash_xatosi}</p>
      <button
        onClick={onRetry}
        className="text-sm text-[#8E315D] hover:underline font-medium"
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
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  accent: "green" | "red" | "purple";
}) {
  const dot = {
    green:  "bg-[#22C55E]",
    red:    "bg-[#EF4444]",
    purple: "bg-[#8E315D]",
  }[accent];

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <p className="text-xs text-[#B8AAB2] font-medium uppercase tracking-wide truncate">{title}</p>
      </div>
      <p className="text-2xl font-bold text-[#29232A] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#766B73]">{sub}</p>}
    </div>
  );
}

// ── Distribution bar ──────────────────────────────────────────────────────────

function DistBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-[#B8AAB2]">{uz.common.malumot_yoq}</p>;
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-px bg-[#F2ECF0]">
        {items.map((item) => (
          <div
            key={item.label}
            style={{ width: `${(item.count / total) * 100}%` }}
            className={item.color}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
            <span className="text-xs text-[#766B73]">
              {item.label} <span className="font-semibold text-[#3D3240]">{item.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "neutral"}>{active ? t.faol : t.nofaol}</Badge>;
}

function OrgAvatar({ name }: { name: string }) {
  return (
    <div className="h-8 w-8 rounded-lg bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] font-semibold text-xs flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Today's attendance (aggregate only) ──────────────────────────────────────

function AttendanceCard({ data }: { data: AttendanceTotals }) {
  const marked = data.keldi + data.kelmadi + data.sababli;
  const pct    = marked > 0 ? Math.round((data.keldi / marked) * 100) : null;

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-semibold text-[#29232A]">{t.bugungi_davomat}</h2>
        <span className="text-xs text-[#B8AAB2]">{fmtDate(data.sana)}</span>
      </div>
      <div data-testid="platform-attendance" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: uz.davomat.keldi,         value: data.keldi,         cls: "text-[#166534]" },
          { label: uz.davomat.kelmadi,       value: data.kelmadi,       cls: "text-[#991B1B]" },
          { label: uz.davomat.sababli,       value: data.sababli,       cls: "text-[#92400E]" },
          { label: uz.davomat.belgilanmagan, value: data.belgilanmagan, cls: "text-[#766B73]" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-[#FAF5F8] px-3 py-2.5">
            <p className="text-[11px] text-[#B8AAB2] font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold leading-tight ${s.cls}`}>{num(s.value)}</p>
          </div>
        ))}
      </div>
      {pct !== null && (
        <p className="text-xs text-[#766B73] mt-3">
          {t.davomat_ulushi}: <span className="font-semibold text-[#29232A]">{pct}%</span>
        </p>
      )}
    </div>
  );
}

// ── Summary section ──────────────────────────────────────────────────────────

function SummarySection() {
  const [data, setData]       = useState<DashboardSummaryEnhanced | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      setData(await api.get<DashboardSummaryEnhanced>("/v1/super-admin/dashboard"));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-[#EDE3E8]">
        <ErrorBlock onRetry={load} />
      </div>
    );
  }

  const p = data.platforma;
  const activePct = data.jami_bogchalar > 0
    ? Math.round((data.faol_bogchalar / data.jami_bogchalar) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title={t.jami_bogchalar}     value={num(data.jami_bogchalar)}   accent="purple" />
        <KpiCard title={t.faol_bogchalar}     value={num(data.faol_bogchalar)}   accent="green" />
        <KpiCard title={t.nofaol_bogchalar}   value={num(data.nofaol_bogchalar)} accent="red"
          sub={data.toxtatilgan_bogchalar ? `${uz.super_admin.toxtatilgan_soni}: ${data.toxtatilgan_bogchalar}` : undefined} />
        <KpiCard title={t.jami_bolalar}       value={num(p?.jami_bolalar)}       accent="purple" />
        <KpiCard title={t.jami_guruhlar}      value={num(p?.jami_guruhlar)}      accent="purple" />
        <KpiCard title={t.jami_tarbiyachilar} value={num(p?.jami_tarbiyachilar)} accent="purple" />
      </div>

      {(data.demo_bogchalar ?? 0) > 0 && (
        <p data-testid="demo-izoh" className="text-xs text-[#92400E]">
          {data.demo_bogchalar} {uz.super_admin.demo_izoh}
        </p>
      )}
      <p data-testid="hisob-qoidasi" className="text-xs text-[#766B73]">
        {uz.super_admin.hisob_qoidasi}
        {(data.arxiv_bogchalar ?? 0) > 0 && <> · <span data-testid="arxiv-izoh">{data.arxiv_bogchalar} {uz.super_admin.arxiv_izoh}</span></>}
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm font-semibold text-[#29232A]">{t.bogchalar_holati}</h2>
            {data.jami_bogchalar > 0 && (
              <span className="text-xs text-[#766B73]">
                <span className="font-semibold text-[#29232A]">{activePct}%</span> {t.faollik_ulushi}
              </span>
            )}
          </div>
          <DistBar
            items={[
              { label: t.faol,   count: data.faol_bogchalar,   color: "bg-[#22C55E]" },
              { label: t.nofaol, count: data.nofaol_bogchalar, color: "bg-[#D9C9D1]" },
            ]}
          />
        </div>

        {p ? (
          <AttendanceCard data={p.bugungi_davomat} />
        ) : (
          <div className="bg-white rounded-xl border border-[#EDE3E8] p-5">
            <h2 className="text-sm font-semibold text-[#29232A] mb-4">{t.bugungi_davomat}</h2>
            <p className="text-sm text-[#B8AAB2]">{uz.common.malumot_yoq}</p>
          </div>
        )}
      </div>

      {/* Recently registered */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EDE3E8]">
          <h2 className="text-sm font-semibold text-[#29232A]">{t.oxirgi_qoshilgan}</h2>
        </div>
        {data.oxirgi_bogchalar.length === 0 ? (
          <p className="text-sm text-[#B8AAB2] text-center py-8">{t.bogcha_yoq}</p>
        ) : (
          <ul className="divide-y divide-[#F2ECF0]">
            {data.oxirgi_bogchalar.slice(0, 5).map((org) => (
              <li key={org.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <OrgAvatar name={org.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#29232A] truncate">{org.name}</p>
                    <p className="text-xs text-[#B8AAB2]">
                      {t.qoshilgan}: {fmtDate(org.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge active={org.is_active} />
                  <Link
                    href={`/admin/bogchalar/${org.id}`}
                    className="text-xs text-[#8E315D] hover:text-[#742548] font-medium"
                  >
                    {t.batafsil}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Kindergarten list with search and status filter ──────────────────────────

type StatusFilter = "" | "active" | "inactive";

function OrganizationsSection() {
  const [search, setSearch]   = useState("");
  const [query, setQuery]     = useState("");
  const [status, setStatus]   = useState<StatusFilter>("");
  const [rows, setRows]       = useState<OrganizationSummary[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  // Qidiruvni yozib bo'lgach so'rov yuboriladi
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ sort: "name", per_page: "100" });
      if (query)  qs.set("search", query);
      if (status) qs.set("status", status);
      const res = await api.get<PaginatedResponse<OrganizationSummary>>(`/v1/super-admin/organizations?${qs}`);
      setRows(res.data);
      setTotal(res.meta.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => { load(); }, [load]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "",         label: t.filter_barchasi },
    { key: "active",   label: t.filter_faol },
    { key: "inactive", label: t.filter_nofaol },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDE3E8] flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#29232A]">{t.royxat}</h2>
          {!loading && !error && (
            <span className="text-xs text-[#B8AAB2]">{total} {t.jami_topildi}</span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:ml-auto">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.qidiruv}
            aria-label={t.qidiruv}
            className="w-full sm:w-72 text-sm border border-[#EDE3E8] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#8E315D]"
          />
          <div className="flex gap-1" role="group">
            {filters.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => setStatus(f.key)}
                aria-pressed={status === f.key}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  status === f.key
                    ? "bg-[#8E315D] text-white"
                    : "bg-[#F2ECF0] text-[#3D3240] hover:bg-[#F4C7D7]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : error ? (
        <ErrorBlock onRetry={load} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#B8AAB2] text-center py-10">
          {query || status ? t.topilmadi : t.bogcha_yoq}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{t.bogcha}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.holat}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">{t.manzil}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{t.bolalar}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{t.guruhlar}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{t.tarbiyachilar}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF0]">
              {rows.map((org) => (
                <tr key={org.id} className="hover:bg-[#FAF5F8] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <OrgAvatar name={org.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-[#29232A] truncate">{org.name}</p>
                        <p className="text-xs text-[#B8AAB2]">{org.phone ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge active={org.is_active} /></td>
                  <td className="px-4 py-3 text-[#766B73] hidden lg:table-cell">{org.address ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#29232A]">{num(org.children_count)}</td>
                  <td className="px-4 py-3 text-right text-[#3D3240] hidden sm:table-cell">{num(org.groups_count)}</td>
                  <td className="px-4 py-3 text-right text-[#3D3240] hidden sm:table-cell">{num(org.teachers_count)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/bogchalar/${org.id}`}
                      className="text-xs text-[#8E315D] hover:text-[#742548] font-medium whitespace-nowrap"
                    >
                      {t.batafsil}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#29232A]">{t.sarlavha}</h1>
        <p className="text-[#B8AAB2] mt-1 text-sm">{t.tavsif}</p>
      </div>

      <SummarySection />
      <OrganizationsSection />
    </div>
  );
}
