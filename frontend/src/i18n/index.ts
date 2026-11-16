/**
 * KIDDO i18n — markazlashtirilgan, kengaytiriladigan tarjima tizimi.
 *
 * - `uz.ts` — asosiy (manba) lug'at va tiplar manbai. Yangi kalit avval shu yerga qo'shiladi.
 * - `ru.ts`, `en.ts` — tarjimalar. Kalit yetishmasa, O'zbek tiliga fallback qilinadi.
 * - Default eksport (`t`) — joriy tilni o'qiydigan Proxy: `t.common.saqlash` render paytida
 *   tanlangan tildagi matnni qaytaradi. Komponentlar `import uz from "@/i18n"` ko'rinishida foydalanadi.
 * - Til almashtirilganda `PreferencesProvider` daraxtni qayta render qiladi (sahifa qayta yuklanmaydi).
 *
 * Server'da (SSR) til doim O'zbekcha bo'ladi — gidratatsiya mos keladi; brauzerda saqlangan til
 * gidratatsiyadan so'ng darhol (bo'yashdan oldin) qo'llanadi.
 */
import uzDict, { type UzTranslations } from "./uz";
import ru from "./ru";
import en from "./en";

export type Locale = "uz" | "ru" | "en";

export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALES: readonly Locale[] = ["uz", "ru", "en"] as const;

/** Til tanlash ro'yxatida har doim o'z tilida ko'rsatiladi. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

export const LOCALE_SHORT: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" };

/** Intl API uchun BCP 47 teglari (sana, vaqt, raqam formatlari). */
export const INTL_LOCALE: Record<Locale, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/** Tarjima fayllari uchun tip: uz.ts tuzilmasi, qiymatlari ixtiyoriy matn. */
export type Dictionary = DeepPartial<DeepString<UzTranslations>>;

const DICTS: Record<Locale, unknown> = { uz: uzDict, ru, en };

export const LOCALE_STORAGE_KEY = "kiddo.locale";
export const LOCALE_COOKIE = "kiddo_locale";

export function isLocale(v: unknown): v is Locale {
  return v === "uz" || v === "ru" || v === "en";
}

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** Joriy tilni o'rnatadi va saqlaydi. Server'da hech narsa qilmaydi (so'rovlar o'rtasida til aralashmasin). */
export function setLocale(locale: Locale, { persist = true }: { persist?: boolean } = {}): void {
  if (typeof window === "undefined" || !isLocale(locale)) return;
  if (persist) {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* private rejim */ }
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }
  if (locale === current) return;
  current = locale;
  document.documentElement.lang = locale;
  listeners.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Brauzerda saqlangan til (yo'q bo'lsa — default). */
export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(v)) return v;
  } catch { /* e'tiborsiz */ }
  const m = document.cookie.match(/(?:^|; )kiddo_locale=([^;]*)/);
  return m && isLocale(m[1]) ? m[1] : DEFAULT_LOCALE;
}

export function intlLocale(locale: Locale = current): string {
  return INTL_LOCALE[locale];
}

/**
 * Son bilan keladigan ot uchun to'g'ri ko'plik shakli. Lug'atda shakllar «|» bilan yoziladi:
 * ru — «один|несколько|много» (1 результат, 2 результата, 5 результатов), en — «one|other».
 * «|» bo'lmasa (masalan, O'zbekcha) matn o'zgarishsiz qaytadi.
 */
export function plural(n: number, text: string): string {
  if (!text.includes("|")) return text;
  const forms = text.split("|");
  const cat = new Intl.PluralRules(intlLocale()).select(n);
  if (forms.length >= 3) return cat === "one" ? forms[0] : cat === "few" ? forms[1] : cat === "many" ? forms[2] : forms[1];
  return cat === "one" ? forms[0] : forms[forms.length - 1];
}

function resolve(locale: Locale, path: readonly string[]): unknown {
  let node: unknown = DICTS[locale];
  for (const key of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

const proxyCache = new Map<string, object>();

function scope(path: readonly string[], base: object): object {
  const cacheKey = path.join(".");
  const cached = proxyCache.get(cacheKey);
  if (cached) return cached;
  const proxy = new Proxy(base, {
    get(target, key, receiver) {
      const fallback = Reflect.get(target, key, receiver);
      if (typeof key === "symbol") return fallback;
      if (fallback !== null && typeof fallback === "object") return scope([...path, key], fallback);
      if (typeof fallback === "string") {
        if (current === DEFAULT_LOCALE) return fallback;
        const value = resolve(current, [...path, key]);
        return typeof value === "string" ? value : fallback;
      }
      return fallback;
    },
  });
  proxyCache.set(cacheKey, proxy);
  return proxy;
}

/** Joriy tildagi lug'at (fallback — O'zbekcha). */
const t = scope([], uzDict) as UzTranslations;

export default t;
