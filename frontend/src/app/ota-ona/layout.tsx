"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/PreferencesContext";

/**
 * Ota-onalar uchun web panel yo'q — ular KIDDO mobil ilovasidan foydalanadi (backend /v1/mobile/* va /v1/parent/*).
 * Bu manzil faqat mobil ilova haqidagi axborot sahifasini (page.tsx) ko'rsatadi: farzand ma'lumotlari web'da yuklanmaydi.
 */
export default function OtaOnaLayout({ children }: { children: React.ReactNode }) {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return <AuthProvider>{children}</AuthProvider>;
}
