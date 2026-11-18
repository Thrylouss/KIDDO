"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { useLocale } from "@/contexts/PreferencesContext";

/** Bog'chalar moduli (ro'yxat, tafsilot, import) — umumiy toast bildirishnomalari. */
export default function BogchalarLayout({ children }: { children: React.ReactNode }) {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return <ToastProvider>{children}</ToastProvider>;
}
