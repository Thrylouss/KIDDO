import uz, { getLocale, intlLocale } from "@/i18n";

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** "2026-10-28" → "28 oktabr 2026" / "28 октября 2026 г." / "28 October 2026" (vaqt zonasiga bog'liq emas). */
export function formatUzDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  if (getLocale() === "uz") return `${d} ${UZ_MONTHS[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

/** Joriy tildagi oy nomlari (bosh harf bilan): Yanvar… / Январь… / January… */
export function monthNames(): string[] {
  if (getLocale() === "uz") return UZ_MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));
  const fmt = new Intl.DateTimeFormat(intlLocale(), { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => {
    const name = fmt.format(new Date(Date.UTC(2026, i, 1)));
    return name[0].toUpperCase() + name.slice(1);
  });
}

/** Sana (+ ixtiyoriy vaqt) joriy til formatida. `null` → "—". */
export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(intlLocale(), opts);
}

/** Raqam joriy til formatida (minglik ajratgich). */
export function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString(intlLocale());
}

/** Tug'ilgan sanadan yosh: "3 yosh 4 oy" (bugungi sanaga nisbatan). */
export function formatAge(birthIso: string, today: Date = new Date()): string {
  const [y, m, d] = birthIso.split("-").map(Number);
  if (!y || !m || !d) return "";
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  if (months < 0) return "";
  const years = Math.floor(months / 12), rest = months % 12;
  const v = uz.vaqt;
  return years > 0 ? `${years} ${v.yosh}${rest ? ` ${rest} ${v.oy}` : ""}` : `${rest} ${v.oy}`;
}

/** "HH:MM" juftligidan davomiylik: "1 soat 45 daqiqa"; tugash yo'q yoki noto'g'ri bo'lsa null. */
export function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const toMin = (t: string) => { const [h, mi] = t.split(":").map(Number); return h * 60 + mi; };
  const diff = toMin(end) - toMin(start);
  if (!(diff > 0)) return null;
  const h = Math.floor(diff / 60), mi = diff % 60;
  return [h ? `${h} ${uz.vaqt.soat}` : "", mi ? `${mi} ${uz.vaqt.daqiqa}` : ""].filter(Boolean).join(" ");
}

/** Brauzerning mahalliy sanasi YYYY-MM-DD ko'rinishida (input[type=date] max uchun). */
export function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
