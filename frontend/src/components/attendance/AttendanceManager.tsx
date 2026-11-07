"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { localIsoDate } from "@/lib/dates";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import AttendanceSheet from "@/components/attendance/AttendanceSheet";
import type { AttendanceDay, AttendanceRecordInput } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface AttendanceManagerProps<T extends AttendanceDay> {
  /** GET: /v1/teacher/dashboard yoki /v1/admin/attendance */
  loadPath: string;
  /** PUT: /v1/teacher/attendance yoki /v1/admin/attendance */
  savePath: string;
  noGroupsText: string;
  /** Har bir server javobidan keyin chaqiriladi. Barqaror funksiya bo'lishi shart (masalan, useState setter). */
  onLoaded?: (data: T) => void;
}

/** Sana va guruh tanlash, yuklash/xato/bo'sh holatlar va AttendanceSheet. Faqat real API. */
export default function AttendanceManager<T extends AttendanceDay>({
  loadPath, savePath, noGroupsText, onLoaded,
}: AttendanceManagerProps<T>) {
  const readOnly = useReadOnly();
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [date,    setDate]    = useState("");   // "" — server standarti (bugun)
  const [groupId, setGroupId] = useState("");   // "" — server standarti

  const load = useCallback(async (d: string, g: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (d) params.set("date", d);
    if (g) params.set("group_id", g);
    const qs = params.toString();
    try {
      const res = await api.get<T>(qs ? `${loadPath}?${qs}` : loadPath);
      setData(res);
      onLoaded?.(res);
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      // 403 matni server tomonidan aniq beriladi (masalan, "Tarbiyachi profili faol emas.")
      setError(e?.status === 403 && e.data?.message ? e.data.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadPath, onLoaded]);

  useEffect(() => { load(date, groupId); }, [load, date, groupId]);

  async function save(records: AttendanceRecordInput[]) {
    if (!data?.group) return;
    const res = await api.put<T>(savePath, { date: data.date, group_id: data.group.id, records });
    setData(res);
    onLoaded?.(res);
  }

  return (
    <div className="space-y-4">
      {data && data.groups.length > 0 && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {data.groups.length > 1 ? (
            <Select
              label={uz.davomat.guruh}
              value={groupId || String(data.group?.id ?? "")}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--text)] mb-1.5">{uz.davomat.guruh}</p>
              <p className="text-sm text-[#3D3240] py-2.5">{data.group?.name}</p>
            </div>
          )}
          <Input
            label={uz.davomat.sana}
            type="date"
            value={date || data.date}
            max={localIsoDate()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
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
        <div className={loading ? "opacity-60 pointer-events-none" : ""} aria-busy={loading}>
          {/* Ko'rish rejimi: belgilash va saqlash yopiq (backend ham rad etadi) */}
          <AttendanceSheet day={readOnly ? { ...data, editable: false } : data} onSave={save}
            lockedNote={readOnly ? uz.super_admin.faqat_korish : undefined} />
        </div>
      ) : null}
    </div>
  );
}
