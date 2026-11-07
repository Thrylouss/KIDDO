"use client";

import { useEffect, useId, useRef } from "react";
import Button from "./Button";

type Size = "sm" | "md" | "lg";

const sizeCls: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: Size;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  const titleId  = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      // Fokus modal ichida qoladi (Tab / Shift+Tab)
      if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Ochilganda fokus modal ichiga (birinchi maydon), yopilganda oldingi elementga qaytadi
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), select, textarea")
      ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? panel)?.focus({ preventScroll: true });
    return () => { previous?.focus?.({ preventScroll: true }); };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`relative w-full ${sizeCls[size]} bg-white rounded-2xl outline-none shadow-2xl animate-slide-up flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border-2)] transition-colors"
            aria-label="Yopish"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)] rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export { Button };
