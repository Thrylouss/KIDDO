"use client";

import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import Button from "@/components/ui/Button";
import ChildPhoto from "@/components/ChildPhoto";
import ConfirmDialog from "@/components/ConfirmDialog";
import uz from "@/i18n/uz";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

interface ChildPhotoUploaderProps {
  childId:   number;
  firstName: string;
  lastName:  string;
  photoUrl:  string | null;
  /** POST/DELETE: /v1/teacher/children/{id}/photo */
  basePath:  "/v1/teacher/children" | "/v1/admin/children";
  onChange:  (photoUrl: string | null) => void;
}

/** Profil rasmini yuklash, almashtirish va o'chirish. Tur va hajm brauzerda ham, serverda ham tekshiriladi. */
export default function ChildPhotoUploader({ childId, firstName, lastName, photoUrl, basePath, onChange }: ChildPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [deleting, setDeleting] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";            // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file || inFlight.current) return;
    setError("");
    setSuccess("");
    if (!ALLOWED.includes(file.type)) { setError(uz.guruh.rasm_turi_xato); return; }
    if (file.size > MAX_BYTES)       { setError(uz.guruh.rasm_hajm_xato); return; }

    inFlight.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await uploadFile<{ photo_url: string | null }>(`${basePath}/${childId}/photo`, form);
      onChange(res.photo_url ?? null);
      setSuccess(uz.guruh.rasm_saqlandi);
    } catch (err: unknown) {
      setError(fieldErrors(err).photo?.[0] ?? errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    await api.delete(`${basePath}/${childId}/photo`);
    setDeleting(false);
    onChange(null);
    setSuccess(uz.guruh.rasm_ochirildi);
  }

  return (
    <div className="flex flex-col items-center gap-2 w-[150px]">
      <ChildPhoto firstName={firstName} lastName={lastName} photoUrl={photoUrl} size="xl" />
      {!photoUrl && <p className="text-[11px] text-[#B8AAB2] text-center">{uz.guruh.rasm_yoq}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={photoUrl ? uz.guruh.rasm_almashtirish : uz.guruh.rasm_yuklash}
        onChange={pick}
      />
      <Button size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
        {photoUrl ? uz.guruh.rasm_almashtirish : uz.guruh.rasm_yuklash}
      </Button>
      {photoUrl && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setSuccess(""); setDeleting(true); }}>
          {uz.guruh.rasm_ochirish}
        </Button>
      )}
      <p className="text-[11px] text-[#B8AAB2] text-center">{uz.guruh.rasm_talab}</p>
      {error && <p role="alert" className="text-xs text-[#B91C1C] text-center">{error}</p>}
      {success && <p role="status" className="text-xs text-[var(--success)] text-center">{success}</p>}

      <ConfirmDialog
        open={deleting}
        title={uz.guruh.rasm_ochirish}
        message={uz.guruh.rasm_ochirish_tasdiq}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}
