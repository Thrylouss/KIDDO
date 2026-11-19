"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/PreferencesContext";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import Icon, { type AnyIcon } from "@/components/smart-safety/Icons";
import { DemoChip } from "@/components/smart-safety/SmartSafetyApp";
import { presentHref, useGuided } from "@/components/smart-safety/Presenter";
import { SMART_SAFETY_DEMO } from "@/lib/smart-safety/features";
import type { Role } from "@/lib/smart-safety/model";
import uz from "@/i18n";

const ROLES: [Role, AnyIcon][] = [["director", "building"], ["teacher", "children"], ["parent", "user"], ["super_admin", "shield"]];

/** Smart xavfsizlik — taqdimot bosh sahifasi: sintetik bog'cha; haqiqiy yozuvlar bilan bog'liq emas. */
export default function SmartSafetyPresentationPage() {
  useLocale();
  const t = uz.ssx.pres;
  const go = useGuided();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white"><Icon name="shield" className="h-4 w-4" /></span>
            {uz.ss.title}
          </Link>
          <DemoChip />
          <div className="ml-auto"><QuickPreferences /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {!SMART_SAFETY_DEMO ? (
          <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{uz.ss.disabled}</p>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.home_title}</h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--text-2)]">{t.home_desc}</p>
            <button type="button" onClick={() => go(0)} data-testid="guided-start-home"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-base font-semibold text-white hover:bg-[var(--primary-h)]">
              <Icon name="play" className="h-5 w-5" />{t.start_guided}
            </button>
            <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-3)]">{t.choose}</h2>
            <ul className="grid gap-3 sm:grid-cols-2" role="list" aria-label={uz.ss.role_view}>
              {ROLES.map(([r, icon]) => (
                <li key={r}>
                  <Link href={presentHref(r)} data-testid={`role-${r}`}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--primary)]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-lt)] text-[var(--primary)]"><Icon name={icon} className="h-6 w-6" /></span>
                    <span className="flex-1 text-lg font-semibold">{uz.ss.roles[r]}</span>
                    <Icon name="chevron" className="h-5 w-5 text-[var(--text-3)]" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-[var(--text-3)]">{uz.ss.demo_banner}</p>
          </>
        )}
      </main>
    </div>
  );
}
