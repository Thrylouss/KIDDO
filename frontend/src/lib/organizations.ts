import uz from "@/i18n/uz";
import type { OrganizationSummary, OrgStatus, OrgType } from "@/types";

const t = uz.bogchalar;

export const ORG_TYPES: OrgType[] = ["davlat", "xususiy"];
export const ORG_STATUSES: OrgStatus[] = ["active", "inactive", "suspended", "archived"];

export const TYPE_LABELS: Record<OrgType, string> = { davlat: t.turi_davlat, xususiy: t.turi_xususiy };

export const STATUS_LABELS: Record<OrgStatus, string> = {
  active:    t.holat_active,
  inactive:  t.holat_inactive,
  suspended: t.holat_suspended,
  archived:  t.holat_archived,
};

export const STATUS_HINTS: Record<OrgStatus, string> = {
  active:    t.holat_izoh_active,
  inactive:  t.holat_izoh_inactive,
  suspended: t.holat_izoh_suspended,
  archived:  t.holat_izoh_archived,
};

/** Berry Pink tizimidagi ohanglar (Badge variantlari). */
export const STATUS_VARIANT: Record<OrgStatus, "success" | "neutral" | "warning" | "error"> = {
  active: "success", inactive: "neutral", suspended: "warning", archived: "neutral",
};

/** Eski javoblar (status maydoni yo'q) uchun is_active dan. */
export function orgStatus(org: Pick<OrganizationSummary, "status" | "is_active">): OrgStatus {
  return org.status ?? (org.is_active ? "active" : "inactive");
}

/** O'zbekiston viloyatlari (landing formasi bilan bir xil ro'yxat). */
export const REGIONS: readonly string[] = uz.landing.viloyatlar;

/** Ro'yxat filtrlari — URL query'da saqlanadi (sahifa yangilanganda tiklanadi). */
export interface OrgFilters {
  search: string;
  type: "" | OrgType;
  status: "" | OrgStatus;
  district: string;
  region: string;
  mfy: string;
  created_from: string;
  created_to: string;
  children_min: string;
  children_max: string;
  groups_min: string;
  groups_max: string;
  turi: "real" | "demo" | "all";
  sort: string;
  direction: "" | "asc" | "desc";
  page: number;
  per_page: number;
}

export const DEFAULT_FILTERS: OrgFilters = {
  search: "", type: "", status: "", district: "", region: "", mfy: "", created_from: "", created_to: "",
  children_min: "", children_max: "", groups_min: "", groups_max: "", turi: "real", sort: "newest", direction: "", page: 1, per_page: 20,
};

export const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export function filtersFromParams(params: URLSearchParams): OrgFilters {
  const f = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof OrgFilters)[]) {
    const v = params.get(key);
    if (v === null) continue;
    if (key === "page" || key === "per_page") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) (f[key] as number) = key === "per_page" && !PER_PAGE_OPTIONS.includes(n) ? 20 : n;
    } else {
      (f[key] as string) = v;
    }
  }
  if (!["", "davlat", "xususiy"].includes(f.type)) f.type = "";
  if (!["", ...ORG_STATUSES].includes(f.status)) f.status = "";
  if (!["real", "demo", "all"].includes(f.turi)) f.turi = "real";
  return f;
}

/** Standart qiymatdan farq qiladigan filtrlar → query string (API va URL uchun bir xil). */
export function filtersToQuery(f: OrgFilters, opts: { forApi?: boolean } = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof OrgFilters)[]) {
    const v = f[key];
    const def = DEFAULT_FILTERS[key];
    // API har doim turi, sort, page, per_page ni oladi; URL esa faqat o'zgarganlarini
    if (opts.forApi ? (v !== "" && v !== null) : v !== def) qs.set(key, String(v));
  }
  return qs;
}

/** Sahifa/saralash o'zgarishidan boshqa har qanday filtr — faol filtr sifatida sanaladi. */
export function activeFilterCount(f: OrgFilters): number {
  return (["search", "type", "status", "district", "region", "mfy", "created_from", "created_to",
    "children_min", "children_max", "groups_min", "groups_max"] as const)
    .filter((k) => f[k] !== "").length + (f.turi !== "real" ? 1 : 0);
}

/** 901234567 / +998 (90) 123-45-67 → +998901234567; noto'g'ri bo'lsa null. */
export function normalizeUzPhone(value: string): string | null {
  let d = value.replace(/\D/g, "");
  if (d.length === 9) d = `998${d}`;
  return /^998\d{9}$/.test(d) ? `+${d}` : null;
}

/** +998901234567 → +998 90 123 45 67 */
export function formatUzPhone(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : value;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Manzil: to'liq manzil bo'lsa — u, aks holda qismlardan. */
export function orgAddress(o: Pick<OrganizationSummary, "address" | "region" | "district" | "mfy" | "street">): string {
  if (o.address) return o.address;
  return [o.region, o.district, o.mfy, o.street].filter(Boolean).join(", ");
}

/** «Ma'lumotlarni nusxalash» uchun matn. */
export function orgClipboardText(o: OrganizationSummary): string {
  return [
    o.name,
    o.type ? `${t.col_turi}: ${TYPE_LABELS[o.type]}` : null,
    o.official_code ? `${t.f_kod}: ${o.official_code}` : null,
    orgAddress(o) ? `${t.col_manzil}: ${orgAddress(o)}` : null,
    o.phone ? `${t.col_telefon}: ${formatUzPhone(o.phone)}` : null,
    o.director_name ? `${t.col_masul}: ${o.director_name}${o.director_phone ? ` (${formatUzPhone(o.director_phone)})` : ""}` : null,
  ].filter(Boolean).join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
