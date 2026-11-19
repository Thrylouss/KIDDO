"use client";

import uz from "@/i18n";
import Badge from "@/components/ui/Badge";
import { ageLabel, formatVideoDuration, type KidsContent } from "@/lib/kids";

interface Props {
  content: KidsContent;
  onPlay: () => void;
  /** Karta pastidagi amallar (rahbar: tahrirlash/yashirish/o'chirish; tarbiyachi: sevimli). */
  actions?: React.ReactNode;
  /** Karta ichidagi qo'shimcha ma'lumot (rahbar: guruhlar, foydalanish soni). */
  extra?: React.ReactNode;
}

export default function ContentCard({ content, onPlay, actions, extra }: Props) {
  const t = uz.kids;
  const duration = formatVideoDuration(content.duration_seconds);

  return (
    <article className={`group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-lg hover:shadow-black/5 ${content.status === "hidden" ? "opacity-70" : ""}`}
      data-testid="kids-card">
      <button type="button" onClick={onPlay} aria-label={`${t.tomosha}: ${content.title}`}
        className="relative block aspect-video w-full overflow-hidden bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--card)]/90 text-[var(--primary)] shadow-lg opacity-90 group-hover:opacity-100">
            <svg className="h-5 w-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" /></svg>
          </span>
        </span>
        {duration && <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{duration}</span>}
        {content.status === "hidden" && <span className="absolute left-2 top-2"><Badge variant="neutral">{t.yashirin}</Badge></span>}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">{content.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="info">{content.language.toUpperCase()}</Badge>
          <Badge variant="neutral">{ageLabel(content.min_age, content.max_age)}</Badge>
          <Badge variant="neutral">{t.kat[content.category]}</Badge>
        </div>
        {extra}
        {actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
      </div>
    </article>
  );
}
