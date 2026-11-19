"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import uz from "@/i18n";
import { SECTIONS, sectionHref, type SmartSection } from "@/lib/smart-safety/nav";
import type { Role } from "@/lib/smart-safety/model";
import { useSafety } from "./shared";
import Icon from "./Icons";

type StaffRole = Exclude<Role, "parent">;

/** Bo'lim nomi joriy tilda (tarbiyachida «Davomat» — qisqa va tushunarli). */
export function sectionLabel(role: StaffRole, s: SmartSection): string {
  if (role === "teacher" && s.label === "attendance") return uz.ssx.teacher_attendance;
  return (uz.ssx.sections as Record<string, string>)[s.label] ?? s.label;
}

/** Feature flag'lari o'chirilgan bo'limlar ko'rsatilmaydi (Super Admin → Funksiyalar). */
const SECTION_FLAG: Record<string, string> = { xarita: "live_map", davomat: "smart_attendance", topshirish: "pickup", sanash: "evacuation", faollik: "v2_modules" };

export function useSections(role: StaffRole): SmartSection[] {
  const { state } = useSafety();
  return SECTIONS[role].filter((s) => !SECTION_FLAG[s.slug] || state.features[SECTION_FLAG[s.slug]] !== false);
}

function isActive(pathname: string, base: string, slug: string) {
  const href = sectionHref(base, slug);
  return slug ? pathname === href || pathname.startsWith(href + "/") : pathname === base;
}

/** Bo'limlar ro'yxati (sidebar guruhi va taqdimot menyusi uchun umumiy). */
export function SectionLinks({ role, base, onNavigate, dense = false }: { role: StaffRole; base: string; onNavigate?: () => void; dense?: boolean }) {
  const pathname = usePathname() ?? "";
  const { state } = useSafety();
  const sections = useSections(role);
  const urgent = state.incidents.filter((i) => i.status !== "resolved" && i.severity !== "warning").length;
  return (
    <ul className="space-y-0.5" data-testid={`smart-nav-${role}`}>
      {sections.map((s) => {
        const active = isActive(pathname, base, s.slug);
        return (
          <li key={s.slug || "home"}>
            <Link href={sectionHref(base, s.slug)} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg ${dense ? "px-3 py-1.5" : "px-3 py-2"} text-sm font-medium transition-colors ${active ? "bg-[var(--primary-lt)] text-[var(--primary)]" : "text-[var(--label)] hover:bg-[var(--bg)] hover:text-[var(--text)]"}`}>
              <span className={active ? "text-[var(--primary)]" : "text-[var(--text-3)]"}><Icon name={s.icon} className="h-4 w-4" /></span>
              <span className="flex-1 leading-snug">{sectionLabel(role, s)}</span>
              {s.slug === "ogohlantirishlar" && urgent > 0 && role !== "super_admin" && (
                <span className="rounded-full bg-[var(--error-text)] px-1.5 text-[11px] font-semibold leading-5 text-white">{urgent}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Mavjud sidebar ichidagi yig'iladigan «Smart xavfsizlik» guruhi. Faqat shu rolga tegishli bo'limlar ko'rinadi.
 * Joriy sahifa Smart xavfsizlik ichida bo'lsa — avtomatik ochiq.
 */
export function SmartNavGroup({ role, base, onNavigate }: { role: StaffRole; base: string; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const inside = pathname === base || pathname.startsWith(base + "/");
  const [open, setOpen] = useState(inside);
  const expanded = open || inside;
  return (
    <div data-testid="smart-nav-group">
      <button type="button" onClick={() => setOpen(!expanded)} aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${inside ? "text-[var(--primary)]" : "text-[var(--label)] hover:bg-[var(--bg)] hover:text-[var(--text)]"}`}>
        <span className={inside ? "text-[var(--primary)]" : "text-[var(--text-3)]"}><Icon name="shield" className="h-4 w-4" /></span>
        <span className="flex-1 leading-snug">{uz.ss.nav}</span>
        <span className={`text-[var(--text-3)] transition-transform ${expanded ? "rotate-90" : ""}`}><Icon name="chevron" className="h-4 w-4" /></span>
      </button>
      {expanded && <div className="ml-4 mt-0.5 border-l border-[var(--border)] pl-2"><SectionLinks role={role} base={base} onNavigate={onNavigate} dense /></div>}
    </div>
  );
}
