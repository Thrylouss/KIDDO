"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import NotificationBell from "@/components/NotificationBell";
import uz from "@/i18n/uz";
import { roleLabel } from "@/lib/roles";

const pathLabels: Record<string, string> = {
  "/admin/dashboard":      "Platforma dashboardi",
  "/admin/bogchalar":      uz.super_admin.bogchalar,
  "/admin/demo-arizalar":  uz.demo_arizalar.sarlavha,
  "/admin/obunalar":       "Obunalar",
  "/admin/subscriptions":  "Obunalar",
  "/admin/tolovlar":       "To'lovlar",
  "/admin/payments":       "To'lovlar",
  "/admin/invoices":       "Hisoblar",
  "/admin/tariflar":       "Tariflar",
  "/admin/foydalanuvchilar": "Foydalanuvchilar",
  "/admin/xabarlar":       "Xabarlar",
  "/admin/hisobotlar":     "Hisobotlar",
  "/admin/faollik":        "Faollik",
  "/admin/sozlamalar":     "Sozlamalar",
  "/bogcha/dashboard":     uz.dashboard.sarlavha,
  "/bogcha/bolalar":       uz.nav.bolalar,
  "/bogcha/guruhlar":      uz.nav.guruhlar,
  "/bogcha/tarbiyachilar": uz.nav.tarbiyachilar,
  "/bogcha/ota-onalar":    uz.nav.ota_onalar,
  "/bogcha/davomat":       uz.nav.davomat,
  "/bogcha/kundalik":      uz.nav.kundalik,
  "/bogcha/xabarlar":      uz.nav.xabarlar,
  "/bogcha/foto":          uz.nav.foto,
  "/bogcha/tolovlar":      uz.nav.tolov,
  "/bogcha/sozlamalar":    uz.nav.sozlamalar,
  "/tarbiyachi/dashboard": uz.nav.bosh_sahifa,
  "/tarbiyachi/kundalik":  uz.nav.kundalik,
  "/tarbiyachi/guruh":     uz.nav.mening_guruhim,
  "/tarbiyachi/davomat":   uz.nav.davomat,
  "/tarbiyachi/xabarlar":  uz.nav.xabarlar,
  "/tarbiyachi/foto":      uz.nav.foto,
  "/tarbiyachi/sozlamalar": uz.nav.sozlamalar,
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  function getTitle(p: string): string {
    if (pathLabels[p]) return pathLabels[p];
    if (p.startsWith("/admin/bogchalar/")) return "Bog'cha";
    if (p.startsWith("/admin/tolovlar/")) return "To'lov tafsiloti";
    if (p.startsWith("/admin/foydalanuvchilar/")) return "Foydalanuvchi";
    if (p.startsWith("/tarbiyachi/bolalar/")) return uz.guruh.profil;
    return "KIDDO";
  }
  const title = getTitle(pathname);

  return (
    <header className="h-14 flex items-center gap-4 px-4 sm:px-6 bg-white border-b border-[var(--border)] flex-shrink-0">
      {/* Mobile burger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border-2)] transition-colors"
        aria-label="Menyuni ochish"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h2 className="text-base font-semibold text-[var(--text)] flex-1 truncate">{title}</h2>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <Avatar name={user?.name ?? "?"} size="sm" />
          <div className="hidden sm:block text-right leading-tight">
            <p className="text-sm font-medium text-[var(--text)] leading-none">{user?.name ?? "—"}</p>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{roleLabel(user?.role)}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
