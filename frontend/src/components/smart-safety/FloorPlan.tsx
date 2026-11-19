"use client";

import { useState } from "react";
import uz from "@/i18n";
import { ANCHORS, CHILDREN, PLAN, ZONES } from "@/lib/smart-safety/model";
import { deviceOf, groupOf, isRestricted, isStale } from "@/lib/smart-safety/engine";
import { BatteryBar, childName, fmtTime, useSafety, zoneName } from "./shared";

/** Jonli xarita: faqat `childIds` (rol doirasi) dagi bolalar ko'rsatiladi. */
export default function FloorPlan({ childIds, compact = false }: { childIds: string[]; compact?: boolean }) {
  const { state } = useSafety();
  const t = uz.ss.map;
  const [selected, setSelected] = useState<string | null>(null);
  const visible = CHILDREN.filter((c) => childIds.includes(c.id) && state.children[c.id].x !== null && !state.children[c.id].departedAt);
  const sel = selected && childIds.includes(selected) ? selected : null;

  return (
    <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-[1fr_17rem]"}`}>
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
        <svg viewBox={`-1 -1 ${PLAN.width + 2} ${PLAN.height + 2}`} className="mx-auto block h-auto max-h-[70vh] w-full" role="img" aria-label={t.plan_label} data-testid="floor-plan">
          <defs>
            <pattern id="ss-stripes" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="1" height="2" fill="var(--error-border)" />
            </pattern>
          </defs>
          {ZONES.map((z) => {
            const restricted = isRestricted(state, z.id);
            const fill = restricted ? "url(#ss-stripes)" : z.kind === "assembly" ? "var(--success-bg)" : z.kind === "playground" ? "var(--primary-lt)" : z.kind === "corridor" ? "var(--border-2)" : "var(--card)";
            const stroke = restricted ? "var(--error-text)" : z.kind === "exit" || z.kind === "entrance" ? "var(--primary)" : "var(--border-strong)";
            return (
              <g key={z.id}>
                <rect x={z.rect[0]} y={z.rect[1]} width={z.rect[2]} height={z.rect[3]} rx={0.8} fill={fill} stroke={stroke} strokeWidth={restricted ? 0.4 : 0.25} />
                <text x={z.rect[0] + 0.9} y={z.rect[1] + 2.1} fontSize={z.rect[2] < 10 ? 0.95 : 1.3} fill={restricted ? "var(--error-text)" : "var(--text-2)"} fontWeight={600}>
                  {zoneName(z.id)}
                </text>
                {restricted && (
                  <text x={z.rect[0] + 0.9} y={z.rect[1] + 3.8} fontSize={1.05} fill="var(--error-text)" fontWeight={700}>⚠ {uz.ss.zone_kind.restricted}</text>
                )}
              </g>
            );
          })}
          {ANCHORS.map((a) => (
            <path key={a.id} d={`M${a.x} ${a.y - 0.9} L${a.x + 0.8} ${a.y + 0.6} L${a.x - 0.8} ${a.y + 0.6} Z`} fill="var(--text-3)">
              <title>{`${uz.ss.device_kind.anchor} ${a.id}`}</title>
            </path>
          ))}
          {visible.map((c) => {
            const st = state.children[c.id];
            const stale = isStale(state, c.id);
            const alert = state.incidents.some((i) => i.childId === c.id && i.status === "open" && i.severity !== "warning");
            const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
            return (
              <g key={c.id} role="button" tabIndex={0} aria-label={`${c.name} — ${zoneName(st.zoneId)}${stale ? ` (${t.legend_stale})` : ""}`}
                data-testid={`marker-${c.id}`} data-stale={stale ? "1" : "0"}
                onClick={() => setSelected(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.id); } }}
                className="cursor-pointer focus:outline-none" style={{ transform: `translate(${st.x}px, ${st.y}px)`, transition: "transform 0.9s ease-in-out" }}>
                {alert && <circle r={2.9} fill="none" stroke="var(--error-text)" strokeWidth={0.5} className="animate-ping" style={{ transformOrigin: "center", transformBox: "fill-box" }} />}
                <circle r={1.7} fill={stale ? "var(--card)" : alert ? "var(--error-text)" : "var(--primary)"} stroke={stale ? "var(--text-3)" : sel === c.id ? "var(--text)" : "var(--card)"}
                  strokeWidth={stale ? 0.35 : 0.45} strokeDasharray={stale ? "0.8 0.6" : undefined} />
                <text textAnchor="middle" dy={0.5} fontSize={1.35} fontWeight={700} fill={stale ? "var(--text-3)" : "white"}>{initials}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[11px] text-[var(--text-2)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />{t.legend_current}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-[var(--text-3)]" />{t.legend_stale}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-[var(--error-border)]" />{t.legend_restricted}</span>
          <span className="inline-flex items-center gap-1.5"><span className="text-[var(--text-3)]">▲</span>{t.legend_anchor}</span>
        </div>
      </div>
      {!compact && <ChildProfile childId={sel} />}
    </div>
  );
}

export function ChildProfile({ childId }: { childId: string | null }) {
  const { state } = useSafety();
  const t = uz.ss.map;
  if (!childId) {
    return <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-2)]">{t.select_hint}</div>;
  }
  const st = state.children[childId];
  const dev = deviceOf(childId);
  const d = dev ? state.devices[dev] : null;
  const stale = isStale(state, childId);
  const rows: [string, React.ReactNode][] = [
    [t.group, groupOf(childId)?.name ?? "—"],
    [t.device, <code key="d" className="text-xs">{dev ?? "—"}</code>],
    [t.battery, d ? <BatteryBar key="b" level={d.battery} /> : "—"],
    [t.location, st.x === null ? t.no_location : zoneName(st.zoneId)],
    [t.updated, fmtTime(st.updatedAt, true)],
  ];
  return (
    <aside className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" data-testid="child-profile" aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{t.profile}</p>
      <p className="mt-1 text-base font-semibold text-[var(--text)]">{childName(childId)}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3"><dt className="text-[var(--text-2)]">{k}</dt><dd className="text-right text-[var(--text)]">{v}</dd></div>
        ))}
      </dl>
      {stale && <p role="status" className="mt-3 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-text)]">{t.stale_note}</p>}
    </aside>
  );
}
