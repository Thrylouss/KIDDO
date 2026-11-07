import uz from "@/i18n/uz";
import type { ParentRelation } from "@/types";

interface ApiError {
  status?: number;
  data?: { message?: string; errors?: Record<string, string[]> };
}

/** 422 javobidagi maydon xatolari; boshqa holatlarda bo'sh obyekt. */
export function fieldErrors(err: unknown): Record<string, string[]> {
  const e = err as ApiError;
  return e?.status === 422 ? e.data?.errors ?? {} : {};
}

/** api.ts tashlagan xatoni foydalanuvchiga ko'rsatiladigan o'zbekcha xabarga aylantiradi. */
export function errorMessage(err: unknown): string {
  const e = err as ApiError;
  switch (e?.status) {
    case undefined: return uz.auth.tarmoq_xatosi;          // fetch umuman bajarilmadi
    case 403:       return uz.common.ruxsat_yoq;
    case 404:       return e.data?.message ?? uz.common.topilmadi;
    // Maydon xatolarisiz 422 — biznes qoidasi (masalan, «Guruhda bolalar bor»): server xabari o'zbekcha
    case 422:       return e.data?.errors ? uz.auth.validatsiya_xatosi : e.data?.message ?? uz.auth.validatsiya_xatosi;
    default:        return uz.auth.server_xatosi;
  }
}

export const RELATION_LABELS: Record<ParentRelation, string> = {
  ona:   uz.ota_onalar.rel_ona,
  ota:   uz.ota_onalar.rel_ota,
  vasiy: uz.ota_onalar.rel_vasiy,
};
