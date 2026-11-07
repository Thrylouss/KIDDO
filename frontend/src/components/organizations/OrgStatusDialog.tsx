"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import { ORG_STATUSES, STATUS_HINTS, STATUS_LABELS, orgStatus } from "@/lib/organizations";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationSummary, OrgStatus } from "@/types";

const t = uz.bogchalar;

interface Props {
  org: OrganizationSummary | null;
  /** Oldindan tanlangan holat (masalan, «Arxivlash» tugmasidan) */
  initialStatus?: OrgStatus;
  onClose: () => void;
  onChanged: (org: OrganizationSummary) => void;
}

/** Faollik holatini o'zgartirish: tasdiq, sabab (faoldan boshqa holatlarda majburiy), to'xtatish muddati. */
export default function OrgStatusDialog({ org, initialStatus, onClose, onChanged }: Props) {
  const current = org ? orgStatus(org) : "active";
  const [status, setStatus] = useState<OrgStatus>("inactive");
  const [reason, setReason] = useState("");
  const [until, setUntil]   = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!org) return;
    setStatus(initialStatus ?? (current === "active" ? "suspended" : "active"));
    setReason(""); setUntil(""); setErrors({}); setError("");
  }, [org, initialStatus, current]);

  // Ertangi sana (bir marta hisoblanadi — render toza qolsin)
  const [minDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org || busy.current) return;
    if (status !== "active" && reason.trim().length < 3) { setErrors({ reason: t.sabab_majburiy }); return; }

    busy.current = true;
    setSaving(true);
    setError(""); setErrors({});
    try {
      const res = await api.patch<{ data?: OrganizationSummary }>(`/v1/super-admin/organizations/${org.id}/status`, {
        status,
        reason: reason.trim() || null,
        ...(status === "suspended" && until ? { suspended_until: `${until}T00:00:00` } : {}),
      });
      onChanged(res?.data ?? { ...org, status, is_active: status === "active" });
      onClose();
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])));
      else setError(errorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal open={!!org} onClose={onClose} title={t.holat_sarlavha}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{uz.common.bekor_qilish}</Button>
        <Button form="org-status-form" type="submit" loading={saving} disabled={IS_DEMO || status === current && status !== "suspended"}
          variant={status === "active" ? "primary" : "danger"}>{t.holat_tasdiq}</Button>
      </>}>
      {org && (
        <form id="org-status-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="rounded-xl bg-[#FAF5F8] px-4 py-3">
            <p className="font-semibold text-[var(--text)]">{org.name}</p>
            <p className="text-xs text-[var(--text-2)] mt-0.5">{t.joriy_holat}: {STATUS_LABELS[current]}</p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-[var(--text)] mb-2">{t.yangi_holat}</legend>
            <div className="grid grid-cols-1 gap-2">
              {ORG_STATUSES.filter((s) => s !== current || s === "suspended").map((s) => (
                <label key={s} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors
                  ${status === s ? "border-[#8E315D] bg-[#FDF2F6]" : "border-[var(--border)] hover:bg-[#FFF9F5]"}`}>
                  <input type="radio" name="org-status" value={s} checked={status === s} onChange={() => setStatus(s)} className="mt-1 accent-[#8E315D]" />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">{STATUS_LABELS[s]}</span>
                    <span className="block text-xs text-[var(--text-2)] mt-0.5">{STATUS_HINTS[s]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-status-reason" className="text-sm font-medium text-[var(--text)]">
              {t.sabab}{status !== "active" && <span className="text-[#EF4444] ml-0.5">*</span>}
            </label>
            <textarea id="org-status-reason" rows={2} maxLength={500} value={reason} placeholder={t.sabab_ph}
              onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: "" })); }}
              aria-invalid={errors.reason ? true : undefined}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none resize-y focus:ring-2 ${errors.reason ? "border-[#EF4444] focus:ring-[#EF4444]/20" : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-[#8E315D]/15"}`} />
            {errors.reason && <p role="alert" className="text-xs text-[#EF4444]">{errors.reason}</p>}
          </div>

          {status === "suspended" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="org-status-until" className="text-sm font-medium text-[var(--text)]">{t.muddat}</label>
              <input id="org-status-until" type="date" min={minDate} value={until} onChange={(e) => setUntil(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[#8E315D]/15" />
              <p className="text-xs text-[var(--text-2)]">{errors.suspended_until || t.muddat_izoh}</p>
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
