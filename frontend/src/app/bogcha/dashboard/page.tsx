"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
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
    pct === null     ? "bg-[#2563EB]" :
    pct >= 100       ? "bg-[#EF4444]" :
    pct >= 80        ? "bg-[#F59E0B]" :
                       "bg-[#22C55E]";

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] flex-shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">{group.name}</p>
            {group.age_category && (
              <p className="text-xs text-[#9CA3AF]">{group.age_category}</p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-[#111827]">
          {count}{capacity ? `/${capacity}` : ""}
        </span>
      </div>

      {pct !== null ? (
        <div>
          <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1.5">{pct}% {uz.guruhlar.sigim_korsatish}</p>
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF]">{count} {uz.dashboard.bola}</p>
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
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">
          {uz.dashboard.salom}, {firstName}!
        </h1>
        <p className="text-[#9CA3AF] mt-1 text-sm">{todayLabel()} · {uz.dashboard.bugungi_holat}</p>
      </div>

      {/* Stats */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-10">
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
            subtitle={uz.dashboard.jami_bolalar}
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
            <h2 className="text-base font-semibold text-[#111827]">{uz.dashboard.guruhlar_holati}</h2>
            <Link
              href="/bogcha/guruhlar"
              className="text-sm text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors"
            >
              Barchasini ko&apos;rish
            </Link>
          </div>
          {groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] py-10">
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

      {/* Attendance placeholder */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#111827]">{uz.dashboard.bugungi_davomat}</h2>
        </div>
        <EmptyState
          title={uz.dashboard.davomat_yoq}
          description={uz.dashboard.davomat_yoq_tavsif}
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
