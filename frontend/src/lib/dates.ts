const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

/** "2026-10-28" → "28 oktabr 2026" (vaqt zonasiga bog'liq emas). */
export function formatUzDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${UZ_MONTHS[m - 1]} ${y}`;
}

export const UZ_MONTH_NAMES = UZ_MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));

/** Tug'ilgan sanadan yosh: "3 yosh 4 oy" (bugungi sanaga nisbatan). */
export function formatAge(birthIso: string, today: Date = new Date()): string {
  const [y, m, d] = birthIso.split("-").map(Number);
  if (!y || !m || !d) return "";
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  if (months < 0) return "";
  const years = Math.floor(months / 12), rest = months % 12;
  return years > 0 ? `${years} yosh${rest ? ` ${rest} oy` : ""}` : `${rest} oy`;
}

/** "HH:MM" juftligidan davomiylik: "1 soat 45 daqiqa"; tugash yo'q yoki noto'g'ri bo'lsa null. */
export function formatDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const toMin = (t: string) => { const [h, mi] = t.split(":").map(Number); return h * 60 + mi; };
  const diff = toMin(end) - toMin(start);
  if (!(diff > 0)) return null;
  const h = Math.floor(diff / 60), mi = diff % 60;
  return [h ? `${h} soat` : "", mi ? `${mi} daqiqa` : ""].filter(Boolean).join(" ");
}

/** Brauzerning mahalliy sanasi YYYY-MM-DD ko'rinishida (input[type=date] max uchun). */
export function localIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
