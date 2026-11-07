"use client";

import { ToastProvider } from "@/components/ui/Toast";

/** Bog'chalar moduli (ro'yxat, tafsilot, import) — umumiy toast bildirishnomalari. */
export default function BogchalarLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
