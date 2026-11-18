import uz from "@/i18n";

interface PaginationProps {
  meta: { current_page: number; last_page: number; total: number };
  onPage: (page: number) => void;
}

/** Joriy sahifa atrofidagi raqamlar (1 … 4 5 6 … 20) — har qanday sahifaga o'tish mumkin. */
export function pageWindow(current: number, last: number): (number | "…")[] {
  const set = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const pages = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export default function Pagination({ meta, onPage }: PaginationProps) {
  if (meta.last_page <= 1) return null;
  const btn = "px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--label)] disabled:opacity-40 hover:bg-[var(--hover)] transition-colors";
  return (
    <nav aria-label={uz.common.sahifa} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-[var(--border)]">
      <p className="text-sm text-[var(--text-2)]">{uz.common.jami} {meta.total} {uz.common.ta}</p>
      <div className="flex flex-wrap items-center gap-1">
        <button onClick={() => onPage(meta.current_page - 1)} disabled={meta.current_page <= 1} className={btn}>{uz.common.oldingi}</button>
        {pageWindow(meta.current_page, meta.last_page).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-[var(--text-3)]" aria-hidden="true">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)} aria-current={p === meta.current_page ? "page" : undefined}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${p === meta.current_page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"}`}>
              {p}
            </button>
          ),
        )}
        <button onClick={() => onPage(meta.current_page + 1)} disabled={meta.current_page >= meta.last_page} className={btn}>{uz.common.keyingi}</button>
      </div>
    </nav>
  );
}
