import type { Metadata } from "next";

/** Taqdimot rejimi: faqat sintetik ma'lumot; qidiruv tizimlarida indekslanmaydi. */
export const metadata: Metadata = {
  title: "KIDDO Smart Safety — Taqdimot (DEMO)",
  robots: { index: false, follow: false },
};

export default function SmartSafetyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
