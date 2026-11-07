"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
import { DIRECTION_LABELS } from "@/components/daily/dailyRules";
import type { ApiResponse, DashboardSummary, Group } from "@/types";

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function GroupProgressBar({ group }: { group: Group }) {
  const count    = group.children_count ?? 0;
  const capacity = group.capacity;
  const pct      = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : null;

  const barColor =
    pct === null     ? "bg-[#8E315D]" :
    pct >= 100       ? "bg-[#EF4444]" :
    pct >= 80        ? "bg-[#F59E0B]" :
                       "bg-[#22C55E]";

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] p-5 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] flex-shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#29232A]">{group.name}</p>
            {group.age_category && (
              <p className="text-xs text-[#B8AAB2]">{group.age_category}</p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-[#29232A]">
          {count}{capacity ? `/${capacity}` : ""}
        </span>
      </div>

      {pct !== null ? (
        <div>
          <div className="w-full h-1.5 bg-[#F2ECF0] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[#B8AAB2] mt-1.5">{pct}% {uz.guruhlar.sigim_korsatish}</p>
        </div>
      ) : (
        <p className="text-xs text-[#B8AAB2]">{count} {uz.dashboard.bola}</p>
      )}
    </div>
  );
}

export default function BogchaDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const [sumRes, grpRes] = await Promise.all([
        api.get<DashboardSummary>("/v1/admin/dashboard"),
        api.get<ApiResponse<Group[]>>("/v1/admin/groups"),
      ]);
      setSummary(sumRes);
      setGroups(grpRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const firstName = user?.name?.split(" ")[0] ?? "Admin";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Greeting + kindergarten profile */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#29232A]">
            {uz.dashboard.salom}, {firstName}!
          </h1>
          <p className="text-[#B8AAB2] mt-1 text-sm">{todayLabel()} · {uz.dashboard.bugungi_holat}</p>
        </div>
        {summary?.bogcha && (
          <div data-testid="bogcha-profile" className="flex items-center gap-3 bg-white rounded-xl border border-[#EDE3E8] px-4 py-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] font-bold flex-shrink-0">
              {summary.bogcha.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#29232A] truncate">{summary.bogcha.name}</p>
              <p className="text-xs text-[#B8AAB2] truncate">
                {[summary.bogcha.address, summary.bogcha.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <nav aria-label={uz.bogcha_panel.tez_amallar} className="flex flex-wrap gap-2">
        {[
          { href: "/bogcha/davomat",       label: uz.bogcha_panel.davomat },
          { href: "/bogcha/bolalar",       label: uz.bogcha_panel.bola_qoshish },
          { href: "/bogcha/guruhlar",      label: uz.bogcha_panel.guruhlar },
          { href: "/bogcha/tarbiyachilar", label: uz.bogcha_panel.tarbiyachilar },
          { href: "/bogcha/kundalik",      label: uz.bogcha_panel.kundalik },
          { href: "/bogcha/xabarlar",      label: uz.bogcha_panel.xabarlar },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="px-3.5 py-2 rounded-lg border border-[#EDE3E8] bg-white text-sm font-medium text-[#3D3240] hover:border-[#8E315D] hover:bg-[#FDF2F6] hover:text-[#8E315D] transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </nav>

      {/* Stats */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] py-10">
          <EmptyState
            title={uz.common.yuklash_xatosi}
            action={{ label: uz.common.qayta_urinish, onClick: load }}
            icon={
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={uz.dashboard.bolalar}
            value={summary?.bolalar_soni ?? 0}
            subtitle={summary?.faol_bolalar_soni !== undefined
              ? `${uz.dashboard.jami_bolalar} · ${uz.dashboard.faol_bolalar}: ${summary.faol_bolalar_soni}`
              : uz.dashboard.jami_bolalar}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <StatCard
            title={uz.dashboard.guruhlar}
            value={summary?.guruhlar_soni ?? 0}
            subtitle={uz.dashboard.jami_guruhlar}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            title={uz.dashboard.tarbiyachilar}
            value={summary?.tarbiyachilar_soni ?? 0}
            subtitle={uz.dashboard.jami_tarbiyachilar}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            title={uz.nav.ota_onalar}
            value={summary?.ota_onalar_soni ?? 0}
            subtitle={uz.dashboard.jami_ota_onalar}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Groups section */}
      {!loading && !error && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#29232A]">{uz.dashboard.guruhlar_holati}</h2>
            <Link
              href="/bogcha/guruhlar"
              className="text-sm text-[#8E315D] hover:text-[#742548] font-medium transition-colors"
            >
              {uz.dashboard.barchasini_korish}
            </Link>
          </div>
          {groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#EDE3E8] py-10">
              <EmptyState
                title={uz.dashboard.guruh_yoq}
                description={uz.dashboard.guruh_yoq_tavsif}
                icon={
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g) => (
                <GroupProgressBar key={g.id} group={g} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bugungi davomat — real API (demo ma'lumotda bugungi_davomat yo'q) */}
      {!loading && !error && (
      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE3E8] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#29232A]">{uz.dashboard.bugungi_davomat}</h2>
          {summary?.bugungi_davomat && (
            <Link href="/bogcha/davomat" className="text-sm text-[#8E315D] hover:text-[#742548] font-medium transition-colors">
              {uz.dashboard.davomat_ochish}
            </Link>
          )}
        </div>
        {summary?.bugungi_davomat ? (
          <div data-testid="today-attendance" className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-[#EDE3E8]">
            {[
              { label: uz.davomat.jami,          value: summary.bugungi_davomat.jami,          cls: "text-[#29232A]" },
              { label: uz.davomat.keldi,         value: summary.bugungi_davomat.keldi,         cls: "text-[#166534]" },
              { label: uz.davomat.kelmadi,       value: summary.bugungi_davomat.kelmadi,       cls: "text-[#991B1B]" },
              { label: uz.davomat.sababli,       value: summary.bugungi_davomat.sababli,       cls: "text-[#92400E]" },
              { label: uz.davomat.belgilanmagan, value: summary.bugungi_davomat.belgilanmagan, cls: "text-[#766B73]" },
            ].map((s) => (
              <div key={s.label} className="bg-white px-5 py-4">
                <p className="text-xs text-[#B8AAB2] font-medium uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold leading-tight ${s.cls}`}>{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
        <EmptyState
          title={uz.dashboard.davomat_yoq}
          description={uz.dashboard.davomat_yoq_tavsif}
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        )}
      </div>
      )}

      {/* So'nggi faoliyatlar — shu bog'chaning oxirgi kundalik mashg'ulotlari (real API) */}
      {!loading && !error && summary?.songgi_faoliyatlar && (
        <div data-testid="recent-activities" className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EDE3E8] flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#29232A]">{uz.dashboard.songgi_faoliyatlar}</h2>
            <Link href="/bogcha/kundalik" className="text-sm text-[#8E315D] hover:text-[#742548] font-medium transition-colors">
              {uz.dashboard.kundalikni_ochish}
            </Link>
          </div>
          {summary.songgi_faoliyatlar.length === 0 ? (
            <EmptyState
              title={uz.dashboard.faoliyat_yoq}
              description={uz.dashboard.faoliyat_yoq_tavsif}
              icon={
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              }
            />
          ) : (
            <ul className="divide-y divide-[#F2ECF0]">
              {summary.songgi_faoliyatlar.map((a) => (
                <li key={a.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#29232A] truncate">{a.title}</p>
                    <p className="text-xs text-[#B8AAB2] truncate">
                      {[a.group?.name, a.direction ? (DIRECTION_LABELS[a.direction as keyof typeof DIRECTION_LABELS] ?? null) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-[#766B73] flex-shrink-0">{a.date}{a.starts_at ? ` · ${a.starts_at}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Joriy oy to'lov holati — real API (demo ma'lumotda yo'q) */}
      {summary?.tolovlar && (
        <Link href="/bogcha/tolovlar" data-testid="payments-card"
          className="block bg-white rounded-xl border border-[#EDE3E8] px-6 py-4 hover:border-[#D9C9D1] hover:shadow-sm transition">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[#29232A]">{uz.tolov.dashboard} · {summary.tolovlar.oy}</p>
              <p className="text-sm text-[#766B73] mt-0.5">
                {uz.tolov.tolagan}: <strong className="text-[#166534]">{summary.tolovlar.tolagan}</strong> · {uz.tolov.tolanmagan}:{" "}
                <strong className="text-[#92400E]">{summary.tolovlar.tolanmagan}</strong>
              </p>
            </div>
            <span className="text-sm font-medium text-[#8E315D]">{uz.tolov.sarlavha} →</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#F2ECF0] overflow-hidden">
            <div className="h-full bg-[#8E315D]" style={{ width: `${summary.tolovlar.jami ? Math.round((summary.tolovlar.tolagan / summary.tolovlar.jami) * 100) : 0}%` }} />
          </div>
        </Link>
      )}
    </div>
  );
}
