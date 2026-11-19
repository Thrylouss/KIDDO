"use client";

import { useLocale } from "@/contexts/PreferencesContext";
import PageHeader from "@/components/ui/PageHeader";
import Workspace from "@/components/smart-safety/Workspace";
import { SMART_SAFETY_DEMO } from "@/lib/smart-safety/features";
import uz from "@/i18n";

/** KIDDO Smart Safety (super_admin) — DEMO simulyatsiya; feature flag o'chiq bo'lsa ko'rsatilmaydi. */
export default function SuperAdminSmartSafetyPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={`${uz.ss.title} · ${uz.ss.soon}`} description={uz.ss.subtitle} />
      {SMART_SAFETY_DEMO
        ? <Workspace role="super_admin" />
        : <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{uz.ss.disabled}</p>}
    </div>
  );
}
