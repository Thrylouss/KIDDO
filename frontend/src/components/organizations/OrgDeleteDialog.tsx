"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationSummary } from "@/types";

const t = uz.bogchalar;

const LINKED_LABELS: Record<string, string> = {
  bolalar: uz.bogchalar.st_bolalar, guruhlar: uz.bogchalar.st_guruhlar, foydalanuvchilar: uz.bogchalar.st_foydalanuvchilar,
  tarbiyachilar: uz.bogchalar.st_tarbiyachilar, ota_onalar: uz.bogchalar.st_ota_onalar,
};

interface Props {
  org: OrganizationSummary | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
  /** Bog'langan ma'lumot bo'lsa — arxivlashga o'tish */
  onArchive: (org: OrganizationSummary) => void;
}

/** Kuchli tasdiq: nomni aynan kiritish. Bog'langan ma'lumotli bog'cha backendda o'chirilmaydi — arxivlash taklif qilinadi. */
export default function OrgDeleteDialog({ org, onClose, onDeleted, onArchive }: Props) {
  const [name, setName]     = useState("");
  const [error, setError]   = useState("");
  const [linked, setLinked] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => { setName(""); setError(""); setLinked(null); }, [org]);

  const matches = !!org && name.trim().toLowerCase() === org.name.trim().toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !matches || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/v1/super-admin/organizations/${org.id}`, { body: { confirm_name: name.trim() } });
      onDeleted(org.id);
      onClose();
    } catch (err) {
      const e2 = err as { status?: number; data?: { message?: string; data?: { linked?: Record<string, number> } } };
      if (e2.data?.data?.linked) setLinked(e2.data.data.linked);
      setError(e2.status === 422 && e2.data?.message ? e2.data.message : errorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal open={!!org} onClose={onClose} title={t.ochir_sarlavha}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{uz.common.bekor_qilish}</Button>
        {linked && org
          ? <Button onClick={() => { onClose(); onArchive(org); }}>{t.arxivlash_tavsiya}</Button>
          : <Button form="org-delete-form" type="submit" variant="danger" loading={saving} disabled={!matches || IS_DEMO}>{t.ochir_tugma}</Button>}
      </>}>
      {org && (
        <form id="org-delete-form" onSubmit={submit} className="space-y-4">
          <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">{t.ochir_ogoh}</p>
          <p className="font-semibold text-[var(--text)]">{org.name}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-delete-name" className="text-sm font-medium text-[var(--text)]">{t.ochir_tasdiq_label}</label>
            <input id="org-delete-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
          {linked && (
            <div>
              <p className="text-xs font-semibold text-[var(--text-2)] mb-1.5">{t.boglangan}</p>
              <ul className="flex flex-wrap gap-2">
                {Object.entries(linked).map(([k, v]) => (
                  <li key={k} className="rounded-full bg-[#F2ECF0] px-3 py-1 text-xs text-[var(--text)]">{LINKED_LABELS[k] ?? k}: {v}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
