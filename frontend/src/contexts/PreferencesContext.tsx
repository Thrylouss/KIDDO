"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { getLocale, readStoredLocale, setLocale as setGlobalLocale, subscribeLocale, type Locale } from "@/i18n";
import {
  applyTheme, persistThemePreference, readThemePreference, resolveTheme,
  type ResolvedTheme, type ThemePreference,
} from "@/lib/theme";

interface PreferencesState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const PreferencesContext = createContext<PreferencesState | null>(null);
/** Faqat til — sahifa va layout'lar obuna bo'ladi; tema o'zgarishi ularni qayta render qilmaydi. */
const LocaleContext = createContext<Locale>("uz");

/**
 * Til va mavzu: header'dagi tezkor tugmalar va Sozlamalar sahifasi shu kontekst orqali sinxron ishlaydi.
 * Til almashganda daraxt QAYTA QURILMAYDI (remount yo'q): `useLocale()` ga obuna bo'lgan sahifa/layout'lar
 * qayta render qilinadi, ularning ichidagi komponentlar esa holatini (forma qiymatlari, ochiq modal,
 * yuklangan ma'lumot) saqlagan holda yangi tildagi matnni oladi.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  // Gidratatsiya server bilan mos bo'lishi uchun boshlang'ich holat — default; haqiqiy qiymat layout effect'da.
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolved] = useState<ResolvedTheme>("light");

  useLayoutEffect(() => {
    const pref = readThemePreference();
    setThemeState(pref);
    setResolved(applyTheme(pref));
    const stored = readStoredLocale();
    if (stored !== getLocale()) setGlobalLocale(stored, { persist: false });
    setLocaleState(getLocale());
  }, []);

  useEffect(() => subscribeLocale(() => setLocaleState(getLocale())), []);

  // Tizim rejimida qurilma sozlamasi o'zgarsa — darhol moslashadi
  useEffect(() => {
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Boshqa tabda o'zgartirilsa — sinxronlash
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "kiddo.theme") { const p = readThemePreference(); setThemeState(p); setResolved(applyTheme(p)); }
      if (e.key === "kiddo.locale") setGlobalLocale(readStoredLocale(), { persist: false });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((l: Locale) => setGlobalLocale(l), []);
  const setTheme = useCallback((p: ThemePreference) => {
    persistThemePreference(p);
    setThemeState(p);
    setResolved(applyTheme(p));
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, theme, resolvedTheme: theme === "system" ? resolvedTheme : resolveTheme(theme), setTheme }),
    [locale, setLocale, theme, resolvedTheme, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </PreferencesContext.Provider>
  );
}

const FALLBACK: PreferencesState = {
  locale: "uz", setLocale: () => {}, theme: "system", resolvedTheme: "light", setTheme: () => {},
};

/** Provider tashqarisida (masalan, izolyatsiyalangan testlarda) xavfsiz default qaytaradi. */
export function usePreferences(): PreferencesState {
  return useContext(PreferencesContext) ?? FALLBACK;
}

/**
 * Joriy tilga obuna. Har bir sahifa va layout komponentining boshida chaqiriladi — til almashganda
 * komponent (va uning ichidagi daraxt) holat yo'qolmasdan qayta render qilinadi.
 */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
