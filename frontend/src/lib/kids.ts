/** KIDDO Kids: tiplar va umumiy yordamchilar (rahbar kutubxonasi va tarbiyachi sahifasi uchun). */
import uz from "@/i18n";

export const KIDS_LANGUAGES = ["uz", "ru", "en"] as const;
export const KIDS_CATEGORIES = ["lessons", "cartoons", "languages", "music", "activities"] as const;
export const KIDS_MIN_AGE = 1;
export const KIDS_MAX_AGE = 7;

export type KidsLanguage = (typeof KIDS_LANGUAGES)[number];
export type KidsCategory = (typeof KIDS_CATEGORIES)[number];
export type KidsStatus = "active" | "hidden";

export interface KidsGroup {
  id: number;
  name: string;
  age_category?: string | null;
  age_range?: [number, number] | null;
}

export interface KidsContent {
  id: number;
  title: string;
  description: string | null;
  youtube_video_id: string;
  thumbnail_url: string;
  embed_url: string;
  watch_url: string;
  duration_seconds: number | null;
  embeddable: boolean | null;
  language: KidsLanguage;
  category: KidsCategory;
  min_age: number;
  max_age: number;
  status: KidsStatus;
  groups?: { id: number; name: string }[];
  usage_count?: number;
  is_favorite?: boolean;
}

export interface KidsPage<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number; counts?: Partial<Record<KidsStatus, number>>; youtube_api?: boolean };
  groups: KidsGroup[];
  group_id?: number | null;
}

export interface KidsPreview {
  video_id: string;
  metadata: { available: boolean; title: string | null; author: string | null; thumbnail_url: string; embeddable: boolean | null; duration_seconds: number | null };
  suggestions: { language: KidsLanguage; category: KidsCategory; min_age: number; max_age: number; group_ids: number[]; confidence: "low" | "none" };
  duplicate: boolean;
}

export interface KidsUsage {
  id: number;
  used_on: string;
  note: string | null;
  content: { id: number; title: string; deleted: boolean } | null;
  group: { id: number; name: string } | null;
  teacher: string | null;
}

/** Faqat backend qurgan, ruxsat etilgan embed manzili ishlatiladi (qo'shimcha himoya). */
export function isSafeEmbedUrl(url: string): boolean {
  return /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?/.test(url);
}

export function ageLabel(min: number, max: number): string {
  return `${min === max ? min : `${min}–${max}`} ${uz.kids.yosh_qisqa}`;
}

/** 185 → "3:05"; 3725 → "1:02:05". */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function groupMatchesAge(group: KidsGroup, min: number, max: number): boolean {
  return !group.age_range || (min <= group.age_range[1] && max >= group.age_range[0]);
}
