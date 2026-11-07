"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";

export interface ResetPasswordTarget {
  /** Masalan: "Karimova Dilnoza" */
  name: string;
  /** POST qilinadigan endpoint, masalan /v1/admin/teachers/5/reset-password */
  url:  string;
}

interface ResetPasswordModalProps {
  target:  ResetPasswordTarget | null;
  onClose: () => void;
  onDone:  () => void;
}

/** Admin tarbiyachi yoki ota-onaga yangi parol o'rnatadi. Parol javobda yoki xabarda qaytarilmaydi. */
export default function ResetPasswordModal({ target, onClose, onDone }: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string[]>>({});
  const [error,    setError]    = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    setPassword("");
    setShow(false);
    setErrors({});
    setError("");
  }, [target]);

  if (!target) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || IS_DEMO || !target) return;
    inFlight.current = true;
    setSaving(true);
    setErrors({});
    setError("");
    try {
      await api.post(target.url, { password });
      onDone();
    } catch (err: unknown) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => { if (!inFlight.current) onClose(); }}
      title={`${uz.common.parolni_tiklash}: ${target.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{uz.common.bekor_qilish}</Button>
          <Button form="reset-password-form" type="submit" loading={saving} disabled={IS_DEMO}>{uz.common.saqlash}</Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={submit} className="space-y-3">
        {IS_DEMO && (
          <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
        )}
        <Input
          id="reset-password"
          label={uz.common.yangi_parol}
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password?.[0]}
          hint={uz.common.parol_tiklash_izoh}
          minLength={8}
          autoComplete="new-password"
          required
        />
        <label className="flex items-center gap-2 text-sm text-[#766B73]">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          {uz.common.parolni_korsatish}
        </label>
        {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      </form>
    </Modal>
  );
}
