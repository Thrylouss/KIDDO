"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import uz from "@/i18n/uz";

type NavItem =
  | { href: string; label: string; icon: React.ReactNode; disabled?: false }
  | { label: string; icon: React.ReactNode; disabled: true };

const navItems: NavItem[] = [
  {
    href: "/tarbiyachi/dashboard",
    label: uz.tarbiyachi_panel.mening_guruhim,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: uz.nav.davomat,
    disabled: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: uz.nav.ovqat,
    disabled: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: uz.nav.xabarlar,
    disabled: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
];

interface TarbiyachiSidebarProps { onClose?: () => void; }

export default function TarbiyachiSidebar({ onClose }: TarbiyachiSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <aside className="flex flex-col w-64 h-full bg-white border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95 5.66l-.707-.707M6.757 6.757l-.707-.707m12.02 0l-.707.707M6.757 17.243l-.707.707" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--text)] tracking-tight">KIDDO</span>
          </div>
          <p className="text-[11px] text-[var(--text-3)] mt-0.5 ml-9">Tarbiyachi kabineti</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-[var(--text-3)] hover:text-[var(--label)] rounded-lg hover:bg-[var(--border-2)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-3 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-3)] cursor-default select-none"
              >
                <span className="flex-shrink-0 text-[#D9C9D1]">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] font-medium text-[var(--text-3)] bg-[var(--border-2)] px-1.5 py-0.5 rounded-full leading-none">
                  {uz.common.tez_kunda}
                </span>
              </div>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-[var(--primary-lt)] text-[var(--primary)]"
                  : "text-[var(--label)] hover:bg-[var(--bg)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              <span className={`flex-shrink-0 ${active ? "text-[var(--primary)]" : "text-[var(--text-3)] group-hover:text-[var(--text-2)]"} transition-colors`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
          <Avatar name={user?.name ?? "?"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text)] truncate">{user?.name ?? "—"}</p>
            <p className="text-xs text-[var(--text-3)]">Tarbiyachi</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-2)] hover:bg-[#FEF2F2] hover:text-[#EF4444] transition-colors duration-150"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {uz.auth.chiqish}
        </button>
      </div>
    </aside>
  );
}
