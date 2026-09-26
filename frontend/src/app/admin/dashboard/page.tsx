"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type { PlatformSummary, OrganizationSummary } from "@/types";

function formatMoney(amount: number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "info" | "error" }> = {
    active:   { label: uz.super_admin.faol,            variant: "success" },
    trial:    { label: uz.super_admin.sinov,           variant: "info" },
    past_due: { label: uz.super_admin.past_due,        variant: "warning" },
    expired:  { label: uz.super_admin.muddati_tugagan, variant: "error" },
    cancelled: { label: uz.super_admin.bekor,          variant: "neutral" },
  };
  const info = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function RecentOrgRow({ org }: { org: OrganizationSummary }) {
  return (
    <tr className="hover:bg-[#F9FAFB] transition-colors duration-100">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] font-semibold text-xs flex-shrink-0">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#111827] text-sm">{org.name}</p>
            <p className="text-xs text-[#9CA3AF]">{org.phone ?? "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 hidden sm:table-cell">
        {org.subscription ? (
          <SubscriptionStatusBadge status={org.subscription.status} />
        ) : (
          <span className="text-[#D1D5DB] text-sm">—</span>
        )}
      </td>
      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-[#6B7280]">
        {org.subscription?.plan?.name ?? "—"}
      </td>
      <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-[#6B7280]">
        {org.subscription?.days_remaining != null
          ? `${org.subscription.days_remaining} ${uz.super_admin.qolgan_kun}`
          : "—"}
      </td>
      <td className="px-5 py-3.5">
        <Link
          href={`/admin/bogchalar/${org.id}`}
          className="text-sm text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors"
        >
          Ko&apos;rish
        </Link>
      </td>
    </tr>
  );
}

export default function SuperAdminDashboardPage() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<PlatformSummary>("/v1/super-admin/dashboard");
      setSummary(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">
          Xayrli kun, Admin!
        </h1>
        <p className="text-[#9CA3AF] mt-1 text-sm">{uz.super_admin.platforma_holati}</p>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={uz.super_admin.jami_bogchalar}
              value={summary?.jami_bogchalar ?? 0}
              subtitle="Jami ro'yxatdagi bog'chalar"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <StatCard
              title={uz.super_admin.faol_bogchalar}
              value={summary?.faol_bogchalar ?? 0}
              subtitle="Faol bog'chalar"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              title={uz.super_admin.muddati_yaqin}
              value={summary?.muddati_yaqin ?? 0}
              subtitle="14 kun ichida tugaydi"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              title={uz.super_admin.tolov_kutilmoqda}
              value={summary?.tolov_kutilmoqda ?? 0}
              subtitle="To'lov kutilmoqda"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Subscription status section */}
          {summary?.obuna_holati && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
              <h2 className="text-base font-semibold text-[#111827] mb-4">{uz.super_admin.obuna_holati}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: "active",   label: uz.super_admin.faol,            color: "bg-[#DCFCE7] text-[#166534]" },
                  { key: "trial",    label: uz.super_admin.sinov,           color: "bg-[#DBEAFE] text-[#1E40AF]" },
                  { key: "past_due", label: uz.super_admin.past_due,        color: "bg-[#FEF9C3] text-[#854D0E]" },
                  { key: "expired",  label: uz.super_admin.muddati_tugagan, color: "bg-[#FEE2E2] text-[#991B1B]" },
                  { key: "cancelled", label: uz.super_admin.bekor,          color: "bg-[#F3F4F6] text-[#374151]" },
                ].map(({ key, label, color }) => (
                  <div key={key} className="text-center">
                    <div className={`text-2xl font-bold mb-1 px-3 py-2 rounded-lg ${color}`}>
                      {summary.obuna_holati[key as keyof typeof summary.obuna_holati]}
                    </div>
                    <p className="text-xs text-[#6B7280]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing KPIs */}
          {summary?.billing && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-2">MRR</p>
                <p className="text-2xl font-bold text-[#111827]">{formatMoney(summary.billing.mrr)}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Oylik takrorlanuvchi daromad</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-2">ARR</p>
                <p className="text-2xl font-bold text-[#111827]">{formatMoney(summary.billing.arr)}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Yillik takrorlanuvchi daromad</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-2">Shu oy</p>
                <p className="text-2xl font-bold text-[#111827]">{formatMoney(summary.billing.monthly_revenue)}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Joriy oy tushumlari</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-2">Kutilayotgan</p>
                <p className="text-2xl font-bold text-[#111827]">{formatMoney(summary.billing.pending_revenue)}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Kutilayotgan to&apos;lovlar</p>
              </div>
            </div>
          )}

          {/* Recent orgs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#111827]">{uz.super_admin.oxirgi_bogchalar}</h2>
              <Link
                href="/admin/bogchalar"
                className="text-sm text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors"
              >
                Barchasini ko&apos;rish
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              {(summary?.oxirgi_bogchalar ?? []).length === 0 ? (
                <EmptyState
                  title="Hali bog'cha yo'q"
                  description="Birinchi bog'chani qo'shing."
                  icon={
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  }
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Bog&apos;cha</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">{uz.super_admin.obuna}</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden md:table-cell">{uz.super_admin.tarif}</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden lg:table-cell">Qolgan</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {summary?.oxirgi_bogchalar.map((org) => (
                      <RecentOrgRow key={org.id} org={org} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
