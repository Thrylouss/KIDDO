"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { formatDuration } from "@/lib/dates";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { canRecord, childName, DIRECTION_LABELS, recordErrors } from "@/components/daily/dailyRules";
import type { DailyBasePath } from "@/components/daily/DailyManager";
import type { ActivityDirection, DailyActivity, DailyDay } from "@/types";
import uz from "@/i18n/uz";

interface ActivityPanelProps {
  day:      DailyDay;
  basePath: DailyBasePath;
  onSaved:  (day: DailyDay, message: string) => void;
}

interface ActivityForm {
  title:       string;
  direction:   ActivityDirection | "";
  starts_at:   string;
  ends_at:     string;
  description: string;
  result:      string;
  child_ids:   number[];
}

const emptyForm: ActivityForm = { title: "", direction: "", starts_at: "", ends_at: "", description: "", result: "", child_ids: [] };

const textareaCls = "w-full rounded-lg border border-[#EDE3E8] bg-white px-3 py-2 text-sm text-[#29232A] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30";

/** Guruh mashg'ulotlari: yo'nalish, vaqt va davomiylik, ishtirokchilar («Keldi» bolalar), tavsif va natija. */
export default function ActivityPanel({ day, basePath, onSaved }: ActivityPanelProps) {
  const [editing,  setEditing]  = useState<DailyActivity | "new" | null>(null);
  const [form,     setForm]     = useState<ActivityForm>(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string[]>>({});
  const [error,    setError]    = useState("");
  const [rules,    setRules]    = useState<string[]>([]);
  const [deleting, setDeleting] = useState<DailyActivity | null>(null);
  const inFlight = useRef(false);

  const present = day.children.filter(canRecord);

  function open(activity: DailyActivity | "new") {
    setEditing(activity);
    setForm(activity === "new" ? { ...emptyForm, child_ids: present.map((c) => c.id) } : {
      title:       activity.title,
      direction:   activity.direction ?? "",
      starts_at:   activity.starts_at ?? "",
      ends_at:     activity.ends_at ?? "",
      description: activity.description ?? "",
      result:      activity.result ?? "",
      child_ids:   (activity.participants ?? []).map((p) => p.id),
    });
    setErrors({});
    setError("");
    setRules([]);
  }

  function close() {
    if (inFlight.current) return;
    setEditing(null);
  }

  function clearTimeError() {
    setErrors((cur) => { const next = { ...cur }; delete next.ends_at; return next; });
  }

  function toggleChild(id: number) {
    setForm((f) => ({ ...f, child_ids: f.child_ids.includes(id) ? f.child_ids.filter((x) => x !== id) : [...f.child_ids, id] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || !editing || !day.group) return;
    if (form.ends_at && (!form.starts_at || form.ends_at <= form.starts_at)) {
      setErrors({ ends_at: [uz.kundalik.tugash_xato_mashgulot] });
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setErrors({});
    setError("");
    setRules([]);
    const body = {
      title:       form.title.trim(),
      direction:   form.direction || null,
      starts_at:   form.starts_at || null,
      ends_at:     form.ends_at || null,
      description: form.description.trim() || null,
      result:      form.result.trim() || null,
      // Faqat hozir ham «Keldi» bo'lgan bolalar yuboriladi
      child_ids:   form.child_ids.filter((id) => present.some((c) => c.id === id)),
    };
    try {
      const res = editing === "new"
        ? await api.post<DailyDay>(`${basePath}/activities`, { date: day.date, group_id: day.group.id, ...body })
        : await api.put<DailyDay>(`${basePath}/activities/${editing.id}`, body);
      setEditing(null);
      onSaved(res, editing === "new" ? uz.kundalik.mashgulot_qoshildi : uz.kundalik.mashgulot_yangilandi);
    } catch (err: unknown) {
      setErrors(fieldErrors(err));
      setRules(recordErrors(err));
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await api.delete<DailyDay>(`${basePath}/activities/${deleting.id}`);
    setDeleting(null);
    onSaved(res, uz.kundalik.mashgulot_ochirildi);
  }

  const duration = formatDuration(form.starts_at, form.ends_at || null);

  return (
    <div className="space-y-4">
      {day.editable && (
        <div className="flex justify-end">
          <Button onClick={() => open("new")}>{uz.kundalik.mashgulot_qoshish}</Button>
        </div>
      )}

      {day.activities.length === 0 ? (
        <p className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center text-sm text-[#766B73]">{uz.kundalik.mashgulot_yoq}</p>
      ) : (
        <ul className="bg-white rounded-xl border border-[#EDE3E8] divide-y divide-[#F2ECF0]">
          {day.activities.map((a) => {
            const d = a.starts_at ? formatDuration(a.starts_at, a.ends_at) : null;
            return (
              <li key={a.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-[#29232A] text-sm">
                    {a.starts_at && <span className="text-[var(--primary)] mr-2">{a.starts_at}{a.ends_at ? `–${a.ends_at}` : ""}</span>}
                    {a.title}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {a.direction && <Badge variant="info">{DIRECTION_LABELS[a.direction]}</Badge>}
                    {d && <span className="text-[#766B73]">{uz.kundalik.davomiyligi}: {d}</span>}
                    <span className="text-[#766B73]">{uz.kundalik.ishtirokchilar}: {(a.participants ?? []).length} {uz.kundalik.nafar}</span>
                  </div>
                  {a.description && <p className="text-sm text-[#766B73] whitespace-pre-line break-words">{a.description}</p>}
                  {a.result && <p className="text-sm text-[#3D3240] whitespace-pre-line break-words"><span className="font-medium">{uz.kundalik.natija.replace(" (ixtiyoriy)", "")}:</span> {a.result}</p>}
                </div>
                {day.editable && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" aria-label={`${uz.common.tahrirlash}: ${a.title}`} onClick={() => open(a)}>{uz.common.tahrirlash}</Button>
                    <Button size="sm" variant="ghost" aria-label={`${uz.common.ochirish}: ${a.title}`} onClick={() => setDeleting(a)}>{uz.common.ochirish}</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!editing}
        onClose={close}
        title={editing === "new" ? uz.kundalik.mashgulot_qoshish : uz.kundalik.mashgulot_tahrirlash}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>{uz.common.bekor_qilish}</Button>
            <Button form="activity-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="activity-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="activity-title" label={uz.kundalik.nomi} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title?.[0]} maxLength={150} required />
            <Select id="activity-direction" label={uz.kundalik.yonalish} value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as ActivityDirection | "" })} error={errors.direction?.[0]}>
              <option value="">{uz.kundalik.yonalish_tanlang}</option>
              {(Object.keys(DIRECTION_LABELS) as ActivityDirection[]).map((d) => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
            </Select>
            <Input id="activity-starts-at" label={uz.kundalik.boshlanish_vaqti} type="time" value={form.starts_at}
              onChange={(e) => { setForm({ ...form, starts_at: e.target.value }); clearTimeError(); }} error={errors.starts_at?.[0]} />
            <Input id="activity-ends-at" label={uz.kundalik.tugash_vaqti} type="time" value={form.ends_at}
              onChange={(e) => { setForm({ ...form, ends_at: e.target.value }); clearTimeError(); }} error={errors.ends_at?.[0]}
              hint={duration ? `${uz.kundalik.davomiyligi}: ${duration}` : undefined} />
          </div>

          <div role="group" aria-labelledby="activity-children-label">
            <p id="activity-children-label" className="text-sm font-medium text-[var(--text)]">{uz.kundalik.ishtirokchilar}</p>
            <p className="text-xs text-[#766B73] mb-2">{uz.kundalik.ishtirokchi_izoh}</p>
            {present.length === 0 ? (
              <p className="text-sm text-[#B8AAB2]">{uz.kundalik.qoida}</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {present.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-[#29232A]">
                      <input type="checkbox" checked={form.child_ids.includes(c.id)} onChange={() => toggleChild(c.id)} />
                      {childName(c)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-description" className="text-sm font-medium text-[var(--text)]">{uz.kundalik.tavsif}</label>
            <textarea id="activity-description" rows={3} maxLength={1000} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} className={textareaCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activity-result" className="text-sm font-medium text-[var(--text)]">{uz.kundalik.natija}</label>
            <textarea id="activity-result" rows={2} maxLength={1000} value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })} className={textareaCls} />
            {errors.result?.[0] && <p className="text-xs text-[#B91C1C]">{errors.result[0]}</p>}
          </div>
          {(error || rules.length > 0) && (
            <div role="alert" className="text-sm text-[#B91C1C] space-y-1">
              {error && <p>{error}</p>}
              {rules.map((r) => <p key={r}>{r}</p>)}
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`${uz.kundalik.mashgulot_ochirish}: ${deleting?.title ?? ""}`}
        message={uz.kundalik.mashgulot_ochirish_tasdiq}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
