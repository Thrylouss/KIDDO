"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import uz from "@/i18n";
import {
  KIDS_CATEGORIES, KIDS_LANGUAGES, KIDS_MAX_AGE, KIDS_MIN_AGE, groupMatchesAge,
  type KidsCategory, type KidsContent, type KidsGroup, type KidsLanguage, type KidsPreview,
} from "@/lib/kids";

interface Props {
  groups: KidsGroup[];
  /** Tahrirlash rejimi; bo'lmasa — yangi kontent. */
  content?: KidsContent | null;
  onClose: () => void;
  onSaved: (content: KidsContent, created: boolean) => void;
}

interface FormState {
  youtube_url: string;
  title: string;
  description: string;
  language: KidsLanguage;
  category: KidsCategory;
  min_age: number;
  max_age: number;
  group_ids: number[];
  active: boolean;
}

const AGES = Array.from({ length: KIDS_MAX_AGE - KIDS_MIN_AGE + 1 }, (_, i) => KIDS_MIN_AGE + i);
const URL_HINT = /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\//i;

export default function ContentFormModal({ groups, content, onClose, onSaved }: Props) {
  const t = uz.kids;
  const editing = !!content;
  const [form, setForm] = useState<FormState>(() => ({
    youtube_url: content ? content.watch_url : "",
    title: content?.title ?? "",
    description: content?.description ?? "",
    language: content?.language ?? "uz",
    category: content?.category ?? "lessons",
    min_age: content?.min_age ?? 4,
    max_age: content?.max_age ?? KIDS_MAX_AGE,
    group_ids: content?.groups?.map((g) => g.id) ?? [],
    active: content ? content.status === "active" : true,
  }));
  const [preview, setPreview] = useState<KidsPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  async function check() {
    setFormError("");
    if (!URL_HINT.test(form.youtube_url.trim())) { setErrors((e) => ({ ...e, youtube_url: t.f_url_xato })); return; }
    setChecking(true);
    try {
      const res = await api.post<KidsPreview>("/v1/admin/kids/contents/preview", { youtube_url: form.youtube_url.trim() });
      if (!res) return;
      setPreview(res);
      // Yangi kontent uchun bo'sh maydonlar tavsiya bilan to'ldiriladi — rahbar tekshiradi va o'zgartira oladi
      if (!editing) {
        const s = res.suggestions;
        setForm((f) => ({
          ...f,
          title: f.title || res.metadata.title || "",
          language: s.language, category: s.category, min_age: s.min_age, max_age: s.max_age,
          group_ids: f.group_ids.length ? f.group_ids : s.group_ids,
        }));
      }
    } catch (e) {
      const fe = fieldErrors(e);
      setErrors((x) => ({ ...x, youtube_url: fe.youtube_url?.[0] ?? errorMessage(e) }));
    } finally {
      setChecking(false);
    }
  }

  function applySuggestion() {
    if (!preview) return;
    const s = preview.suggestions;
    setForm((f) => ({ ...f, title: preview.metadata.title ?? f.title, language: s.language, category: s.category, min_age: s.min_age, max_age: s.max_age, group_ids: s.group_ids }));
  }

  function toggleGroup(id: number) {
    setForm((f) => ({ ...f, group_ids: f.group_ids.includes(id) ? f.group_ids.filter((g) => g !== id) : [...f.group_ids, id] }));
    setErrors((e) => ({ ...e, group_ids: "" }));
  }

  async function save() {
    const errs: Record<string, string> = {};
    if (!form.youtube_url.trim()) errs.youtube_url = t.f_majburiy;
    else if (!URL_HINT.test(form.youtube_url.trim())) errs.youtube_url = t.f_url_xato;
    if (!form.title.trim()) errs.title = t.f_majburiy;
    if (form.min_age > form.max_age) errs.max_age = t.f_yosh_xato;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Yosh o'zgargach mos kelmay qolgan guruhlar yuborilmaydi (backend ham tekshiradi)
    const groupIds = form.group_ids.filter((id) => {
      const g = groups.find((x) => x.id === id);
      return g && groupMatchesAge(g, form.min_age, form.max_age);
    });
    const body = {
      youtube_url: form.youtube_url.trim(), title: form.title.trim(), description: form.description.trim() || null,
      language: form.language, category: form.category, min_age: form.min_age, max_age: form.max_age,
      group_ids: groupIds, status: form.active ? "active" : "hidden",
    };

    setSaving(true);
    setFormError("");
    try {
      const res = editing
        ? await api.put<{ data: KidsContent }>(`/v1/admin/kids/contents/${content!.id}`, body)
        : await api.post<{ data: KidsContent }>("/v1/admin/kids/contents", body);
      if (res?.data) onSaved(res.data, !editing);
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.split(".")[0], v[0]])));
      else setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? t.tahrirlash : t.qoshish} size="lg"
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>{uz.common.bekor_qilish}</Button><Button onClick={save} loading={saving}>{uz.common.saqlash}</Button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input id="kids-url" label={t.f_url} placeholder={t.f_url_ph} hint={errors.youtube_url ? undefined : t.f_url_izoh}
            value={form.youtube_url} onChange={(e) => { set("youtube_url", e.target.value); setPreview(null); }}
            error={errors.youtube_url} inputMode="url" autoComplete="off" required />
          <Button type="button" variant="secondary" onClick={check} loading={checking} className={errors.youtube_url ? "" : "sm:mb-6"}>{t.f_tekshirish}</Button>
        </div>

        {preview && (
          <section aria-live="polite" data-testid="kids-preview" className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.metadata.thumbnail_url} alt="" className="h-20 w-36 flex-shrink-0 rounded-lg object-cover bg-[var(--border-2)]" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-[var(--text)] line-clamp-2">{preview.metadata.title ?? t.tavsiya_yoq}</p>
                {preview.metadata.author && <p className="text-xs text-[var(--text-2)] mt-0.5">{t.kanal}: {preview.metadata.author}</p>}
                {preview.duplicate && <p className="mt-1 text-xs font-medium text-[var(--warning-text)]">{t.takroriy}</p>}
                {preview.metadata.embeddable === false && <p className="mt-1 text-xs font-medium text-[var(--warning-text)]">{t.embed_bloklangan}</p>}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-text)]">
              <p className="font-semibold">{t.tavsiya}</p>
              <p className="mt-0.5">{t.tavsiya_izoh}</p>
              {editing && <button type="button" onClick={applySuggestion} className="mt-1.5 font-semibold underline underline-offset-2 hover:no-underline">{t.tavsiya_qollash}</button>}
            </div>
          </section>
        )}

        <Input id="kids-title" label={t.f_nomi} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} error={errors.title} required />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="kids-desc" className="text-sm font-medium text-[var(--label)]">{t.f_tavsif} <span className="font-normal text-[var(--text-3)]">{uz.matn.ixtiyoriy}</span></label>
          <textarea id="kids-desc" rows={3} maxLength={2000} value={form.description} onChange={(e) => set("description", e.target.value)}
            className="kiddo-input w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 resize-y" />
          {errors.description && <p role="alert" className="text-xs text-[var(--error-text)]">{errors.description}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select id="kids-lang" label={t.til} value={form.language} onChange={(e) => set("language", e.target.value as KidsLanguage)} error={errors.language}>
            {KIDS_LANGUAGES.map((l) => <option key={l} value={l}>{t.til_nomi[l]}</option>)}
          </Select>
          <Select id="kids-cat" label={t.kategoriya} value={form.category} onChange={(e) => set("category", e.target.value as KidsCategory)} error={errors.category}>
            {KIDS_CATEGORIES.map((c) => <option key={c} value={c}>{t.kat[c]}</option>)}
          </Select>
          <Select id="kids-min" label={t.f_min_yosh} value={form.min_age} onChange={(e) => set("min_age", Number(e.target.value))} error={errors.min_age}>
            {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select id="kids-max" label={t.f_max_yosh} value={form.max_age} onChange={(e) => set("max_age", Number(e.target.value))} error={errors.max_age}>
            {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-[var(--label)] mb-1">{t.guruhlar}</legend>
          <p className="text-xs text-[var(--text-3)] mb-2">{t.f_guruhlar_izoh}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => {
              const ok = groupMatchesAge(g, form.min_age, form.max_age);
              const checked = ok && form.group_ids.includes(g.id);
              return (
                <label key={g.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${ok ? "cursor-pointer border-[var(--border)] hover:bg-[var(--hover)]" : "cursor-not-allowed border-[var(--border-2)] text-[var(--text-3)]"} ${checked ? "border-[var(--primary)] bg-[var(--primary-lt)]" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={!ok} onChange={() => toggleGroup(g.id)} className="h-4 w-4 accent-[var(--primary)]" />
                  <span className="flex-1 min-w-0 truncate text-[var(--text)]">{g.name}</span>
                  <span className="text-xs text-[var(--text-3)]">{g.age_category ?? "—"}{!ok && ` · ${t.f_guruh_mos_emas}`}</span>
                </label>
              );
            })}
          </div>
          {errors.group_ids && <p role="alert" className="mt-1.5 text-xs text-[var(--error-text)]">{errors.group_ids}</p>}
        </fieldset>

        <label className="flex items-center gap-2.5 text-sm text-[var(--label)]">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          {t.f_faol}
        </label>

        {formError && <p role="alert" className="text-sm text-[var(--error-text)]">{formError}</p>}
      </form>
    </Modal>
  );
}
