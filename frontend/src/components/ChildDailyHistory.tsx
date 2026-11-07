"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { formatDuration, formatUzDate } from "@/lib/dates";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EXCUSE_REASON_LABELS } from "@/components/attendance/AttendanceSheet";
import { attendanceBadge, MEAL_LABELS } from "@/components/daily/dailyRules";
import type { ChildHistory } from "@/types";
import uz from "@/i18n/uz";

/** Bolaning oxirgi 14 kunlik tarixi: davomat (sababli izoh bilan), ovqatlanish, uyqu, mashg'ulotlar. */
export default function ChildDailyHistory({ childId }: { childId: number }) {
  const [data,    setData]    = useState<ChildHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get<ChildHistory>(`/v1/teacher/children/${id}/history`));
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(childId); }, [load, childId]);

  return (
    <section className="bg-white rounded-2xl border border-[#EDE3E8] p-5">
      <h2 className="text-sm font-semibold text-[#29232A] mb-3">{uz.guruh.tarix}</h2>
      {loading && !data ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <div className="text-sm">
          <p role="alert" className="text-[#B91C1C] mb-2">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => load(childId)}>{uz.common.qayta_urinish}</Button>
        </div>
      ) : !data || data.days.length === 0 ? (
        <p className="text-sm text-[#766B73]">{uz.guruh.tarix_yoq}</p>
      ) : (
        <ul className="divide-y divide-[#F2ECF0]" data-testid="child-history">
          {data.days.map((d) => {
            const badge = attendanceBadge(d.attendance);
            const sleep = d.sleep
              ? (d.sleep.is_sleeping ? `${d.sleep.started_at} — ${uz.kundalik.hali_uxlayapti}` : `${d.sleep.started_at}–${d.sleep.ended_at} (${formatDuration(d.sleep.started_at, d.sleep.ended_at) ?? ""})`)
              : uz.guruh.uyqu_yoq;
            return (
              <li key={d.date} className="py-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[#29232A]">{formatUzDate(d.date)}</p>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                {d.attendance === "excused" && (
                  <p className="text-xs text-[#92400E]">
                    {d.excuse_reason ? `${EXCUSE_REASON_LABELS[d.excuse_reason]}: ` : ""}{d.note}
                  </p>
                )}
                <p className="text-xs text-[#766B73]">
                  {uz.kundalik.ovqatlar}: {d.meals.length
                    ? d.meals.map((m) => `${MEAL_LABELS[m.meal_type]} ${m.served_at}${m.ate ? "" : ` (${uz.kundalik.ovqatlanmadi.toLowerCase()})`}`).join(", ")
                    : uz.guruh.ovqat_yoq}
                </p>
                <p className="text-xs text-[#766B73]">{uz.kundalik.uyqu}: {sleep}</p>
                {d.activities.length > 0 && (
                  <p className="text-xs text-[#766B73]">{uz.guruh.mashgulotlar}: {d.activities.map((a) => a.title).join(", ")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
