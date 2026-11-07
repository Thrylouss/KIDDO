"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/apiErrors";
import { formatUzDate } from "@/lib/dates";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import type { AttendanceChild, AttendanceDay, AttendanceRecordInput, AttendanceState, ExcuseReason } from "@/types";
import uz from "@/i18n/uz";

interface AttendanceSheetProps {
  /** Berilsa — tahrirlash muddati o'rniga shu izoh ko'rsatiladi (masalan, Super Admin ko'rish rejimi) */
  lockedNote?: string;
  day: AttendanceDay;
  onSave: (records: AttendanceRecordInput[]) => Promise<void>;
}

const OPTIONS: { value: AttendanceState; label: string; on: string }[] = [
  { value: "present", label: uz.davomat.keldi,   on: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" },
  { value: "absent",  label: uz.davomat.kelmadi, on: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]" },
  { value: "excused", label: uz.davomat.sababli, on: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
];

export const EXCUSE_REASON_LABELS: Record<ExcuseReason, string> = {
  kasallik: uz.davomat.sabab_kasallik,
  oilaviy:  uz.davomat.sabab_oilaviy,
  boshqa:   uz.davomat.sabab_boshqa,
};

interface Entry {
  status: AttendanceState | null;
  reason: ExcuseReason | null;
  note:   string | null;
}

type Draft = Record<number, Entry>;

const fromDay = (day: AttendanceDay): Draft =>
  Object.fromEntries(day.children.map((c) => [c.id, { status: c.status, reason: c.excuse_reason ?? null, note: c.note }]));

const isChanged = (c: AttendanceChild, e: Entry) =>
  e.status != null && (e.status !== c.status || e.note !== c.note || e.reason !== (c.excuse_reason ?? null));

interface ExcuseForm {
  child:  AttendanceChild;
  reason: ExcuseReason | "";
  note:   string;
  errors: { reason?: string; note?: string };
}

export default function AttendanceSheet({ day, onSave, lockedNote }: AttendanceSheetProps) {
  const [draft,    setDraft]    = useState<Draft>(() => fromDay(day));
  const [draftFor, setDraftFor] = useState(day);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");
  const [excuse,   setExcuse]   = useState<ExcuseForm | null>(null);

  // Yangi server javobi (yuklash yoki saqlash) kelganda qoralama render paytida tiklanadi.
  // useEffect ishlatilmaydi: kechikkan effekt foydalanuvchining birinchi bosishini ustiga yozib yuborardi.
  if (draftFor !== day) {
    setDraftFor(day);
    setDraft(fromDay(day));
  }

  const changed = day.children.filter((c) => draft[c.id] && isChanged(c, draft[c.id]));
  // Ko'rsatkichlar faqat saqlangan holat — backend summary (dashboard bilan bir xil manba).
  // Saqlanmagan belgilashlar «Saqlanmagan o'zgarishlar» hisoblagichida alohida ko'rinadi.
  const saved = day.summary ?? {
    total:    day.children.length,
    present:  day.children.filter((c) => c.status === "present").length,
    absent:   day.children.filter((c) => c.status === "absent").length,
    excused:  day.children.filter((c) => c.status === "excused").length,
    unmarked: day.children.filter((c) => c.status == null).length,
  };
  const unmarkedInDraft = day.children.filter((c) => (draft[c.id]?.status ?? null) === null).length;

  function setStatus(child: AttendanceChild, status: AttendanceState) {
    if (!day.editable) return;
    setSuccess("");
    setError("");
    if (status === "excused") {
      // «Sababli» — sabab va izoh majburiy, modal orqali
      const current = draft[child.id];
      setExcuse({
        child,
        reason: current?.status === "excused" ? current.reason ?? "" : "",
        note:   current?.status === "excused" ? current.note ?? "" : "",
        errors: {},
      });
      return;
    }
    // Boshqa holatga o'tganda sababli izohi saqlanmaydi; aks holda mavjud izoh qoladi
    setDraft((d) => ({
      ...d,
      [child.id]: { status, reason: null, note: d[child.id]?.status === "excused" ? null : d[child.id]?.note ?? null },
    }));
  }

  function confirmExcuse(e: React.FormEvent) {
    e.preventDefault();
    if (!excuse) return;
    const note   = excuse.note.trim();
    const errors = {
      reason: excuse.reason ? undefined : uz.davomat.sabab_majburiy,
      note:   note ? undefined : uz.davomat.izoh_majburiy,
    };
    if (errors.reason || errors.note) {
      setExcuse({ ...excuse, errors });
      return;
    }
    setDraft((d) => ({ ...d, [excuse.child.id]: { status: "excused", reason: excuse.reason as ExcuseReason, note } }));
    setExcuse(null);
  }

  function markUnmarkedPresent() {
    if (!day.editable) return;
    setSuccess("");
    setDraft((d) => Object.fromEntries(Object.entries(d).map(([id, e]) => [id, e.status ? e : { ...e, status: "present" as AttendanceState }])));
  }

  async function save() {
    if (saving || !day.editable || changed.length === 0) return;
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await onSave(changed.map((c) => {
        const e = draft[c.id];
        return e.status === "excused"
          ? { child_id: c.id, status: "excused" as AttendanceState, excuse_reason: e.reason, note: e.note }
          : { child_id: c.id, status: e.status as AttendanceState, note: e.note };
      }));
      setSuccess(uz.davomat.saqlandi);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-[#EDE3E8] border-b border-[#EDE3E8]">
        {[
          { label: uz.davomat.jami,          value: saved.total,    id: "total"    },
          { label: uz.davomat.keldi,         value: saved.present,  id: "present"  },
          { label: uz.davomat.kelmadi,       value: saved.absent,   id: "absent"   },
          { label: uz.davomat.sababli,       value: saved.excused,  id: "excused"  },
          { label: uz.davomat.belgilanmagan, value: saved.unmarked, id: "unmarked" },
        ].map((s) => (
          <div key={s.id} className="bg-white px-4 py-3">
            <p className="text-[11px] text-[#B8AAB2] font-medium uppercase tracking-wide">{s.label}</p>
            <p data-testid={`count-${s.id}`} className="text-2xl font-bold text-[#29232A] leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {!day.editable && (
        <p role="note" className="px-5 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A] text-xs text-[#92400E]">
          {lockedNote ?? <>{uz.davomat.faqat_korish} {uz.davomat.tahrir_muddati}: {day.editable_from}</>}
        </p>
      )}

      {day.children.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#766B73]">{uz.davomat.bola_yoq}</p>
      ) : (
        <ul className="divide-y divide-[#F2ECF0]">
          {day.children.map((child) => {
            const entry   = draft[child.id];
            const current = entry?.status ?? null;
            const name    = `${child.last_name} ${child.first_name}`;
            return (
              <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#29232A] truncate">{name}</p>
                  {current === "excused" && entry?.note ? (
                    <p data-testid={`excuse-${child.id}`} className="text-xs text-[#92400E] truncate">
                      {entry.reason ? `${EXCUSE_REASON_LABELS[entry.reason]}: ` : ""}{entry.note}
                    </p>
                  ) : entry?.note ? (
                    <p className="text-xs text-[#766B73] truncate">{entry.note}</p>
                  ) : null}
                </div>
                <div role="group" aria-label={name} className="flex gap-1.5">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      data-testid={`status-${child.id}-${o.value}`}
                      aria-pressed={current === o.value}
                      disabled={!day.editable || saving}
                      onClick={() => setStatus(child, o.value)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:cursor-not-allowed ${
                        current === o.value ? o.on : "bg-white text-[#766B73] border-[#EDE3E8] hover:bg-[#FAF5F8]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {day.editable && day.children.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-[#EDE3E8] bg-[#FAF5F8]">
          <Button size="sm" variant="secondary" disabled={saving || unmarkedInDraft === 0} onClick={markUnmarkedPresent}>
            {uz.davomat.barchasi_keldi}
          </Button>
          <span className="flex-1" />
          {changed.length > 0 && (
            <span data-testid="unsaved" className="text-xs text-[#92400E]">{uz.davomat.ozgarishlar}: {changed.length}</span>
          )}
          <Button size="sm" loading={saving} disabled={changed.length === 0} onClick={save}>
            {uz.davomat.saqlash}
          </Button>
        </div>
      )}

      <Modal
        open={!!excuse}
        onClose={() => setExcuse(null)}
        title={uz.davomat.sababli_sarlavha}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExcuse(null)}>{uz.common.bekor_qilish}</Button>
            <Button form="excuse-form" type="submit">{uz.common.saqlash}</Button>
          </>
        }
      >
        {excuse && (
          <form id="excuse-form" onSubmit={confirmExcuse} className="space-y-4" noValidate>
            <div className="rounded-lg bg-[#FAF5F8] px-3 py-2 text-sm">
              <p className="font-medium text-[#29232A]">{excuse.child.last_name} {excuse.child.first_name}</p>
              <p className="text-xs text-[#766B73]">{formatUzDate(day.date)}</p>
            </div>
            <Select
              id="excuse-reason"
              label={uz.davomat.sabab}
              value={excuse.reason}
              onChange={(e) => setExcuse({ ...excuse, reason: e.target.value as ExcuseReason | "", errors: { ...excuse.errors, reason: undefined } })}
              error={excuse.errors.reason}
              required
            >
              <option value="">{uz.common.tanlang}</option>
              {(Object.keys(EXCUSE_REASON_LABELS) as ExcuseReason[]).map((r) => (
                <option key={r} value={r}>{EXCUSE_REASON_LABELS[r]}</option>
              ))}
            </Select>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="excuse-note" className="text-sm font-medium text-[var(--text)]">
                {uz.davomat.izoh} <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                id="excuse-note"
                rows={3}
                maxLength={255}
                value={excuse.note}
                placeholder={uz.davomat.izoh_placeholder}
                onChange={(e) => setExcuse({ ...excuse, note: e.target.value, errors: { ...excuse.errors, note: undefined } })}
                aria-invalid={!!excuse.errors.note}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#29232A] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 ${excuse.errors.note ? "border-[#EF4444]" : "border-[#EDE3E8]"}`}
              />
              {excuse.errors.note && <p className="text-xs text-[#B91C1C]">{excuse.errors.note}</p>}
            </div>
          </form>
        )}
      </Modal>

      {(success || error) && (
        <p role={error ? "alert" : "status"} className={`px-5 py-2.5 text-sm ${error ? "text-[#B91C1C]" : "text-[var(--success)]"}`}>
          {error || success}
        </p>
      )}
    </div>
  );
}
