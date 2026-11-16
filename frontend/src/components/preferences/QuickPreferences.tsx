"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { LOCALES, LOCALE_NATIVE_NAMES, LOCALE_SHORT, type Locale } from "@/i18n";
import { THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";
import uz from "@/i18n";
import { CheckIcon, GlobeIcon, ThemeIcon } from "./PreferenceIcons";

export function themeLabel(p: ThemePreference): string {
  return p === "light" ? uz.interfeys.yorug : p === "dark" ? uz.interfeys.qorongi : uz.interfeys.tizim;
}

/** Kichik ochiluvchi menyu: tashqariga bosish va Escape bilan yopiladi, klaviatura bilan boshqariladi. */
function Dropdown({ label, trigger, children }: { label: string; trigger: React.ReactNode; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="h-9 min-w-9 px-2 inline-flex items-center justify-center gap-1 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 transition-colors"
      >
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label}
          className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl shadow-black/10 animate-fade-in">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ selected, onSelect, icon, children }: { selected: boolean; onSelect: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={selected} onClick={onSelect}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:bg-[var(--primary-lt)] ${selected ? "text-[var(--primary)] font-medium bg-[var(--primary-lt)]" : "text-[var(--label)] hover:bg-[var(--hover)]"}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {selected && <CheckIcon />}
    </button>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = usePreferences();
  return (
    <Dropdown label={uz.interfeys.til_tanlash} trigger={<><GlobeIcon /><span className="text-xs font-semibold">{LOCALE_SHORT[locale]}</span></>}>
      {(close) => LOCALES.map((l: Locale) => (
        <MenuItem key={l} selected={l === locale} onSelect={() => { close(); setLocale(l); }}>
          <span lang={l}>{LOCALE_NATIVE_NAMES[l]}</span>
        </MenuItem>
      ))}
    </Dropdown>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = usePreferences();
  return (
    <Dropdown label={uz.interfeys.mavzu_tanlash} trigger={<ThemeIcon pref={theme} />}>
      {(close) => THEME_PREFERENCES.map((p) => (
        <MenuItem key={p} selected={p === theme} icon={<ThemeIcon pref={p} />} onSelect={() => { setTheme(p); close(); }}>
          {themeLabel(p)}
        </MenuItem>
      ))}
    </Dropdown>
  );
}

/** Header uchun: til va mavzu tezkor tugmalari. */
export default function QuickPreferences({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} data-testid="quick-preferences">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>
  );
}
