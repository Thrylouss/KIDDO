"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";

interface ConfirmDialogProps {
  open:         boolean;
  title:        string;
  message:      string;
  confirmLabel: string;
  danger?:      boolean;
  /** Xato tashlasa dialog ochiq qoladi va xabar ko'rsatiladi. */
  onConfirm:    () => Promise<void>;
  onClose:      () => void;
}

/** Qaytarib bo'lmaydigan yoki muhim amal oldidan tasdiq. Takroriy bosish bitta so'rov yuboradi. */
export default function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => { if (open) setError(""); }, [open]);

  async function confirm() {
    if (inFlight.current || IS_DEMO) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!inFlight.current) onClose(); }}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{uz.common.bekor_qilish}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={busy} disabled={IS_DEMO}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {IS_DEMO && (
          <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
        )}
        <p className="text-sm text-[#3D3240]">{message}</p>
        {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
      </div>
    </Modal>
  );
}
