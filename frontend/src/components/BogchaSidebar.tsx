"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { impersonation } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import Avatar from "@/components/ui/Avatar";
import uz from "@/i18n/uz";

interface ActiveItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: false;
}

interface DisabledItem {
  label: string;
  icon: React.ReactNode;
  disabled: true;
}

type NavItem = ActiveItem | DisabledItem;

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: uz.sidebar.asosiy,
    items: [
      {
        href: "/bogcha/dashboard",
        label: uz.nav.boshqaruv_paneli,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: uz.sidebar.boshqaruv,
    items: [
      {
        href: "/bogcha/bolalar",
        label: uz.nav.bolalar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: "/bogcha/guruhlar",
        label: uz.nav.guruhlar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        href: "/bogcha/tarbiyachilar",
        label: uz.nav.tarbiyachilar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        href: "/bogcha/ota-onalar",
        label: uz.nav.ota_onalar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: uz.sidebar.kunlik_faoliyat,
    items: [
      {
        href: "/bogcha/davomat",
        label: uz.nav.davomat,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        // Ovqatlanish, uyqu va mashg'ulotlar bitta sahifada (bo'limlar)
        href: "/bogcha/kundalik",
        label: uz.nav.kundalik,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: uz.sidebar.aloqa,
    items: [
      {
        href: "/bogcha/xabarlar",
        label: uz.nav.xabarlar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
      },
      {
        href: "/bogcha/foto",
        label: uz.nav.foto,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: uz.sidebar.moliya,
    items: [
      {
        href: "/bogcha/tolovlar",
        label: uz.nav.tolov,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: uz.sidebar.sozlamalar_group,
    items: [
      {
        href: "/bogcha/sozlamalar",
        label: uz.nav.sozlamalar,
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

interface BogchaSidebarProps {
  onClose?: () => void;
}

export default function BogchaSidebar({ onClose }: BogchaSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    // Super admin leaving an impersonated org: not a logout, the session stays.
    if (impersonation.active()) {
      impersonation.end();
      window.location.href = "/admin/bogchalar";
      return;
    }
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
          <p className="text-[11px] text-[var(--text-3)] mt-0.5 ml-9">Boshqaruv tizimi</p>
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
      <nav className="flex-1 px-3 pb-3 overflow-y-auto space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
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
                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
          <Avatar name={user?.name ?? "?"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text)] truncate">{user?.name ?? "—"}</p>
            <p className="text-xs text-[var(--text-3)]">
              {user?.role === "super_admin" ? "Bosh admin" : roleLabel(user?.role)}
            </p>
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
