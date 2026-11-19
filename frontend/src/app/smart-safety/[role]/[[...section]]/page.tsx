"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useLocale } from "@/contexts/PreferencesContext";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import Icon from "@/components/smart-safety/Icons";
import SmartSafetyApp, { DemoChip } from "@/components/smart-safety/SmartSafetyApp";
import PresenterToolbar from "@/components/smart-safety/Presenter";
import { SectionLinks } from "@/components/smart-safety/SmartNav";
import { SMART_SAFETY_DEMO } from "@/lib/smart-safety/features";
import { PRESENT_ROLE, ROLE_FROM_SLUG } from "@/lib/smart-safety/nav";
import uz from "@/i18n";

/** Taqdimot rejimi: /smart-safety/<rol>/<bo'lim>. Taqdimotchi paneli faqat shu yerda ko'rinadi. */
export default function SmartSafetyRolePage() {
  useLocale();
  const params = useParams<{ role: string; section?: string[] }>();
  const role = ROLE_FROM_SLUG[params?.role ?? ""];
  const [menu, setMenu] = useState(false);
  if (!role) notFound();
  const base = `/smart-safety/${PRESENT_ROLE[role]}`;
  const staff = role !== "parent";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          {staff && SMART_SAFETY_DEMO && (
            <button type="button" className="rounded-lg p-1.5 text-[var(--label)] hover:bg-[var(--hover)] lg:hidden" onClick={() => setMenu(true)} aria-label={uz.ssx.open_menu} aria-expanded={menu}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
          <Link href="/smart-safety" className="flex min-w-0 items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white"><Icon name="shield" className="h-4 w-4" /></span>
            <span className="truncate">{uz.ss.title}</span>
          </Link>
          <span className="hidden text-sm text-[var(--text-2)] sm:inline">· {uz.ss.roles[role]}</span>
          <div className="ml-auto flex items-center gap-2"><span className="hidden sm:inline"><DemoChip /></span><QuickPreferences /></div>
        </div>
      </header>
      <div className="flex">
        {staff && SMART_SAFETY_DEMO && (
          <>
            <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-60 flex-shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-3 lg:block" aria-label={uz.ssx.open_menu}>
              <SectionLinks role={role} base={base} />
            </aside>
            {menu && (
              <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={uz.ssx.open_menu}>
                <button type="button" className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMenu(false)} aria-label={uz.ssx.pres.collapse} />
                <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-[var(--card)] p-3 shadow-xl">
                  <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">{uz.ss.nav}</p>
                  <SectionLinks role={role} base={base} onNavigate={() => setMenu(false)} />
                </div>
              </div>
            )}
          </>
        )}
        <main className="min-w-0 flex-1 px-4 pb-40 pt-5 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <SmartSafetyApp role={role} base={base} path={params?.section ?? []} presentation />
          </div>
        </main>
      </div>
      {SMART_SAFETY_DEMO && <PresenterToolbar role={role} />}
    </div>
  );
}
