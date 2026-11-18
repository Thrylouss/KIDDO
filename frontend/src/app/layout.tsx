import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

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
    <html lang="uz" data-theme="light" className={geist.variable} suppressHydrationWarning>
      <head>
        {/* Mavzu va til atributlarini birinchi bo'yashdan oldin o'rnatadi (miltillashsiz) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
