"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/contexts/PreferencesContext";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import Workspace from "@/components/smart-safety/Workspace";
import { DemoBadge, SoonBadge } from "@/components/smart-safety/shared";
import { SMART_SAFETY_DEMO } from "@/lib/smart-safety/features";
import type { Role } from "@/lib/smart-safety/model";
import uz from "@/i18n";

const ROLES: Role[] = ["director", "teacher", "parent", "super_admin"];

/** KIDDO Smart Safety — taqdimot rejimi: sintetik tashkilot, bolalar va qurilmalar; haqiqiy yozuvlar bilan bog'liq emas. */
export default function SmartSafetyPresentationPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const t = uz.ss;
  const [role, setRole] = useState<Role>("director");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm text-white">K</span>
            {t.title}
          </Link>
          <DemoBadge /><SoonBadge />
          <div className="ml-auto"><QuickPreferences /></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {!SMART_SAFETY_DEMO ? (
          <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{t.disabled}</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{t.presentation}</h1>
            <p className="mt-1 mb-4 max-w-3xl text-sm text-[var(--text-2)]">{t.presentation_desc}</p>
            <div role="tablist" aria-label={t.role_view} className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
              {ROLES.map((r) => (
                <button key={r} role="tab" type="button" aria-selected={role === r} onClick={() => setRole(r)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${role === r ? "bg-[var(--primary)] text-white" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}>
                  {t.roles[r]}
                </button>
              ))}
            </div>
            <Workspace key={role} role={role} />
          </>
        )}
      </main>
    </div>
  );
}
