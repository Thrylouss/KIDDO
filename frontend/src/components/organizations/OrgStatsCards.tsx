import uz from "@/i18n/uz";
import type { OrgStats } from "@/types";
import type { OrgFilters } from "@/lib/organizations";

const t = uz.bogchalar;

type Key = "total" | "davlat" | "xususiy" | "active" | "suspended" | "archived";

const CARDS: { key: Key; label: string; patch: Partial<OrgFilters>; icon: string; tone: string }[] = [
  { key: "total",     label: t.st_jami,        patch: { type: "", status: "" },          tone: "bg-[#8E315D] text-white",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { key: "davlat",    label: t.st_davlat,      patch: { type: "davlat", status: "" },    tone: "bg-[#EEF2FF] text-[#3730A3]",
    icon: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" },
  { key: "xususiy",   label: t.st_xususiy,     patch: { type: "xususiy", status: "" },   tone: "bg-[#FDF2F6] text-[#8E315D]",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "active",    label: t.st_faol,        patch: { type: "", status: "active" },    tone: "bg-[#F0FDF4] text-[#166534]",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "suspended", label: t.st_toxtatilgan, patch: { type: "", status: "suspended" }, tone: "bg-[#FFFBEB] text-[#92400E]",
    icon: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "archived",  label: t.st_arxiv,       patch: { type: "", status: "archived" },  tone: "bg-[#F2ECF0] text-[#766B73]",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
];

/** Statistika kartochkalari — bosilganda tegishli filtr qo'llanadi. */
export default function OrgStatsCards({ stats, loading, filters, onApply }: {
  stats: OrgStats | null; loading: boolean; filters: OrgFilters; onApply: (patch: Partial<OrgFilters>) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5" aria-label={t.st_izoh}>
      {CARDS.map((c) => {
        const selected = (c.patch.type ?? "") === filters.type && (c.patch.status ?? "") === filters.status;
        return (
          <button key={c.key} type="button" onClick={() => onApply(c.patch)} aria-pressed={selected} data-testid={`stat-${c.key}`}
            className={`group flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[#8E315D]/30
              ${selected ? "border-[#8E315D] ring-1 ring-[#8E315D]/20" : "border-[#EDE3E8] hover:border-[#D9C9D1]"}`}>
            <span className={`h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center ${c.tone}`}>
              <svg className="h-4.5 w-4.5 h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
            </span>
            <span className="min-w-0">
              {loading || !stats
                ? <span className="block h-6 w-10 rounded bg-[#F2ECF0] animate-pulse" />
                : <span className="block text-xl font-bold leading-tight text-[#29232A]">{stats[c.key]}</span>}
              <span className="block truncate text-xs text-[#766B73]">{c.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
