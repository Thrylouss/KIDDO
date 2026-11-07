"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";

const t = uz.bogchalar;

/** Tanlangan bog'chalarni ommaviy arxivlash yoki tiklash. Ommaviy o'chirish yo'q — ma'lumotlar saqlanadi. */
export default function OrgBulkStatusDialog({ action, ids, onClose, onDone }: {
  action: "archived" | "active" | null; ids: number[]; onClose: () => void;
  onDone: (result: { changed: number[]; skipped: number[] }) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => { setReason(""); setError(""); }, [action]);

  const archive = action === "archived";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!action || busy.current) return;
    if (archive && reason.trim().length < 3) { setError(t.sabab_majburiy); return; }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await api.post<{ data?: { changed: number[]; skipped: number[] } }>("/v1/super-admin/organizations/bulk-status", {
        ids, status: action, reason: reason.trim() || null,
      });
      onDone(res?.data ?? { changed: ids, skipped: [] });
      onClose();
    } catch (err) {
      const fe = fieldErrors(err);
      setError(Object.values(fe)[0]?.[0] ?? errorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal open={!!action} onClose={onClose} title={archive ? t.ommaviy_sarlavha_arxiv : t.ommaviy_sarlavha_tiklash}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{uz.common.bekor_qilish}</Button>
        <Button form="org-bulk-form" type="submit" loading={saving} disabled={IS_DEMO} variant={archive ? "danger" : "primary"}>
          {archive ? t.ommaviy_arxiv : t.ommaviy_tiklash} ({ids.length})
        </Button>
      </>}>
      <form id="org-bulk-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="rounded-xl bg-[#FAF5F8] px-4 py-3 text-sm text-[var(--text-2)]">
          <span className="font-semibold text-[var(--text)]">{ids.length} {t.tanlangan}.</span> {archive ? t.ommaviy_izoh_arxiv : t.ommaviy_izoh_tiklash}
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-bulk-reason" className="text-sm font-medium text-[var(--text)]">
            {t.sabab}{archive && <span className="text-[#EF4444] ml-0.5">*</span>}
          </label>
          <textarea id="org-bulk-reason" rows={2} maxLength={500} value={reason} placeholder={t.sabab_ph}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none resize-y focus:border-[var(--primary)] focus:ring-2 focus:ring-[#8E315D]/15" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      </form>
    </Modal>
  );
}
