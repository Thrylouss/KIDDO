/**
 * Smart xavfsizlik navigatsiyasi: har bir rol faqat o'z bo'limlarini ko'radi. Barcha 23 funksional modul
 * shu bo'limlar ichida (progressiv ochilish bilan) joylashgan — `modules` ro'yxati qamrovni hujjatlashtiradi va testlanadi.
 */
import type { Role } from "./model";

export type IconName =
  | "home" | "map" | "children" | "attendance" | "count" | "handover" | "bell" | "activity" | "device" | "report"
  | "settings" | "building" | "shield";

export interface SmartSection { slug: string; label: string; icon: IconName; modules: string[]; }

/** Bo'lim nomlari i18n kalitlari (uz.ss.nav_sections.*) — `label` maydoni kalit. */
export const SECTIONS: Record<Exclude<Role, "parent">, SmartSection[]> = {
  super_admin: [
    { slug: "", label: "overview", icon: "home", modules: ["global"] },
    { slug: "bogchalar", label: "kindergartens", icon: "building", modules: ["allocation"] },
    { slug: "qurilmalar", label: "devices", icon: "device", modules: ["inventory"] },
    { slug: "hisobotlar", label: "reports", icon: "report", modules: ["analytics"] },
    { slug: "sozlamalar", label: "settings", icon: "settings", modules: ["diagnostics", "integrations", "features", "audit"] },
  ],
  director: [
    { slug: "", label: "overview", icon: "home", modules: ["dashboard"] },
    { slug: "xarita", label: "map", icon: "map", modules: ["map", "geofence", "cctv", "staff"] },
    { slug: "bolalar", label: "children", icon: "children", modules: ["evacuation", "headcount", "pickup", "bus", "health", "activity", "sleep", "meal"] },
    { slug: "davomat", label: "attendance", icon: "attendance", modules: ["attendance"] },
    { slug: "ogohlantirishlar", label: "alerts", icon: "bell", modules: ["alerts", "sos", "removal"] },
    { slug: "qurilmalar", label: "devices", icon: "device", modules: ["devices", "assignment", "battery"] },
    { slug: "hisobotlar", label: "reports", icon: "report", modules: ["analytics"] },
    { slug: "sozlamalar", label: "settings", icon: "settings", modules: ["geofence", "audit", "integrations"] },
  ],
  teacher: [
    { slug: "", label: "overview", icon: "home", modules: ["dashboard"] },
    { slug: "xarita", label: "map", icon: "map", modules: ["map"] },
    { slug: "davomat", label: "attendance", icon: "attendance", modules: ["attendance"] },
    { slug: "sanash", label: "headcount", icon: "count", modules: ["headcount", "evacuation"] },
    { slug: "topshirish", label: "pickup", icon: "handover", modules: ["pickup"] },
    { slug: "ogohlantirishlar", label: "alerts", icon: "bell", modules: ["alerts", "sos", "removal", "battery"] },
    { slug: "faollik", label: "activity", icon: "activity", modules: ["activity", "sleep", "meal"] },
  ],
};

/** Panel ichidagi asosiy yo'l (mavjud rol layoutlari va ruxsatlari bilan). */
export const ROLE_BASE: Record<Exclude<Role, "parent">, string> = {
  super_admin: "/admin/smart-safety",
  director: "/bogcha/smart-safety",
  teacher: "/tarbiyachi/smart-safety",
};

/** Taqdimot rejimidagi rol slug'lari (/smart-safety/<rol>/<bo'lim>). */
export const PRESENT_ROLE: Record<Role, string> = { director: "rahbar", teacher: "tarbiyachi", super_admin: "admin", parent: "ota-ona" };
export const ROLE_FROM_SLUG: Record<string, Role> = { rahbar: "director", tarbiyachi: "teacher", admin: "super_admin", "ota-ona": "parent" };

export function sectionHref(base: string, slug: string, query = ""): string {
  return `${base}${slug ? `/${slug}` : ""}${query}`;
}

/** 23 funksional modulning barchasi kamida bitta rol bo'limida mavjudligini tekshirish uchun. */
export const ALL_MODULES = [
  "dashboard", "devices", "assignment", "map", "attendance", "geofence", "alerts", "sos", "headcount", "pickup", "removal",
  "battery", "evacuation", "analytics", "activity", "sleep", "meal", "cctv", "bus", "health", "staff", "audit", "integrations",
] as const;
