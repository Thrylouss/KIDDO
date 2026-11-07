"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, impersonation } from "@/lib/api";
import { formatUzDate } from "@/lib/dates";
import uz from "@/i18n/uz";

interface Item { id: number; title: string; message: string; type: string; read_at: string | null; created_at: string }

const t = uz.bildirishnoma;
const bellIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const btn = "p-2 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border-2)] transition-colors relative";

/**
 * Topbar qo'ng'irog'i. Rahbar — Super Admin yuborgan bildirishnomalar (GET /v1/admin/notifications);
 * Super Admin — yuborilgan xabarlar sahifasiga havola; tarbiyachida bildirishnoma yo'q — ko'rsatilmaydi.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen]     = useState(false);
  const [items, setItems]   = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin" || (user?.role === "super_admin" && impersonation.active());

  async function load() {
    try {
      const res = await api.get<{ data: Item[]; unread_count: number }>("/v1/admin/notifications");
      setItems(res?.data ?? []);
      setUnread(res?.unread_count ?? 0);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Super Admin o'qish holatini o'zgartirmaydi (impersonatsiyada faqat ko'rish)
  const canMark = user?.role === "admin";

  async function markRead(item: Item) {
    if (!canMark || item.read_at) return;
    await api.patch(`/v1/admin/notifications/${item.id}/read`).catch(() => {});
    await load();
  }

  async function markAll() {
    await api.patch("/v1/admin/notifications/read-all").catch(() => {});
    await load();
  }

  if (user?.role === "super_admin" && !impersonation.active()) {
    return <Link href="/admin/xabarlar" className={btn} aria-label={t.sarlavha}>{bellIcon}</Link>;
  }
  if (!isAdmin) return null;

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={btn} aria-label={t.ochish} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {bellIcon}
        {unread > 0 && (
          <span data-testid="bell-count" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#8E315D] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={t.sarlavha}
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-xl border border-[#EDE3E8] shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE3E8]">
            <p className="text-sm font-semibold text-[#29232A]">{t.sarlavha}</p>
            {canMark && unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-medium text-[#8E315D] hover:underline">{t.barchasi}</button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-[#F2ECF0]">
            {error ? (
              <li className="px-4 py-6 text-center text-sm text-[#B91C1C]">{t.yuklash_xato}</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-[#B8AAB2]">{t.yoq}</li>
            ) : items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#FAF5F8] ${n.read_at ? "" : "bg-[#FDF2F6]/60"}`}>
                  <p className="flex items-center gap-2 text-sm font-medium text-[#29232A]">
                    {!n.read_at && <span className="h-2 w-2 rounded-full bg-[#8E315D] flex-shrink-0" aria-hidden="true" />}
                    {n.title}
                  </p>
                  <p className="text-xs text-[#766B73] mt-0.5 whitespace-pre-line">{n.message}</p>
                  <p className="text-[11px] text-[#B8AAB2] mt-1">{formatUzDate(n.created_at.slice(0, 10))}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
