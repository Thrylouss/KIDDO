"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";

interface TemporaryPasswordModalProps {
  /** null — yopiq */
  credentials: { login: string; password: string } | null;
  onClose: () => void;
}

const t = uz.akkaunt;

/**
 * Tizim yaratgan vaqtinchalik parolni bir marta ko'rsatadi. Parol faqat shu komponent holatida turadi —
 * yopilgach qayta ko'rib bo'lmaydi (serverda faqat hash saqlanadi).
 */
export default function TemporaryPasswordModal({ credentials, onClose }: TemporaryPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`${t.login}: ${credentials.login}\n${t.vaqtinchalik_parol}: ${credentials.password}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function close() {
    setCopied(false);
    onClose();
  }

  return (
    <Modal
      open={!!credentials}
      onClose={close}
      title={t.vaqtinchalik_sarlavha}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={copy}>{copied ? t.nusxa_olindi : t.nusxa}</Button>
          <Button onClick={close}>{t.saqlab_oldim}</Button>
        </>
      }
    >
      {credentials && (
        <div className="space-y-4">
          <p role="note" className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
            {t.vaqtinchalik_ogohlantirish}
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF5F8] px-3 py-2">
              <dt className="text-[#766B73]">{t.login}</dt>
              <dd data-testid="temp-login" className="font-mono font-semibold text-[#29232A]">{credentials.login}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF5F8] px-3 py-2">
              <dt className="text-[#766B73]">{t.vaqtinchalik_parol}</dt>
              <dd data-testid="temp-password" className="font-mono font-semibold tracking-wider text-[#8E315D] select-all">{credentials.password}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}
