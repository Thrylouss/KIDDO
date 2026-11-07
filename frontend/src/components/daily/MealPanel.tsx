"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { attendanceBadge, canRecord, childName, MEAL_LABELS, recordErrors } from "@/components/daily/dailyRules";
import type { DailyBasePath } from "@/components/daily/DailyManager";
import type { DailyDay, DailyMeal, MealType } from "@/types";
import uz from "@/i18n/uz";

interface MealPanelProps {
  day:      DailyDay;
  basePath: DailyBasePath;
  onSaved:  (day: DailyDay, message: string) => void;
}

/** Tanlangan «Keldi» bolalarga bir xil ovqat turi va vaqtini yozish; mavjud yozuvlar va o'chirish. */
export default function MealPanel({ day, basePath, onSaved }: MealPanelProps) {
  const eligible = day.children.filter(canRecord);

  const [mealType, setMealType] = useState<MealType>(day.meal_types[0] ?? "nonushta");
  const [servedAt, setServedAt] = useState("");
  const [note,     setNote]     = useState("");
  const [selected, setSelected] = useState<number[]>(() => eligible.map((c) => c.id));
  // Bola bo'yicha: ovqatlanmadi belgisi va alohida izoh
  const [notAte,   setNotAte]   = useState<Record<number, boolean>>({});
  const [rowNotes, setRowNotes] = useState<Record<number, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string[]>>({});
  const [error,    setError]    = useState("");
  const [rules,    setRules]    = useState<string[]>([]);
  const [deleting, setDeleting] = useState<{ meal: DailyMeal; name: string } | null>(null);
  const inFlight = useRef(false);

  const disabled = !day.editable;

  function toggle(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || disabled || !day.group) return;
    setErrors({});
    setRules([]);
    // Faqat hozir ham «Keldi» bo'lgan bolalar yuboriladi
    const ids = selected.filter((id) => eligible.some((c) => c.id === id));
    if (ids.length === 0) {
      setError(uz.kundalik.tanlov_bosh);
      return;
    }
    setError("");
    inFlight.current = true;
    setSaving(true);
    try {
      const res = await api.put<DailyDay>(`${basePath}/meals`, {
        date:      day.date,
        group_id:  day.group.id,
        meal_type: mealType,
        served_at: servedAt,
        records:   ids.map((child_id) => ({
          child_id,
          ate:  !notAte[child_id],
          note: (rowNotes[child_id] ?? "").trim() || note.trim() || null,
        })),
      });
      setNote("");
      setNotAte({});
      setRowNotes({});
      onSaved(res, uz.kundalik.ovqat_saqlandi);
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
    const res = await api.delete<DailyDay>(`${basePath}/meals/${deleting.meal.id}`);
    setDeleting(null);
    onSaved(res, uz.kundalik.ovqat_ochirildi);
  }

  const withMeals = day.children.filter((c) => c.meals.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#766B73]">{uz.kundalik.qoida}</p>

      {day.children.length === 0 ? (
        <p className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center text-sm text-[#766B73]">{uz.kundalik.bola_yoq}</p>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-xl border border-[#EDE3E8] p-4 sm:p-5 space-y-4" aria-label={uz.kundalik.tab_ovqat}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={uz.kundalik.ovqat_turi}
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              error={errors.meal_type?.[0]}
              disabled={disabled}
            >
              {day.meal_types.map((t) => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
            </Select>
            <Input
              id="meal-served-at"
              label={uz.kundalik.vaqt}
              type="time"
              value={servedAt}
              onChange={(e) => setServedAt(e.target.value)}
              error={errors.served_at?.[0]}
              disabled={disabled}
              required
            />
          </div>
          <Input
            id="meal-note"
            label={uz.kundalik.izoh}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint={uz.kundalik.izoh_hammaga}
            maxLength={255}
            disabled={disabled}
          />

          <div role="group" aria-labelledby="meal-children-label">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p id="meal-children-label" className="text-sm font-medium text-[var(--text)]">{uz.kundalik.bolalar_tanlash}</p>
              {eligible.length > 0 && (
                <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setSelected(eligible.map((c) => c.id))}>
                  {uz.kundalik.hammasini_tanlash}
                </Button>
              )}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {day.children.map((c) => {
                const allowed = canRecord(c);
                const badge   = attendanceBadge(c.attendance);
                const isOn    = allowed && selected.includes(c.id);
                return (
                  <li key={c.id} className={`rounded-lg ${isOn ? "bg-[#FAF5F8]" : ""}`}>
                    <label className={`flex items-center gap-2 px-2 py-1.5 text-sm ${allowed ? "text-[#29232A]" : "text-[#B8AAB2]"}`}>
                      <input
                        type="checkbox"
                        checked={isOn}
                        disabled={!allowed || disabled}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="flex-1">{childName(c)}</span>
                      {!allowed && <Badge variant={badge.variant}>{badge.label}</Badge>}
                    </label>
                    {isOn && (
                      <div className="flex flex-wrap items-center gap-2 px-2 pb-2 pl-8">
                        <select
                          aria-label={`${uz.kundalik.ovqatlandi}: ${childName(c)}`}
                          value={notAte[c.id] ? "0" : "1"}
                          disabled={disabled}
                          onChange={(e) => setNotAte((cur) => ({ ...cur, [c.id]: e.target.value === "0" }))}
                          className="rounded-md border border-[#EDE3E8] bg-white px-2 py-1 text-xs text-[#29232A]"
                        >
                          <option value="1">{uz.kundalik.ovqatlandi}</option>
                          <option value="0">{uz.kundalik.ovqatlanmadi}</option>
                        </select>
                        <input
                          type="text"
                          aria-label={`${uz.kundalik.bola_izohi}: ${childName(c)}`}
                          placeholder={uz.kundalik.bola_izohi}
                          maxLength={255}
                          value={rowNotes[c.id] ?? ""}
                          disabled={disabled}
                          onChange={(e) => setRowNotes((cur) => ({ ...cur, [c.id]: e.target.value }))}
                          className="flex-1 min-w-[120px] rounded-md border border-[#EDE3E8] bg-white px-2 py-1 text-xs text-[#29232A]"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {(error || rules.length > 0) && (
            <div role="alert" className="text-sm text-[#B91C1C] space-y-1">
              {error && <p>{error}</p>}
              {rules.map((r) => <p key={r}>{r}</p>)}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={disabled || eligible.length === 0}>{uz.kundalik.ovqat_saqlash}</Button>
          </div>
        </form>
      )}

      {withMeals.length > 0 && (
        <ul className="bg-white rounded-xl border border-[#EDE3E8] divide-y divide-[#F2ECF0]">
          {withMeals.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <p className="font-medium text-[#29232A] text-sm">{childName(c)}</p>
              {!canRecord(c) && <p className="text-xs text-[#92400E] mt-0.5">{uz.kundalik.davomat_ozgargan}</p>}
              <ul className="mt-1.5 space-y-1">
                {c.meals.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm text-[#3D3240]">
                    <span className="flex-1">
                      {MEAL_LABELS[m.meal_type]} · {m.served_at}{m.note ? ` · ${m.note}` : ""}
                      {m.ate === false && <span className="ml-1.5"><Badge variant="warning">{uz.kundalik.ovqatlanmadi}</Badge></span>}
                    </span>
                    {day.editable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${uz.common.ochirish}: ${childName(c)}, ${MEAL_LABELS[m.meal_type]}`}
                        onClick={() => setDeleting({ meal: m, name: childName(c) })}
                      >
                        {uz.common.ochirish}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`${uz.kundalik.ovqat_ochirish}: ${deleting?.name ?? ""}`}
        message={uz.kundalik.ovqat_ochirish_tasdiq}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
