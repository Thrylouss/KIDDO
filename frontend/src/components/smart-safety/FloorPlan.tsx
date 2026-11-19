"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import uz from "@/i18n";
import { CHILDREN, GROUPS, PLAN, ZONES, type Zone } from "@/lib/smart-safety/model";
import { deviceOf, groupOf, isRestricted, isStale, type SafetyState } from "@/lib/smart-safety/engine";
import Icon, { Avatar } from "./Icons";
import { fmtTime, useSafety, zoneName } from "./shared";

const R = 1.9;          // marker radiusi (m)
const GAP = R * 2 + 0.5;

/** Bir joyda turgan markerlar ustma-ust tushmasligi uchun yumshoq itarish (zona chegarasida qoladi). */
export function spreadMarkers(points: { id: string; x: number; y: number; zone: Zone | null }[]): Record<string, [number, number]> {
  const pos = points.map((p) => ({ ...p }));
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i], b = pos[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= GAP) continue;
        if (d < 0.01) { dx = ((i + j) % 2 ? 1 : -1) * 0.3; dy = 0.2; d = Math.hypot(dx, dy); }
        const push = (GAP - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
        moved = true;
      }
    }
    pos.forEach((p) => {
      // Kichik zonada (kirish, chiqish) hamma sig'maydi — markerlar zona atrofiga biroz chiqishi mumkin
      const r0 = p.zone?.rect ?? [0, 0, PLAN.width, PLAN.height];
      const pad = r0[2] * r0[3] < 300 ? 3.5 : 0;
      const r = [r0[0] - pad, r0[1] - pad, r0[2] + pad * 2, r0[3] + pad * 2];
      p.x = Math.min(Math.min(PLAN.width - R, r[0] + r[2] - R - 0.3), Math.max(Math.max(R, r[0] + R + 0.3), p.x));
      p.y = Math.min(Math.min(PLAN.height - R, r[1] + r[3] - R - 0.3), Math.max(Math.max(R, r[1] + R + 0.3), p.y));
    });
    if (!moved) break;
  }
  return Object.fromEntries(pos.map((p) => [p.id, [p.x, p.y]]));
}

/** Matnni zona kengligiga sig'adigan qatorlarga bo'ladi (nomlar hech qachon kesilmaydi). */
export function wrapLabel(text: string, width: number, fontSize: number): string[] {
  const max = Math.max(4, Math.floor((width - 1.5) / (fontSize * 0.56)));
  const lines: string[] = [];
  text.split(" ").forEach((w) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + w).length <= max) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  });
  return lines;
}

/** Zona ichidagi eshik joylari: [x, y, gorizontal?] — koridorga ochiladi. */
const DOORS: [number, number, boolean][] = [
  [15, 24.5, true], [45, 24.5, true], [69, 24.5, true], [90, 24.5, true], [79, 33.5, true], [21, 33.5, true],
];

const OUTDOOR = new Set(["z-playground", "z-assembly"]);

export interface FloorPlanProps {
  childIds: string[];
  /** Xaritada belgilanadigan bola (masalan, «Xaritada ko'rish» havolasidan). */
  focusId?: string | null;
  /** Kompakt rejim — qidiruv/filtr/profil paneli yo'q (bosh sahifa yoki sanash uchun). */
  compact?: boolean;
  showTechnical?: boolean;
}

export default function FloorPlan({ childIds, focusId = null, compact = false, showTechnical = false }: FloorPlanProps) {
  const { state } = useSafety();
  const t = uz.ssx.map;
  const [selected, setSelected] = useState<string | null>(focusId);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [zoom, setZoom] = useState(focusId ? 1.6 : 1);
  const [full, setFull] = useState(false);

  useEffect(() => { if (focusId) { setSelected(focusId); setZoom(1.6); } }, [focusId]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const scopeGroups = GROUPS.filter((g) => CHILDREN.some((c) => c.groupId === g.id && childIds.includes(c.id)));
  const inScope = CHILDREN.filter((c) => childIds.includes(c.id) && (!group || c.groupId === group));
  const visible = inScope.filter((c) => state.children[c.id].x !== null && !state.children[c.id].departedAt);
  const matches = query.trim() ? inScope.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const sel = selected && childIds.includes(selected) ? selected : null;

  // Arzon hisob (≤10 marker) — har renderda qayta hisoblanadi
  const positions = spreadMarkers(visible.map((c) => {
    const st = state.children[c.id];
    return { id: c.id, x: st.x!, y: st.y!, zone: ZONES.find((z) => z.id === st.zoneId) ?? null };
  }));

  const dangerZones = new Set(state.incidents.filter((i) => i.type === "restricted_zone" && i.status !== "resolved" && i.zoneId && (!i.childId || childIds.includes(i.childId))).map((i) => i.zoneId!));
  const alertKids = new Set(state.incidents.filter((i) => i.status !== "resolved" && i.severity === "critical" && i.childId).map((i) => i.childId!));

  // Kattalashtirish: tanlangan bola atrofida (bo'lmasa — markaz)
  const center = sel && positions[sel] ? positions[sel] : [PLAN.width / 2, PLAN.height / 2];
  const w = (PLAN.width + 4) / zoom, h = (PLAN.height + 4) / zoom;
  const vx = Math.min(PLAN.width + 2 - w, Math.max(-2, center[0] - w / 2));
  const vy = Math.min(PLAN.height + 2 - h, Math.max(-2, center[1] - h / 2));

  const toolBtn = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--label)] hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:opacity-40";

  const plan = (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] ${full ? "flex-1" : ""}`}>
      <svg viewBox={`${vx} ${vy} ${w} ${h}`} className={`mx-auto block w-full ${full ? "h-full" : "h-auto max-h-[68vh]"}`} role="img" aria-label={uz.ss.map.plan_label} data-testid="floor-plan" data-zoom={zoom}>
        <defs>
          <pattern id="ss-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="1.6" height="1.6" fill="var(--error-soft)" /><rect width="0.5" height="1.6" fill="var(--error-border)" />
          </pattern>
          <pattern id="ss-grass" width="3" height="3" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill="var(--success-soft)" /><circle cx="1.5" cy="1.5" r="0.18" fill="var(--success-border)" />
          </pattern>
        </defs>
        {/* Hovli */}
        <rect x={-2} y={-2} width={PLAN.width + 4} height={PLAN.height + 4} fill="var(--surface-2)" />
        {/* Bino tashqi devori (xonalar + koridor) va zal */}
        <rect x={0} y={0} width={100} height={33} fill="var(--card)" stroke="var(--text-2)" strokeWidth={0.7} rx={0.4} />
        <rect x={58} y={34} width={42} height={26} fill="var(--card)" stroke="var(--text-2)" strokeWidth={0.7} rx={0.4} />
        {ZONES.map((z) => <ZoneShape key={z.id} z={z} state={state} danger={dangerZones.has(z.id)} />)}
        {DOORS.map(([x, y, horiz], i) => (
          <g key={i} aria-hidden="true">
            <rect x={horiz ? x - 1.6 : x - 0.5} y={horiz ? y - 0.5 : y - 1.6} width={horiz ? 3.2 : 1} height={horiz ? 1 : 3.2} fill="var(--card)" />
            <path d={`M${x - 1.6} ${y} A3.2 3.2 0 0 1 ${x + 1.6} ${y - 0.1}`} fill="none" stroke="var(--text-3)" strokeWidth={0.15} />
          </g>
        ))}
        {/* Asosiy kirish (pastda) */}
        <g aria-hidden="true">
          <path d="M47 60 L53 60" stroke="var(--primary)" strokeWidth={0.9} />
          <path d="M50 58.6 L50 55.8 M48.8 57 L50 55.8 L51.2 57" stroke="var(--primary)" strokeWidth={0.35} fill="none" />
        </g>
        {visible.map((c) => {
          const st = state.children[c.id];
          const [x, y] = positions[c.id] ?? [st.x!, st.y!];
          const stale = isStale(state, c.id);
          const alert = alertKids.has(c.id);
          const isSel = sel === c.id;
          const second = c.groupId !== GROUPS[0].id;
          const initials = c.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
          return (
            <g key={c.id} role="button" tabIndex={0} aria-pressed={isSel}
              aria-label={`${c.name} — ${zoneName(st.zoneId)}${stale ? ` (${t.unconfirmed})` : ""}`}
              data-testid={`marker-${c.id}`} data-stale={stale ? "1" : "0"} data-alert={alert ? "1" : "0"}
              onClick={() => setSelected(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.id); } }}
              className="cursor-pointer focus:outline-none" style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 0.8s ease-in-out" }}>
              {(alert || isSel) && <circle r={R + 1.1} fill="none" stroke={alert ? "var(--error-text)" : "var(--text)"} strokeWidth={0.35} />}
              <circle r={R} fill={stale ? "var(--card)" : alert ? "var(--error-text)" : second ? "var(--secondary)" : "var(--primary)"}
                stroke={stale ? "var(--text-3)" : "var(--card)"} strokeWidth={stale ? 0.3 : 0.4} strokeDasharray={stale ? "0.7 0.5" : undefined} />
              <text textAnchor="middle" dy={0.55} fontSize={1.45} fontWeight={700} fill={stale ? "var(--text-3)" : "white"} style={{ pointerEvents: "none" }}>{initials}</text>
              {stale && <text textAnchor="middle" y={-R - 0.5} fontSize={1.6} fontWeight={700} fill="var(--warning-text)">?</text>}
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text-2)]" aria-label={uz.ss.map.plan_label}>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--primary)]" />{t.live}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-[var(--text-3)]" />{t.unconfirmed}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-[var(--error-text)] bg-[var(--error-soft)]" />{t.danger}</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-[var(--success-border)] bg-[var(--success-soft)]" />{t.safe}</li>
      </ul>
    </div>
  );

  if (compact) return plan;

  const body = (
    <div className={full ? "fixed inset-0 z-50 flex flex-col gap-3 bg-[var(--bg)] p-3 sm:p-5" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"}
      role={full ? "dialog" : undefined} aria-modal={full || undefined} aria-label={full ? uz.ssx.sections.map : undefined}>
      <div className={`flex min-w-0 flex-col gap-3 ${full ? "flex-1" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"><Icon name="search" className="h-4 w-4" /></span>
            <label htmlFor="ss-map-search" className="sr-only">{t.search}</label>
            <input id="ss-map-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} autoComplete="off"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            {query.trim() && (
              <ul className="absolute left-0 right-0 top-11 z-10 max-h-60 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg" role="listbox" aria-label={t.search}>
                {matches.length === 0 ? <li className="px-3 py-2 text-sm text-[var(--text-2)]">{t.not_found}</li> : matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" role="option" aria-selected={sel === c.id} onClick={() => { setSelected(c.id); setQuery(""); setZoom(1.6); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]">
                      <Avatar name={c.name} size="sm" /> {c.name}<span className="ml-auto text-xs text-[var(--text-2)]">{zoneName(state.children[c.id].zoneId)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {scopeGroups.length > 1 && (
            <>
              <label htmlFor="ss-map-group" className="sr-only">{t.all_groups}</label>
              <select id="ss-map-group" value={group} onChange={(e) => setGroup(e.target.value)}
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]">
                <option value="">{t.all_groups}</option>
                {scopeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </>
          )}
          <div className="flex items-center gap-1">
            <button type="button" className={toolBtn} onClick={() => setZoom((z) => Math.min(3, +(z + 0.4).toFixed(1)))} disabled={zoom >= 3} aria-label={t.zoom_in} title={t.zoom_in}><Icon name="plus" className="h-4 w-4" /></button>
            <button type="button" className={toolBtn} onClick={() => setZoom((z) => Math.max(1, +(z - 0.4).toFixed(1)))} disabled={zoom <= 1} aria-label={t.zoom_out} title={t.zoom_out}><Icon name="minus" className="h-4 w-4" /></button>
            <button type="button" className={toolBtn} onClick={() => setZoom(1)} disabled={zoom === 1} aria-label={t.zoom_reset} title={t.zoom_reset}><Icon name="reset" className="h-4 w-4" /></button>
            <button type="button" className={toolBtn} onClick={() => setFull((f) => !f)} aria-label={full ? t.exit_fullscreen : t.fullscreen} title={full ? t.exit_fullscreen : t.fullscreen}>
              <Icon name={full ? "shrink" : "expand"} className="h-4 w-4" />
            </button>
          </div>
        </div>
        {plan}
      </div>
      <ChildProfile childId={sel} onClose={() => setSelected(null)} showTechnical={showTechnical} floating={full} />
    </div>
  );
  return body;
}

function ZoneShape({ z, state, danger }: { z: Zone; state: SafetyState; danger: boolean }) {
  const restricted = isRestricted(state, z.id);
  const [x, y, w, h] = z.rect;
  const outdoor = OUTDOOR.has(z.id);
  const fill = restricted ? "url(#ss-hatch)" : z.kind === "assembly" ? "var(--success-bg)" : outdoor ? "url(#ss-grass)" : z.kind === "corridor" ? "var(--surface-2)" : "var(--card)";
  const stroke = danger ? "var(--error-text)" : restricted ? "var(--error-text)" : z.kind === "assembly" ? "var(--success)" : z.kind === "exit" || z.kind === "entrance" ? "var(--primary)" : outdoor ? "var(--success-border)" : "var(--text-3)";
  const fs = w < 14 ? 1.15 : 1.7;
  const lines = wrapLabel(zoneName(z.id), w, fs);
  const label = restricted ? "var(--error-text)" : z.kind === "assembly" ? "var(--success)" : "var(--text)";
  return (
    <g data-testid={`zone-${z.id}`} data-danger={danger ? "1" : "0"}>
      <rect x={x + 0.2} y={y + 0.2} width={w - 0.4} height={h - 0.4} rx={0.6} fill={fill} stroke={stroke}
        strokeWidth={danger ? 0.8 : restricted ? 0.45 : z.kind === "corridor" ? 0 : 0.3} strokeDasharray={restricted && !danger ? "1 0.6" : undefined} />
      {z.kind === "playground" && (
        <g aria-hidden="true" opacity={0.55}>
          <circle cx={x + w - 8} cy={y + h - 7} r={3.2} fill="var(--warning-soft)" stroke="var(--warning-border)" strokeWidth={0.25} />
          <rect x={x + w - 18} y={y + 6} width={2} height={9} rx={1} fill="var(--primary-lt)" stroke="var(--primary-md)" strokeWidth={0.25} />
        </g>
      )}
      <text x={x + w / 2} y={y + (z.kind === "corridor" ? h / 2 + 0.5 : 2.6)} textAnchor="middle" fontSize={fs} fontWeight={600} fill={label}>
        {lines.map((l, i) => <tspan key={i} x={x + w / 2} dy={i === 0 ? 0 : fs * 1.15}>{l}</tspan>)}
      </text>
      {restricted && (
        <text x={x + w / 2} y={y + 2.6 + lines.length * fs * 1.15 + 0.4} textAnchor="middle" fontSize={1.15} fontWeight={700} fill="var(--error-text)">
          {danger ? `⚠ ${uz.ssx.map.danger}` : `🔒 ${uz.ss.zone_kind.restricted}`}
        </text>
      )}
    </g>
  );
}

export function ChildProfile({ childId, onClose, showTechnical = false, floating = false }: { childId: string | null; onClose?: () => void; showTechnical?: boolean; floating?: boolean }) {
  const { state } = useSafety();
  const t = uz.ssx.map;
  if (!childId) {
    if (floating) return null;
    return <div className="flex items-center gap-2 self-start rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-2)]"><Icon name="info" className="h-4 w-4 flex-shrink-0" />{uz.ss.map.select_hint}</div>;
  }
  const child = CHILDREN.find((c) => c.id === childId)!;
  const st = state.children[childId];
  const dev = deviceOf(childId);
  const d = dev ? state.devices[dev] : null;
  const stale = isStale(state, childId);
  const inDanger = !!st.zoneId && isRestricted(state, st.zoneId) && !st.departedAt;
  return (
    <aside className={`self-start rounded-2xl border bg-[var(--card)] p-4 ${inDanger ? "border-[var(--error-text)]" : "border-[var(--border)]"} ${floating ? "absolute bottom-6 right-6 z-10 w-72 shadow-xl" : ""}`}
      data-testid="child-profile" aria-live="polite" aria-label={uz.ss.map.profile}>
      <div className="flex items-start gap-3">
        <Avatar name={child.name} size="lg" tone={child.groupId === GROUPS[0].id ? "primary" : "accent"} alert={inDanger} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight text-[var(--text)]">{child.name}</p>
          <p className="text-sm text-[var(--text-2)]">{groupOf(childId)?.name}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label={t.close_profile} className="rounded-lg p-1 text-[var(--text-3)] hover:bg-[var(--hover)]"><Icon name="close" className="h-4 w-4" /></button>}
      </div>
      <div className={`mt-4 rounded-xl px-3 py-2.5 ${inDanger ? "bg-[var(--error-soft)]" : stale ? "bg-[var(--warning-soft)]" : "bg-[var(--surface-2)]"}`}>
        <p className={`text-xs font-medium ${inDanger ? "text-[var(--error-text)]" : stale ? "text-[var(--warning-text)]" : "text-[var(--text-2)]"}`}>
          {inDanger ? t.in_danger : stale ? t.last_known : t.live}
        </p>
        <p className="mt-0.5 text-base font-semibold text-[var(--text)]">{st.x === null ? uz.ss.map.no_location : st.departedAt ? uz.ssx.att.departed : zoneName(st.zoneId)}</p>
        <p className="text-xs text-[var(--text-2)]">{fmtTime(st.updatedAt)}{stale && st.x !== null ? ` · ${t.unconfirmed}` : ""}</p>
      </div>
      {d && (
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--label)]">
          <Icon name="battery" className="h-4 w-4" />{uz.ss.map.battery}: <span className={d.battery <= 15 ? "font-semibold text-[var(--warning-text)]" : ""}>{d.battery}%</span>
        </p>
      )}
      {showTechnical && dev && <p className="mt-1 text-xs text-[var(--text-3)]">{uz.ss.map.device}: <code>{dev}</code></p>}
    </aside>
  );
}

/** «Xaritada ko'rish» havolasi (bola belgilanadi). */
export function MapLink({ href, className }: { href: string; className: string }) {
  return <Link href={href} className={className}><Icon name="map" className="h-4 w-4" />{uz.ssx.alert.show_map}</Link>;
}
