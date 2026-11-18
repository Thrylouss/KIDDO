"use client";

import { usePreferences } from "@/contexts/PreferencesContext";
import { LOCALES, LOCALE_NATIVE_NAMES } from "@/i18n";
import { THEME_PREFERENCES } from "@/lib/theme";
import { ThemeIcon } from "@/components/preferences/PreferenceIcons";
import { themeLabel } from "@/components/preferences/QuickPreferences";
import uz from "@/i18n";

function Option({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)]/40 ${checked ? "border-[var(--primary)] bg-[var(--primary-lt)] text-[var(--primary)] font-medium" : "border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

/** Sozlamalar → Interfeys: til va mavzu. Header'dagi tezkor tugmalar bilan bitta kontekst orqali sinxron. */
export default function InterfaceSettings() {
  const { locale, setLocale, theme, setTheme } = usePreferences();
  const t = uz.interfeys;

  return (
    <section className="bg-white rounded-xl border border-[var(--border)]" data-testid="interface-settings">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t.sarlavha}</h2>
        <p className="text-xs text-[var(--text-2)] mt-0.5">{t.tavsif}</p>
      </div>
      <div className="p-5 grid gap-5">
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text)] mb-2">{t.til}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {LOCALES.map((l) => (
              <Option key={l} name="ui-locale" checked={locale === l} onChange={() => setLocale(l)}>
                <span lang={l}>{LOCALE_NATIVE_NAMES[l]}</span>
              </Option>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-[var(--text)] mb-2">{t.mavzu}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {THEME_PREFERENCES.map((p) => (
              <Option key={p} name="ui-theme" checked={theme === p} onChange={() => setTheme(p)}>
                <ThemeIcon pref={p} />{themeLabel(p)}
              </Option>
            ))}
          </div>
          <p className="text-xs text-[var(--text-3)] mt-2">{t.tizim_izoh}</p>
        </fieldset>
      </div>
    </section>
  );
}
