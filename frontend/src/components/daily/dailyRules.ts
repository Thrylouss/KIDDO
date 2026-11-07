import uz from "@/i18n/uz";
import type { ActivityDirection, AttendanceState, DailyChild, MealType } from "@/types";

/**
 * Ovqatlanish va uyqu faqat davomatda «Keldi» deb belgilangan bolaga yoziladi.
 * «Kelmadi», «Sababli» va «Belgilanmagan» — yozib bo'lmaydi.
 * Backend ham shu qoidani majburiy tekshiradi (DailyRecordService::RECORDABLE_ATTENDANCE) va
 * boshqa holatlar uchun 422 qaytaradi — bu yerdagi tekshiruv faqat interfeys qulayligi uchun.
 */
export function canRecord(child: DailyChild): boolean {
  return child.attendance === "present";
}

export const MEAL_LABELS: Record<MealType, string> = {
  nonushta:     uz.kundalik.tur_nonushta,
  ikkinchi_nonushta: uz.kundalik.tur_ikkinchi_nonushta,
  tushlik:      uz.kundalik.tur_tushlik,
  peshinlik:    uz.kundalik.tur_peshinlik,
  kechki_ovqat: uz.kundalik.tur_kechki_ovqat,
};

export const DIRECTION_LABELS: Record<ActivityDirection, string> = {
  jismoniy:   uz.kundalik.dir_jismoniy,
  nutq:       uz.kundalik.dir_nutq,
  matematika: uz.kundalik.dir_matematika,
  tasviriy:   uz.kundalik.dir_tasviriy,
  musiqa:     uz.kundalik.dir_musiqa,
  atrof_olam: uz.kundalik.dir_atrof_olam,
  ijtimoiy:   uz.kundalik.dir_ijtimoiy,
  boshqa:     uz.kundalik.dir_boshqa,
};

type BadgeVariant = "success" | "error" | "warning" | "neutral";

const ATTENDANCE_BADGES: Record<AttendanceState | "none", { label: string; variant: BadgeVariant }> = {
  present: { label: uz.kundalik.keldi,         variant: "success" },
  absent:  { label: uz.kundalik.kelmadi,       variant: "error" },
  excused: { label: uz.kundalik.sababli,       variant: "warning" },
  none:    { label: uz.kundalik.belgilanmagan, variant: "neutral" },
};

export function attendanceBadge(status: AttendanceState | null) {
  return ATTENDANCE_BADGES[status ?? "none"];
}

export function childName(child: Pick<DailyChild, "first_name" | "last_name">): string {
  return `${child.last_name} ${child.first_name}`;
}

/** 422 javobidagi errors.records — biznes qoidasi xabarlari (masalan, «… «Kelmadi» deb belgilangan …»). */
export function recordErrors(err: unknown): string[] {
  const e = err as { status?: number; data?: { errors?: Record<string, string[]> } };
  return e?.status === 422 ? e.data?.errors?.records ?? [] : [];
}
