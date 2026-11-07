"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import uz from "@/i18n/uz";

const t = uz.bildirishnoma;

interface Props {
  orgId: number;
  open: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}

/** Super Admin → bitta bog'cha rahbariga bildirishnoma (POST /v1/super-admin/notifications). */
export default function SendNotificationModal({ orgId, open, onClose, onSent }: Props) {
  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [type, setType]       = useState("info");
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string[]>>({});
  const [error, setError]     = useState("");

  function close() {
    setTitle(""); setMessage(""); setType("info"); setErrors({}); setError("");
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErrors({}); setError("");
    try {
      await api.post("/v1/super-admin/notifications", { title: title.trim(), message: message.trim(), type, organization_id: orgId });
      onSent(t.yuborildi);
      close();
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={t.yuborish_sarlavha} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>{uz.common.bekor_qilish}</Button>
          <Button form="send-notification" type="submit" loading={saving} disabled={!title.trim() || !message.trim()}>{t.yuborish}</Button>
        </>
      }>
      <form id="send-notification" onSubmit={submit} className="space-y-4" noValidate>
        <Input id="notif-title" label={t.mavzu} value={title} maxLength={255} required onChange={(e) => setTitle(e.target.value)} error={errors.title?.[0]} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notif-message" className="text-sm font-medium text-[var(--text)]">{t.matn} <span className="text-[#EF4444]">*</span></label>
          <textarea id="notif-message" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-[#EDE3E8] bg-white px-3 py-2 text-sm text-[#29232A] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" />
          {errors.message?.[0] && <p className="text-xs text-[#B91C1C]">{errors.message[0]}</p>}
        </div>
        <Select id="notif-type" label={t.tur} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="info">{t.tur_info}</option>
          <option value="warning">{t.tur_warning}</option>
          <option value="alert">{t.tur_alert}</option>
        </Select>
        {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      </form>
    </Modal>
  );
}
