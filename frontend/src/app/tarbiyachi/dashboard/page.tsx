"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import uz from "@/i18n/uz";
import type { TeacherDashboardData } from "@/lib/demo-data";

const UZ_MONTHS = [
  "yanvar","fevral","mart","aprel","may","iyun",
  "iyul","avgust","sentabr","oktabr","noyabr","dekabr",
];
function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#EDE3E8] rounded-lg ${className ?? ""}`} />;
}

export default function TarbiyachiDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<TeacherDashboardData>("/v1/teacher/dashboard");
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const firstName = user?.name?.split(" ")[0] ?? "Tarbiyachi";

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#29232A]">
          {uz.tarbiyachi_panel.xayrli_kun}, {firstName}!
        </h1>
        <p className="text-[#B8AAB2] mt-1 text-sm">{todayLabel()}</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-10 text-center">
          <p className="text-sm text-[#766B73] mb-3">{uz.common.yuklash_xatosi}</p>
          <button onClick={load} className="text-sm text-[#8E315D] hover:underline font-medium">{uz.common.qayta_urinish}</button>
        </div>
      ) : data && (
        <>
          {/* Group card */}
          <div className="bg-[#8E315D] rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">{uz.tarbiyachi_panel.mening_guruhim}</p>
                  <h2 className="text-xl font-bold">{data.group.name}</h2>
                  <p className="text-white/70 text-sm mt-0.5">{data.group.age_category} · {uz.tarbiyachi_panel.yosh_oralighi}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
              <p className="text-white/60 text-xs mt-3">{data.group.capacity} {uz.tarbiyachi_panel.bolalar_soni} · {data.teacher.position}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: uz.tarbiyachi_panel.jami_bolalar, value: data.today.total,   color: "text-[#29232A]",  bg: "bg-white" },
              { label: uz.tarbiyachi_panel.keldi,         value: data.today.present, color: "text-[#166534]",  bg: "bg-[#DCFCE7]" },
              { label: uz.tarbiyachi_panel.kelmadi,       value: data.today.absent,  color: "text-[#991B1B]",  bg: "bg-[#FEE2E2]" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl border border-[#EDE3E8] p-4 flex flex-col gap-1`}>
                <p className="text-xs text-[#B8AAB2] font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold leading-none ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Attendance list */}
          <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE3E8] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#29232A]">{uz.tarbiyachi_panel.bugungi_davomat}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-full">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Demo
              </span>
            </div>
            <div className="px-5 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A]">
              <p className="text-xs text-[#92400E]">{uz.tarbiyachi_panel.demo_xabar}</p>
            </div>
            <div className="divide-y divide-[#F2ECF0]">
              {data.today.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] font-semibold text-xs flex-shrink-0">
                      {child.first_name.charAt(0)}
                    </div>
                    <span className="text-sm text-[#29232A] font-medium">{child.first_name} {child.last_name}</span>
                  </div>
                  {child.status === "present" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#166534] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {uz.tarbiyachi_panel.keldi}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#991B1B] bg-[#FEE2E2] px-2.5 py-1 rounded-full">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      {uz.tarbiyachi_panel.kelmadi}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Daily schedule */}
          <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE3E8]">
              <h2 className="text-sm font-semibold text-[#29232A]">{uz.tarbiyachi_panel.kun_tartibi}</h2>
            </div>
            <div className="p-5">
              <div className="relative">
                <div className="absolute left-[52px] top-2 bottom-2 w-px bg-[#EDE3E8]" />
                <div className="space-y-3">
                  {data.schedule.map((item, i) => {
                    const now = new Date();
                    const [h, m] = item.time.split(":").map(Number);
                    const itemMinutes = h * 60 + m;
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const isPast = itemMinutes < nowMinutes;
                    const isCurrent = i < data.schedule.length - 1
                      ? (() => {
                          const [nh, nm] = data.schedule[i + 1].time.split(":").map(Number);
                          const nextMinutes = nh * 60 + nm;
                          return itemMinutes <= nowMinutes && nowMinutes < nextMinutes;
                        })()
                      : itemMinutes <= nowMinutes;

                    return (
                      <div key={i} className="flex items-center gap-4 relative">
                        <span className={`text-xs font-mono w-11 text-right flex-shrink-0 ${isCurrent ? "text-[#8E315D] font-bold" : isPast ? "text-[#B8AAB2]" : "text-[#766B73]"}`}>
                          {item.time}
                        </span>
                        <div className={`relative z-10 h-2.5 w-2.5 rounded-full flex-shrink-0 border-2 ${
                          isCurrent ? "bg-[#8E315D] border-[#8E315D] ring-2 ring-[#8E315D]/20" :
                          isPast    ? "bg-[#EDE3E8] border-[#EDE3E8]" :
                                      "bg-white border-[#EDE3E8]"
                        }`} />
                        <span className={`text-sm ${isCurrent ? "font-semibold text-[#8E315D]" : isPast ? "text-[#B8AAB2]" : "text-[#3D3240]"}`}>
                          {item.activity}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto text-[10px] font-semibold text-[#8E315D] bg-[#FDF2F6] px-1.5 py-0.5 rounded-full flex-shrink-0">Hozir</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Meals — coming soon */}
          <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDE3E8] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#29232A]">{uz.tarbiyachi_panel.ovqatlanish_jadvali}</h2>
              <span className="text-[10px] font-medium text-[var(--text-3)] bg-[var(--border-2)] px-1.5 py-0.5 rounded-full leading-none">
                {uz.common.tez_kunda}
              </span>
            </div>
            <div className="px-5 py-8 text-center">
              <div className="h-10 w-10 rounded-xl bg-[#FDF2F6] flex items-center justify-center mx-auto mb-3">
                <svg className="h-5 w-5 text-[#8E315D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#3D3240]">Ovqatlanish moduli</p>
              <p className="text-xs text-[#B8AAB2] mt-1">Tez kunda qo&apos;shiladi</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
