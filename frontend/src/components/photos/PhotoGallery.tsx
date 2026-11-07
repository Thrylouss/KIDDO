"use client";

import { useCallback, useEffect, useState } from "react";
import { api, uploadFile } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { formatUzDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

const t = uz.foto;

export interface GalleryPhoto {
  id: number; url: string; caption: string | null; taken_on: string;
  group: { id: number; name: string } | null; uploaded_by: string | null; can_delete?: boolean;
}
interface PageData { data: GalleryPhoto[]; meta: { current_page: number; last_page: number; total: number }; groups: { id: number; name: string }[] }

interface Props {
  /** "/v1/admin" (rahbar) yoki "/v1/teacher" (tarbiyachi) */
  basePath: string;
  description: string;
  /** Rahbar — har qanday rasmni, tarbiyachi — faqat o'zi yuklaganini (backend can_delete) o'chiradi */
  canDeleteAll?: boolean;
}

const photoIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const todayIso = () => new Date().toLocaleDateString("sv-SE");

/** Guruh fotogalereyasi: filtrlash, yuklash, ko'rish va o'chirish. Rasmlar himoyalangan endpointdan (cookie) yuklanadi. */
export default function PhotoGallery({ basePath, description, canDeleteAll = false }: Props) {
  const [groupId, setGroupId] = useState("");
  const [photos, setPhotos]   = useState<GalleryPhoto[]>([]);
  const [groups, setGroups]   = useState<{ id: number; name: string }[]>([]);
  const [meta, setMeta]       = useState<PageData["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [success, setSuccess] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm]       = useState({ group_id: "", caption: "", taken_on: todayIso() });
  const [file, setFile]       = useState<File | null>(null);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [viewing, setViewing]   = useState<GalleryPhoto | null>(null);
  const [deleting, setDeleting] = useState<GalleryPhoto | null>(null);
  const readOnly = useReadOnly();

  const load = useCallback(async (page = 1) => {
    if (page === 1) setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (groupId) qs.set("group_id", groupId);
      const res = await api.get<PageData>(`${basePath}/photos?${qs}`);
      setPhotos((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setGroups(res.groups);
      setMeta(res.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [basePath, groupId]);

  useEffect(() => { load(1); }, [load]);

  function openUpload() {
    setSuccess(""); setErrors({}); setFormError(""); setFile(null);
    setForm({ group_id: groupId || (groups.length === 1 ? String(groups[0].id) : ""), caption: "", taken_on: todayIso() });
    setShowUpload(true);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_id) { setErrors({ group_id: [t.guruh_tanlang] }); return; }
    if (!file)          { setErrors({ photo: [t.fayl_tanlang] }); return; }
    setSaving(true); setErrors({}); setFormError("");
    try {
      const body = new FormData();
      body.append("group_id", form.group_id);
      body.append("photo", file);
      if (form.caption.trim()) body.append("caption", form.caption.trim());
      body.append("taken_on", form.taken_on);
      await uploadFile(`${basePath}/photos`, body);
      setShowUpload(false);
      setSuccess(t.yuklandi);
      await load(1);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    await api.delete(`${basePath}/photos/${deleting.id}`);
    setDeleting(null);
    setViewing(null);
    setSuccess(t.ochirildi);
    await load(1);
  }

  const canDelete = (p: GalleryPhoto) => !readOnly && (canDeleteAll || !!p.can_delete);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={t.sarlavha} description={description}
        action={!readOnly && groups.length > 0 ? <Button onClick={openUpload}>{t.yuklash}</Button> : undefined} />

      {groups.length > 1 && (
        <div className="mb-4 sm:max-w-xs">
          <Select id="photos-group" label={t.guruh} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{t.barcha_guruhlar}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
      )}

      {success && <p role="status" className="mb-4 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{success}</p>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-[#F2ECF0] animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8]">
          <EmptyState icon={photoIcon} title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: () => load(1) }} />
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8]">
          <EmptyState icon={photoIcon} title={t.bosh} description={readOnly ? undefined : t.bosh_tavsif}
            action={!readOnly && groups.length > 0 ? { label: t.yuklash, onClick: openUpload } : undefined} />
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="photo-grid">
            {photos.map((p) => (
              <li key={p.id} className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
                <button type="button" onClick={() => setViewing(p)} className="block w-full aspect-square bg-[#FAF5F8]" aria-label={p.caption ?? t.sarlavha}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API rasmi (cookie), next/image optimizatsiyasi emas */}
                  <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
                </button>
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-[#29232A] truncate">{p.caption || p.group?.name}</p>
                  <p className="text-[11px] text-[#B8AAB2]">{p.group?.name} · {formatUzDate(p.taken_on)}</p>
                </div>
              </li>
            ))}
          </ul>
          {meta && meta.current_page < meta.last_page && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => load(meta.current_page + 1)}>{t.yana}</Button>
            </div>
          )}
        </>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title={t.yuklash} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUpload(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="photo-form" type="submit" loading={saving}>{t.yuklash}</Button>
          </>
        }>
        <form id="photo-form" onSubmit={upload} className="space-y-4" noValidate>
          <Select id="photo-group" label={t.guruh} value={form.group_id} required onChange={(e) => setForm({ ...form, group_id: e.target.value })} error={errors.group_id?.[0]}>
            <option value="">{uz.common.tanlang}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="photo-file" className="text-sm font-medium text-[var(--text)]">{t.fayl} <span className="text-[#EF4444]">*</span></label>
            <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#766B73] file:mr-3 file:rounded-lg file:border-0 file:bg-[#FDF2F6] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#8E315D] hover:file:bg-[#FBE7EF]" />
            {errors.photo?.[0] && <p className="text-xs text-[#B91C1C]">{errors.photo[0]}</p>}
          </div>
          <Input id="photo-caption" label={t.izoh} value={form.caption} maxLength={255} onChange={(e) => setForm({ ...form, caption: e.target.value })} error={errors.caption?.[0]} />
          <Input id="photo-date" label={t.sana} type="date" max={todayIso()} value={form.taken_on} onChange={(e) => setForm({ ...form, taken_on: e.target.value })} error={errors.taken_on?.[0]} />
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.caption || viewing?.group?.name || t.sarlavha}
        footer={viewing && canDelete(viewing) ? <Button variant="danger" onClick={() => setDeleting(viewing)}>{t.ochirish}</Button> : undefined}>
        {viewing && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API rasmi (cookie) */}
            <img src={viewing.url} alt={viewing.caption ?? ""} className="w-full max-h-[70vh] object-contain rounded-lg bg-[#FAF5F8]" />
            <figcaption className="mt-2 text-xs text-[#766B73]">
              {viewing.group?.name} · {formatUzDate(viewing.taken_on)}{viewing.uploaded_by ? ` · ${t.yuklagan}: ${viewing.uploaded_by}` : ""}
            </figcaption>
          </figure>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} title={t.ochirish} message={t.ochirish_tasdiq} confirmLabel={t.ochirish} danger
        onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  );
}
