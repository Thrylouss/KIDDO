"use client";

import { useState } from "react";
import uz from "@/i18n/uz";

type Tab = "kunlik" | "oylik";

/** Davomat sahifasi bo'limlari: kunlik belgilash va oylik tarix. */
export default function AttendanceTabs({ daily, monthly }: { daily: React.ReactNode; monthly: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("kunlik");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={uz.davomat.sarlavha} className="flex gap-1 overflow-x-auto border-b border-[#EDE3E8]">
        {([["kunlik", uz.davomat.tab_kunlik], ["oylik", uz.davomat.tab_oylik]] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`whitespace-nowrap px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[#766B73] hover:text-[#3D3240]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "kunlik" ? daily : monthly}</div>
    </div>
  );
}
