/**
 * KIDDO Smart Safety feature flag (frontend). Standart — O'CHIQ.
 * Yoqish: NEXT_PUBLIC_SMART_SAFETY_DEMO=true (build vaqtida). Backend API alohida: SMART_SAFETY_ENABLED.
 * O'chiq bo'lsa: sidebar bandlari, landing bo'limi va sahifalar ko'rsatilmaydi.
 */
export const SMART_SAFETY_DEMO = process.env.NEXT_PUBLIC_SMART_SAFETY_DEMO === "true";
