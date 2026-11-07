"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { formatDuration } from "@/lib/dates";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { attendanceBadge, canRecord, childName, recordErrors } from "@/components/daily/dailyRules";
import type { DailyBasePath } from "@/components/daily/DailyManager";
import type { DailyChild, DailyDay, DailySleep } from "@/types";
import uz from "@/i18n/uz";

interface SleepPanelProps {
  day:      DailyDay;
  basePath: DailyBasePath;
  onSaved:  (day: DailyDay, message: string) => void;
}

interface Draft {
  started_at: string;
  ended_at:   string;
  note:       string;
}

function draftOf(sleep: DailySleep | null): Draft {
  return { started_at: sleep?.started_at ?? "", ended_at: sleep?.ended_at ?? "", note: sleep?.note ?? "" };
}

const timeCls = "w-full rounded-lg border border-[#EDE3E8] bg-white px-2.5 py-1.5 text-sm text-[#29232A] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:bg-[#FAF5F8] disabled:text-[#B8AAB2]";

/** Har bir «Keldi» bola uchun kuniga bitta uyqu: uxladi / uyg'ondi (bo'sh — «Hali uxlayapti»). */
export default function SleepPanel({ day, basePath, onSaved }: SleepPanelProps) {
  const [drafts,    setDrafts]    = useState<Record<number, Draft>>(() =>
    Object.fromEntries(day.children.map((c) => [c.id, draftOf(c.sleep)])));
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd,   setBulkEnd]   = useState("");
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error,     setError]     = useState("");
  const [rules,     setRules]     = useState<string[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<{ sleep: DailySleep; name: string } | null>(null);
  const inFlight = useRef(false);

  const eligible = day.children.filter(canRecord);
  const disabled = !day.editable;

  function update(id: number, field: keyof Draft, value: string) {
    setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], [field]: value } }));
  }

  function applyBulkStart() {
    if (!bulkStart) return;
    setDrafts((cur) => {
      const next = { ...cur };
      for (const c of eligible) {
        if (!next[c.id].started_at) next[c.id] = { ...next[c.id], started_at: bulkStart };
      }
      return next;
    });
  }

  /** Uxlash vaqti bor, uyg'onish vaqti yo'q «Keldi» bolalarga bir xil uyg'onish vaqti. */
  function applyBulkEnd() {
    if (!bulkEnd) return;
    setDrafts((cur) => {
      const next = { ...cur };
      for (const c of eligible) {
        const d = next[c.id];
        if (d.started_at && !d.ended_at && bulkEnd > d.started_at) next[c.id] = { ...d, ended_at: bulkEnd };
      }
      return next;
    });
  }

  function changed(c: DailyChild): boolean {
    const d = drafts[c.id], o = draftOf(c.sleep);
    return d.started_at !== o.started_at || d.ended_at !== o.ended_at || d.note !== o.note;
  }

  async function save() {
    if (inFlight.current || disabled || !day.group) return;
    setError("");
    setRules([]);

    const rows = eligible.filter(changed);
    const local: Record<number, string> = {};
    for (const c of rows) {
      const d = drafts[c.id];
      if (!d.started_at) local[c.id] = uz.kundalik.boshlanish_kerak;
      else if (d.ended_at && d.ended_at <= d.started_at) local[c.id] = uz.kundalik.tugash_xato;
    }
    setRowErrors(local);
    if (Object.keys(local).length > 0) return;
    if (rows.length === 0) {
      setError(uz.kundalik.ozgarish_yoq);
      return;
    }

    inFlight.current = true;
    setSaving(true);
    try {
      const res = await api.put<DailyDay>(`${basePath}/sleep`, {
        date:     day.date,
        group_id: day.group.id,
        records:  rows.map((c) => ({
          child_id:   c.id,
          started_at: drafts[c.id].started_at,
          ended_at:   drafts[c.id].ended_at || null,
          note:       drafts[c.id].note.trim() || null,
        })),
      });
      setDrafts(Object.fromEntries(res.children.map((c) => [c.id, draftOf(c.sleep)])));
      onSaved(res, uz.kundalik.uyqu_saqlandi);
    } catch (err: unknown) {
      // records.{i}.started_at / ended_at — yuborilgan qator tartibi bo'yicha bolaga bog'lanadi
      const e = err as { status?: number; data?: { errors?: Record<string, string[]> } };
      const server: Record<number, string> = {};
      for (const [key, messages] of Object.entries(e?.status === 422 ? e.data?.errors ?? {} : {})) {
        const m = key.match(/^records\.(\d+)\./);
        if (m && rows[Number(m[1])]) server[rows[Number(m[1])].id] = messages[0];
      }
      setRowErrors(server);
      setRules(recordErrors(err));
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await api.delete<DailyDay>(`${basePath}/sleep/${deleting.sleep.id}`);
    setDeleting(null);
    setDrafts(Object.fromEntries(res.children.map((c) => [c.id, draftOf(c.sleep)])));
    onSaved(res, uz.kundalik.uyqu_ochirildi);
  }

  if (day.children.length === 0) {
    return <p className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center text-sm text-[#766B73]">{uz.kundalik.bola_yoq}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#766B73]">{uz.kundalik.qoida} {uz.kundalik.tugash_izoh}.</p>

      {eligible.length > 0 && !disabled && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-[#3D3240]">
            <span className="block mb-1">{uz.kundalik.hammaga_boshlanish}</span>
            <input type="time" aria-label={uz.kundalik.hammaga_boshlanish} value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className={timeCls} />
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={applyBulkStart} disabled={!bulkStart}>{uz.common.tasdiqlash}</Button>
          <label className="text-sm text-[#3D3240] sm:ml-4">
            <span className="block mb-1">{uz.kundalik.hammaga_tugash}</span>
            <input type="time" aria-label={uz.kundalik.hammaga_tugash} value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className={timeCls} />
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={applyBulkEnd} disabled={!bulkEnd} aria-label={`${uz.common.tasdiqlash}: ${uz.kundalik.hammaga_tugash}`}>
            {uz.common.tasdiqlash}
          </Button>
        </div>
      )}

      <ul className="bg-white rounded-xl border border-[#EDE3E8] divide-y divide-[#F2ECF0]">
        {day.children.map((c) => {
          const allowed = canRecord(c);
          const badge   = attendanceBadge(c.attendance);
          const d       = drafts[c.id];
          const name    = childName(c);
          return (
            <li key={c.id} className="px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-[#29232A] text-sm flex-1">{name}</p>
                {c.sleep?.is_sleeping && <Badge variant="info">{uz.kundalik.hali_uxlayapti}</Badge>}
                {!allowed && <Badge variant={badge.variant}>{badge.label}</Badge>}
                {c.sleep && day.editable && (
                  <Button size="sm" variant="ghost" aria-label={`${uz.kundalik.uyqu_ochirish}: ${name}`} onClick={() => setDeleting({ sleep: c.sleep!, name })}>
                    {uz.common.ochirish}
                  </Button>
                )}
              </div>

              {allowed ? (
                <div className="grid grid-cols-2 sm:grid-cols-[8rem_8rem_1fr] gap-2">
                  <label className="text-xs text-[#766B73]">
                    {uz.kundalik.boshlanish}
                    <input type="time" aria-label={`${uz.kundalik.boshlanish}: ${name}`} value={d.started_at} disabled={disabled}
                      onChange={(e) => update(c.id, "started_at", e.target.value)} className={`${timeCls} mt-1`} />
                  </label>
                  <label className="text-xs text-[#766B73]">
                    {uz.kundalik.tugash}
                    <input type="time" aria-label={`${uz.kundalik.tugash}: ${name}`} value={d.ended_at} disabled={disabled}
                      onChange={(e) => update(c.id, "ended_at", e.target.value)} className={`${timeCls} mt-1`} />
                  </label>
                  <label className="text-xs text-[#766B73] col-span-2 sm:col-span-1">
                    {uz.kundalik.izoh}
                    <input type="text" aria-label={`${uz.kundalik.izoh}: ${name}`} value={d.note} maxLength={255} disabled={disabled}
                      onChange={(e) => update(c.id, "note", e.target.value)} className={`${timeCls} mt-1`} />
                  </label>
                </div>
              ) : c.sleep ? (
                <p className="text-xs text-[#92400E]">
                  {c.sleep.started_at}{c.sleep.ended_at ? `–${c.sleep.ended_at}` : ""} · {uz.kundalik.davomat_ozgargan}
                </p>
              ) : null}

              {allowed && formatDuration(d.started_at, d.ended_at) && (
                <p className="text-xs text-[#766B73]">{uz.kundalik.davomiylik}: {formatDuration(d.started_at, d.ended_at)}</p>
              )}
              {rowErrors[c.id] && <p className="text-xs text-[#B91C1C]">{rowErrors[c.id]}</p>}
            </li>
          );
        })}
      </ul>

      {(error || rules.length > 0) && (
        <div role="alert" className="text-sm text-[#B91C1C] space-y-1">
          {error && <p>{error}</p>}
          {rules.map((r) => <p key={r}>{r}</p>)}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={disabled || eligible.length === 0}>{uz.kundalik.uyqu_saqlash}</Button>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={`${uz.kundalik.uyqu_ochirish}: ${deleting?.name ?? ""}`}
        message={uz.kundalik.uyqu_ochirish_tasdiq}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
