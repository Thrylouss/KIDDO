"use client";

import { useState } from "react";
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
    label: uz.nav.bosh_sahifa,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/tarbiyachi/guruh",
    label: uz.nav.mening_guruhim,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/tarbiyachi/davomat",
    label: uz.nav.davomat,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    // Ovqatlanish, uyqu va mashg'ulotlar bitta sahifada (bo'limlar)
    href: "/tarbiyachi/kundalik",
    label: uz.nav.kundalik,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/tarbiyachi/xabarlar",
    label: uz.nav.xabarlar,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },  {
    href: "/tarbiyachi/foto",
    label: uz.nav.foto,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/tarbiyachi/sozlamalar",
    label: uz.nav.sozlamalar,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface TarbiyachiSidebarProps { onClose?: () => void; }

export default function TarbiyachiSidebar({ onClose }: TarbiyachiSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError(uz.auth.chiqish_xatosi);
      return;
    }
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
        {logoutError && (
          <p role="alert" className="px-3 pt-1 text-xs text-[#B91C1C]">{logoutError}</p>
        )}
      </div>
    </aside>
  );
}
