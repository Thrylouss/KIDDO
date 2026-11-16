import uz from "@/i18n";
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
  get nonushta() { return uz.kundalik.tur_nonushta; },
  get ikkinchi_nonushta() { return uz.kundalik.tur_ikkinchi_nonushta; },
  get tushlik() { return uz.kundalik.tur_tushlik; },
  get peshinlik() { return uz.kundalik.tur_peshinlik; },
  get kechki_ovqat() { return uz.kundalik.tur_kechki_ovqat; },
};

export const DIRECTION_LABELS: Record<ActivityDirection, string> = {
  get jismoniy() { return uz.kundalik.dir_jismoniy; },
  get nutq() { return uz.kundalik.dir_nutq; },
  get matematika() { return uz.kundalik.dir_matematika; },
  get tasviriy() { return uz.kundalik.dir_tasviriy; },
  get musiqa() { return uz.kundalik.dir_musiqa; },
  get atrof_olam() { return uz.kundalik.dir_atrof_olam; },
  get ijtimoiy() { return uz.kundalik.dir_ijtimoiy; },
  get boshqa() { return uz.kundalik.dir_boshqa; },
};

type BadgeVariant = "success" | "error" | "warning" | "neutral";

const ATTENDANCE_BADGES: Record<AttendanceState | "none", { label: string; variant: BadgeVariant }> = {
  present: { get label() { return uz.kundalik.keldi; },         variant: "success" },
  absent: { get label() { return uz.kundalik.kelmadi; },       variant: "error" },
  excused: { get label() { return uz.kundalik.sababli; },       variant: "warning" },
  none: { get label() { return uz.kundalik.belgilanmagan; }, variant: "neutral" },
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
