"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import uz from "@/i18n/uz";
import type { OrganizationSummary } from "@/types";

const t = uz.bogchalar;

export interface OrgActionHandlers {
  onEdit: (org: OrganizationSummary) => void;
  onEnter: (org: OrganizationSummary) => void;
  onStatus: (org: OrganizationSummary) => void;
  onCopyInfo: (org: OrganizationSummary) => void;
  onCopyAddress: (org: OrganizationSummary) => void;
  onDelete: (org: OrganizationSummary) => void;
}

/** Uch nuqtali amallar menyusi (klaviatura: Enter/Space ochadi, Esc yopadi, ↑/↓ elementlar orasida). */
export default function OrgActionsMenu({ org, handlers, align = "right" }: { org: OrganizationSummary; handlers: OrgActionHandlers; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const run = (fn: (o: OrganizationSummary) => void) => () => { setOpen(false); fn(org); };
  const item = "w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors focus:outline-none focus:bg-[#F2ECF0]";

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" aria-label={`${t.amallar_menyu}: ${org.name}`} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-[#B8AAB2] hover:text-[#3D3240] hover:bg-[#F2ECF0] focus-visible:ring-2 focus-visible:ring-[#8E315D]/30 transition-colors">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div id={menuId} role="menu" className={`absolute ${align === "right" ? "right-0" : "left-0"} top-9 z-30 min-w-[230px] rounded-xl border border-[#EDE3E8] bg-white py-1 shadow-lg`}>
          <Link role="menuitem" href={`/admin/bogchalar/${org.id}`} onClick={() => setOpen(false)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.batafsil}</Link>
          <button role="menuitem" type="button" onClick={run(handlers.onEdit)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.tahrirlash}</button>
          <button role="menuitem" type="button" onClick={run(handlers.onStatus)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.holatni_ozgartirish}</button>
          <button role="menuitem" type="button" onClick={run(handlers.onEnter)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.panelga_kirish}</button>
          <div className="my-1 border-t border-[#F2ECF0]" role="separator" />
          <button role="menuitem" type="button" onClick={run(handlers.onCopyInfo)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.malumot_nusxa}</button>
          <button role="menuitem" type="button" onClick={run(handlers.onCopyAddress)} className={`${item} text-[#3D3240] hover:bg-[#F2ECF0]`}>{t.manzil_nusxa}</button>
          <div className="my-1 border-t border-[#F2ECF0]" role="separator" />
          <button role="menuitem" type="button" onClick={run(handlers.onDelete)} className={`${item} text-[#991B1B] hover:bg-[#FEF2F2]`}>{t.ochirish}</button>
        </div>
      )}
    </div>
  );
}
