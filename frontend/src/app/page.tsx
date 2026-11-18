import type { Metadata } from "next";
import LandingContent from "@/components/landing/LandingContent";
import uz from "@/i18n/uz";

const t = uz.landing;

export const metadata: Metadata = {
  title: "KIDDO — Bog'cha boshqaruv platformasi",
  description: t.hero_tavsif,
  openGraph: { title: "KIDDO — Bog'cha boshqaruv platformasi", description: t.hero_tavsif, locale: "uz_UZ", type: "website" },
};

/** Ommaviy landing: metadata server'da (SEO, O'zbekcha), kontent — tanlangan tilda (client). */
export default function LandingPage() {
  return <LandingContent />;
}
