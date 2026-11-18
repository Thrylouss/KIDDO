"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import NotificationBell from "@/components/NotificationBell";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import uz from "@/i18n";
import { roleLabel } from "@/lib/roles";

const pathLabels: Record<string, string> = {
  get "/admin/dashboard"() { return uz.sa_nav.platforma_dashboard; },
  get "/admin/bogchalar"() { return uz.super_admin.bogchalar; },
  get "/admin/demo-arizalar"() { return uz.demo_arizalar.sarlavha; },
  get "/admin/obunalar"() { return uz.sa_nav.obunalar; },
  get "/admin/subscriptions"() { return uz.sa_nav.obunalar; },
  get "/admin/tolovlar"() { return uz.sa_nav.tolovlar; },
  get "/admin/payments"() { return uz.sa_nav.tolovlar; },
  get "/admin/invoices"() { return uz.sa_nav.hisob_fakturalar; },
  get "/admin/tariflar"() { return uz.sa_nav.tariflar; },
  get "/admin/foydalanuvchilar"() { return uz.sa_nav.foydalanuvchilar; },
  get "/admin/xabarlar"() { return uz.sa_nav.xabarlar; },
  get "/admin/hisobotlar"() { return uz.sa_nav.hisobotlar; },
  get "/admin/faollik"() { return uz.sa_nav.faollik; },
  get "/admin/sozlamalar"() { return uz.sa_nav.sozlamalar; },
  get "/bogcha/dashboard"() { return uz.dashboard.sarlavha; },
  get "/bogcha/bolalar"() { return uz.nav.bolalar; },
  get "/bogcha/guruhlar"() { return uz.nav.guruhlar; },
  get "/bogcha/tarbiyachilar"() { return uz.nav.tarbiyachilar; },
  get "/bogcha/ota-onalar"() { return uz.nav.ota_onalar; },
  get "/bogcha/davomat"() { return uz.nav.davomat; },
  get "/bogcha/kundalik"() { return uz.nav.kundalik; },
  get "/bogcha/xabarlar"() { return uz.nav.xabarlar; },
  get "/bogcha/foto"() { return uz.nav.foto; },
  get "/bogcha/tolovlar"() { return uz.nav.tolov; },
  get "/bogcha/sozlamalar"() { return uz.nav.sozlamalar; },
  get "/tarbiyachi/dashboard"() { return uz.nav.bosh_sahifa; },
  get "/tarbiyachi/kundalik"() { return uz.nav.kundalik; },
  get "/tarbiyachi/guruh"() { return uz.nav.mening_guruhim; },
  get "/tarbiyachi/davomat"() { return uz.nav.davomat; },
  get "/tarbiyachi/xabarlar"() { return uz.nav.xabarlar; },
  get "/tarbiyachi/foto"() { return uz.nav.foto; },
  get "/tarbiyachi/sozlamalar"() { return uz.nav.sozlamalar; },
  get "/bogcha/kiddo-kids"() { return uz.kids.kutubxona; },
  get "/tarbiyachi/kiddo-kids"() { return uz.kids.talim_hordiq; },
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  function getTitle(p: string): string {
    if (pathLabels[p]) return pathLabels[p];
    if (p.startsWith("/admin/bogchalar/")) return uz.ui.bogcha;
    if (p.startsWith("/admin/tolovlar/")) return uz.ui.tolov_tafsiloti;
    if (p.startsWith("/admin/foydalanuvchilar/")) return uz.ui.foydalanuvchi;
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
        aria-label={uz.ui.menyuni_ochish}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h2 className="text-base font-semibold text-[var(--text)] flex-1 truncate">{title}</h2>

      <div className="flex items-center gap-2 sm:gap-3">
        <QuickPreferences />
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
