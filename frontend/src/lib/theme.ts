/**
 * Mavzu (Light / Dark / System). Tanlov localStorage'da saqlanadi; `<html data-theme>` — hal qilingan mavzu
 * ("light" | "dark"), `<html data-theme-pref>` — foydalanuvchi tanlovi. Birinchi bo'yashdan oldin
 * `THEME_INIT_SCRIPT` (root layout <head>) atributlarni o'rnatadi — miltillash bo'lmaydi.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "kiddo.theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"] as const;

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === "light" || v === "dark" || v === "system";
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(v)) return v;
  } catch { /* e'tiborsiz */ }
  return "system";
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", pref);
  root.style.colorScheme = resolved;
  return resolved;
}

export function persistThemePreference(pref: ThemePreference): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, pref); } catch { /* private rejim */ }
}

/** Root layout <head> ichida sinxron bajariladi (bo'yashdan oldin). Til uchun faqat `lang` atributi. */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var r=p==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.setAttribute("data-theme",r);d.setAttribute("data-theme-pref",p);d.style.colorScheme=r;var l=localStorage.getItem("kiddo.locale");if(l==="ru"||l==="en"||l==="uz")d.lang=l;}catch(e){}})();`;
