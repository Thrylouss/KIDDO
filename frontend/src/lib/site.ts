/**
 * Public sayt (landing) sozlamalari. Aloqa ma'lumotlari faqat muhit o'zgaruvchilaridan olinadi —
 * berilmagan bo'lsa footer'da ko'rsatilmaydi (to'qima kontakt yozilmaydi).
 */
export const SITE_CONTACT = {
  phone:    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || null,
  email:    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null,
  telegram: process.env.NEXT_PUBLIC_CONTACT_TELEGRAM?.trim() || null,
  address:  process.env.NEXT_PUBLIC_CONTACT_ADDRESS?.trim() || null,
};

export const hasContact = Object.values(SITE_CONTACT).some(Boolean);

/** Telegram manzili: «@kiddo_uz» yoki «kiddo_uz» → https://t.me/kiddo_uz; to'liq URL bo'lsa — o'zi. */
export function telegramUrl(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://t.me/${value.replace(/^@/, "")}`;
}
