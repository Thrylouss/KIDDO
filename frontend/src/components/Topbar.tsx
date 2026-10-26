"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import uz from "@/i18n/uz";

const pathLabels: Record<string, string> = {
  "/admin/dashboard":      "Platforma dashboardi",
  "/admin/bogchalar":      uz.super_admin.bogchalar,
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
  "/tarbiyachi/dashboard": uz.tarbiyachi_panel.mening_guruhim,
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
        {/* Notification placeholder */}
        <button className="p-2 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border-2)] transition-colors relative">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <Avatar name={user?.name ?? "?"} size="sm" />
          <div className="hidden sm:block text-right leading-tight">
            <p className="text-sm font-medium text-[var(--text)] leading-none">{user?.name ?? "—"}</p>
            <p className="text-xs text-[var(--text-3)] capitalize mt-0.5">{user?.role ?? ""}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
