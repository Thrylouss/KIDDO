import { redirect } from "next/navigation";

/**
 * Eski sahifa: bog'chaga tegishli ma'lumotlar (bolalar, guruhlar, tarbiyachilar, ota-onalar) Super Admin uchun
 * faqat «Bog'cha paneliga kirish» (faqat ko'rish) orqali ochiladi — bu yerdan to'g'ridan-to'g'ri API 403 qaytarardi.
 */
export default function LegacyAdminOrgDataPage() {
  redirect("/admin/bogchalar");
}
