"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import uz from "@/i18n";
import { PLAN, ZONES } from "@/lib/smart-safety/model";

/** Landing: Smart Safety mahsulot ko'rinishi (Tez kunda). Faqat illyustratsiya — admin vositalari va shaxsiy ma'lumot yo'q. */
const PATHS: [number, number][][] = [
  [[50, 54], [50, 29], [15, 12], [15, 45], [20, 50]],
  [[48, 54], [30, 29], [45, 12], [70, 29], [69, 12]],
  [[52, 54], [75, 29], [79, 47], [65, 45], [50, 54]],
];

export default function SmartSafetyTeaser() {
  const t = uz.ss.landing;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((x) => x + 1), 1800);
    return () => clearInterval(id);
  }, []);
  const alertOn = tick % 5 === 4;

  return (
    <section id="smart-safety" className="py-20 sm:py-24" aria-labelledby="ss-teaser-title" data-testid="smart-safety-teaser">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">{t.eyebrow}</p>
          <h2 id="ss-teaser-title" className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">{t.title}</h2>
          <p className="mt-4 text-[var(--text-2)]">{t.desc}</p>
          <ul className="mt-6 space-y-2">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-[var(--label)]"><span aria-hidden="true" className="mt-0.5 text-[var(--primary)]">✓</span>{p}</li>
            ))}
          </ul>
          <Link href="/smart-safety" className="mt-8 inline-flex h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-h)]">{t.cta}</Link>
          <p className="mt-4 text-xs text-[var(--text-3)]">{t.disclaimer}</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl shadow-black/5">
          <svg viewBox={`0 0 ${PLAN.width} ${PLAN.height}`} className="block h-auto w-full" role="img" aria-label={t.title}>
            {ZONES.map((z) => (
              <rect key={z.id} x={z.rect[0]} y={z.rect[1]} width={z.rect[2]} height={z.rect[3]} rx={0.8}
                fill={z.restricted ? "var(--error-bg)" : z.kind === "playground" ? "var(--primary-lt)" : "var(--surface-2)"}
                stroke={z.restricted ? "var(--error-text)" : "var(--border-strong)"} strokeWidth={0.25} />
            ))}
            {PATHS.map((path, i) => {
              const [x, y] = path[(tick + i) % path.length];
              const danger = alertOn && i === 1;
              return <circle key={i} r={2} fill={danger ? "var(--error-text)" : "var(--primary)"} stroke="var(--card)" strokeWidth={0.5}
                style={{ transform: `translate(${danger ? 69 : x}px, ${danger ? 12 : y}px)`, transition: "transform 1.6s ease-in-out" }} />;
            })}
          </svg>
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${alertOn ? "bg-[var(--error-soft)] text-[var(--error-text)]" : "bg-[var(--success-soft)] text-[var(--success)]"}`} aria-hidden="true">
            {alertOn ? uz.ss.incident.type.restricted_zone : uz.ss.evac.all_accounted}
          </div>
        </div>
      </div>
    </section>
  );
}
