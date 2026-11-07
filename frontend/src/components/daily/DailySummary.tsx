"use client";

import Badge from "@/components/ui/Badge";
import { attendanceBadge, childName, MEAL_LABELS } from "@/components/daily/dailyRules";
import { formatDuration } from "@/lib/dates";
import type { DailyChild, DailyDay } from "@/types";
import uz from "@/i18n/uz";

function mealsText(child: DailyChild): string {
  return child.meals.length > 0
    ? child.meals.map((m) => `${MEAL_LABELS[m.meal_type]} ${m.served_at}${m.ate === false ? ` (${uz.kundalik.ovqatlanmadi.toLowerCase()})` : ""}`).join(", ")
    : uz.kundalik.yozuv_yoq;
}

function sleepText(child: DailyChild): string {
  if (!child.sleep) return uz.kundalik.yozuv_yoq;
  return child.sleep.is_sleeping
    ? `${child.sleep.started_at} — ${uz.kundalik.hali_uxlayapti}`
    : `${child.sleep.started_at}–${child.sleep.ended_at}${formatDuration(child.sleep.started_at, child.sleep.ended_at) ? ` (${formatDuration(child.sleep.started_at, child.sleep.ended_at)})` : ""}`;
}

/** Guruhning bir kunlik umumiy ko'rinishi (faqat o'qish). */
export default function DailySummary({ day }: { day: DailyDay }) {
  const stats = [
    { label: uz.kundalik.jami_bola,      value: day.children.length },
    { label: uz.kundalik.keldi_soni,     value: day.children.filter((c) => c.attendance === "present").length },
    { label: uz.kundalik.ovqatlangan_soni, value: day.children.filter((c) => c.meals.some((m) => m.ate !== false)).length },
    { label: uz.kundalik.uxlayapti_soni, value: day.children.filter((c) => c.sleep?.is_sleeping).length },
    { label: uz.kundalik.qatnashgan_soni, value: new Set(day.activities.flatMap((a) => (a.participants ?? []).map((p) => p.id))).size },
    { label: uz.kundalik.mashgulot_soni, value: day.activities.length },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#EDE3E8] px-4 py-3">
            <dt className="text-xs text-[#766B73]">{s.label}</dt>
            <dd className="text-xl font-semibold text-[#29232A] mt-0.5">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {day.children.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#766B73]">{uz.kundalik.bola_yoq}</p>
        ) : (
          <>
            {/* Mobil (< sm) */}
            <ul className="sm:hidden divide-y divide-[#F2ECF0]">
              {day.children.map((c) => {
                const badge = attendanceBadge(c.attendance);
                return (
                  <li key={c.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#29232A]">{childName(c)}</p>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="text-xs text-[#766B73]">{uz.kundalik.ovqatlar}: {mealsText(c)}</p>
                    <p className="text-xs text-[#766B73]">{uz.kundalik.uyqu}: {sleepText(c)}</p>
                  </li>
                );
              })}
            </ul>

            {/* Kompyuter (sm+) */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.kundalik.bola}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.kundalik.davomat}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.kundalik.ovqatlar}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.kundalik.uyqu}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF0]">
                {day.children.map((c) => {
                  const badge = attendanceBadge(c.attendance);
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-3 font-medium text-[#29232A]">{childName(c)}</td>
                      <td className="px-5 py-3"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                      <td className="px-5 py-3 text-[#766B73]">{mealsText(c)}</td>
                      <td className="px-5 py-3 text-[#766B73]">{sleepText(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {day.activities.length > 0 && (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-4">
          <p className="text-sm font-semibold text-[#29232A] mb-2">{uz.kundalik.tab_mashgulot}</p>
          <ul className="space-y-1 text-sm text-[#3D3240]">
            {day.activities.map((a) => (
              <li key={a.id}>{a.starts_at ? `${a.starts_at} — ` : ""}{a.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
