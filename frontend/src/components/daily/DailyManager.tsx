"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { localIsoDate } from "@/lib/dates";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import DailySummary from "@/components/daily/DailySummary";
import MealPanel from "@/components/daily/MealPanel";
import SleepPanel from "@/components/daily/SleepPanel";
import ActivityPanel from "@/components/daily/ActivityPanel";
import type { DailyDay } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

export type DailyBasePath = "/v1/teacher/daily" | "/v1/admin/daily";

type Tab = "hisobot" | "ovqat" | "uyqu" | "mashgulot";

const TABS: { id: Tab; label: string }[] = [
  { id: "hisobot",   label: uz.kundalik.tab_hisobot },
  { id: "ovqat",     label: uz.kundalik.tab_ovqat },
  { id: "uyqu",      label: uz.kundalik.tab_uyqu },
  { id: "mashgulot", label: uz.kundalik.tab_mashgulot },
];

interface DailyManagerProps {
  basePath:     DailyBasePath;
  noGroupsText: string;
}

/** Sana va guruh tanlash, yuklash/xato/bo'sh holatlar va kundalik bo'limlar. Faqat real API. */
export default function DailyManager({ basePath, noGroupsText }: DailyManagerProps) {
  const readOnly = useReadOnly();
  const [data,    setData]    = useState<DailyDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [date,    setDate]    = useState("");   // "" — server standarti (bugun)
  const [groupId, setGroupId] = useState("");   // "" — server standarti
  const [tab,     setTab]     = useState<Tab>("hisobot");
  const [notice,  setNotice]  = useState("");

  // Menyudan #ovqat, #uyqu, #mashgulot bilan kelinsa — shu bo'lim ochiladi
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
  }, []);

  const load = useCallback(async (d: string, g: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    const params = new URLSearchParams();
    if (d) params.set("date", d);
    if (g) params.set("group_id", g);
    const qs = params.toString();
    try {
      setData(await api.get<DailyDay>(qs ? `${basePath}?${qs}` : basePath));
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      // 403 matni server tomonidan aniq beriladi (masalan, "Tarbiyachi profili faol emas.")
      setError(e?.status === 403 && e.data?.message ? e.data.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { load(date, groupId); }, [load, date, groupId]);

  /** Yozish/o'chirish javobi — yangilangan kun ko'rinishi. */
  const applySaved = useCallback((day: DailyDay, message: string) => {
    setData(day);
    setNotice(message);
  }, []);

  const panelKey = data?.group ? `${data.group.id}-${data.date}` : "none";
  // Ko'rish rejimi: barcha panellar faqat ko'rish holatida (ovqat/uyqu/mashg'ulot yozilmaydi)
  const lock = (d: DailyDay): DailyDay => (readOnly ? { ...d, editable: false } : d);

  return (
    <div className="space-y-4">
      {data && data.groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          {data.groups.length > 1 ? (
            <Select
              label={uz.kundalik.guruh}
              value={groupId || String(data.group?.id ?? "")}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--text)] mb-1.5">{uz.kundalik.guruh}</p>
              <p className="text-sm text-[#3D3240] py-2.5">{data.group?.name}</p>
            </div>
          )}
          <Input
            label={uz.kundalik.sana}
            type="date"
            value={date || data.date}
            max={localIsoDate()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center">
          <p role="alert" className="text-sm text-[#766B73] mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => load(date, groupId)}>{uz.common.qayta_urinish}</Button>
        </div>
      ) : data && data.groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center">
          <p className="text-sm text-[#766B73]">{noGroupsText}</p>
        </div>
      ) : data ? (
        <div className={`space-y-4 ${loading ? "opacity-60 pointer-events-none" : ""}`} aria-busy={loading}>
          <div role="tablist" aria-label={uz.kundalik.sarlavha} className="flex gap-1 overflow-x-auto border-b border-[#EDE3E8] -mx-1 px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setNotice(""); }}
                className={`whitespace-nowrap px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[#766B73] hover:text-[#3D3240]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {notice && (
            <p role="status" className="rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{notice}</p>
          )}

          {!lock(data).editable && (
            <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-4 py-2.5">
              {readOnly ? uz.super_admin.faqat_korish : <>{uz.kundalik.faqat_korish} {uz.kundalik.tahrir_muddati}: {data.editable_from}</>}
            </p>
          )}

          <div role="tabpanel">
            {tab === "hisobot" && <DailySummary day={lock(data)} />}
            {tab === "ovqat" && <MealPanel key={panelKey} day={lock(data)} basePath={basePath} onSaved={applySaved} />}
            {tab === "uyqu" && <SleepPanel key={panelKey} day={lock(data)} basePath={basePath} onSaved={applySaved} />}
            {tab === "mashgulot" && <ActivityPanel day={lock(data)} basePath={basePath} onSaved={applySaved} />}
          </div>
        </div>
      ) : null}
    </div>
  );
}
