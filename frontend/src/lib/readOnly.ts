"use client";

import { useEffect, useState } from "react";

/** api.ts → impersonation.start() shu kalitga yozadi. */
const IMPERSONATION_KEY = "impersonated_org_id";

/** Super Admin bog'cha paneliga «faqat ko'rish» rejimida kirganmi (sessionStorage). */
export function isReadOnlySession(): boolean {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return false;
  }
}

/**
 * Super Admin bog'cha paneliga «faqat ko'rish» rejimida kirgan (impersonatsiya) — barcha sahifalar uchun yagona belgi.
 * Bu holatda qo'shish/tahrirlash/o'chirish/davomat belgilash tugmalari ko'rsatilmaydi. Asosiy himoya backend'da:
 * SuperAdminReadOnlyMiddleware har qanday mutatsiyani 403 bilan rad etadi va urinishni audit logga yozadi.
 * Qiymat mount'dan keyin o'qiladi — SSR bilan mos.
 */
export function useReadOnly(): boolean {
  const [readOnly, setReadOnly] = useState(false);
  useEffect(() => { setReadOnly(isReadOnlySession()); }, []);
  return readOnly;
}
