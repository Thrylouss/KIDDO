import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KIDDO — Bog'cha boshqaruv tizimi",
  description: "O'zbekiston bog'chalari uchun oddiy va qulay boshqaruv platformasi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
