"use client";

import { useState } from "react";
import uz from "@/i18n";
import Badge from "@/components/ui/Badge";
import { dispatch } from "@/lib/smart-safety/store";
import { BUS_STOPS, CAMERAS, CHILDREN, GROUPS, STAFF, zoneAt, zoneCenter } from "@/lib/smart-safety/model";
import { presentChildren, type Actor } from "@/lib/smart-safety/engine";
import { Bars, Card, btn, childName, fmtTime, incidentLabel, useSafety, zoneName } from "./shared";

/** V2 modul sarlavhasi: holat va kerakli uskuna aniq ko'rsatiladi. */
function V2Card({ title, dep, desc, children }: { title: string; dep: string; desc: string; children: React.ReactNode }) {
  const t = uz.ss.v2;
  return (
    <Card title={<span className="flex flex-wrap items-center gap-2">{title}<Badge variant="info">{t.badge}</Badge></span>}>
      <p className="text-sm text-[var(--text-2)]">{desc}</p>
      <p className="mt-1 mb-3 text-xs text-[var(--warning-text)]">{t.dependency}: <strong>{dep}</strong></p>
      {children}
    </Card>
  );
}

export function SmartActivity({ childIds }: { childIds: string[] }) {
  const { state } = useSafety();
  const t = uz.ss.v2;
  const rows = CHILDREN.filter((c) => childIds.includes(c.id)).map((c) => ({ label: c.name, value: Math.round(state.distance[c.id] ?? 0) }));
  return <V2Card title={uz.ss.modules.activity} dep={t.activity_dep} desc={t.activity_desc}><Bars rows={rows} /><p className="mt-2 text-xs text-[var(--text-3)]">{t.meters}</p></V2Card>;
}

export function SmartSleep({ childIds, actor }: { childIds: string[]; actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.v2;
  const minute = Math.floor(state.now / 60_000);
  const kids = presentChildren(state).filter((c) => childIds.includes(c.id));
  return (
    <V2Card title={uz.ss.modules.sleep} dep={t.sleep_dep} desc={t.sleep_desc}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {state.nap.active
          ? <><Badge variant="info">{t.sleep_active} · {fmtTime(state.nap.startedAt)}</Badge><button type="button" className={btn.secondary} onClick={() => dispatch({ type: "nap", active: false, by: actor })}>{t.sleep_end}</button></>
          : <button type="button" className={btn.primary} onClick={() => dispatch({ type: "nap", active: true, by: actor })}>{t.sleep_start}</button>}
      </div>
      {state.nap.active && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {kids.map((c, i) => {
            const restless = (minute + i) % 5 === 0;   // deterministik simulyatsiya
            return <li key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"><span>{c.name}</span><Badge variant={restless ? "warning" : "success"}>{restless ? t.restless : t.still}</Badge></li>;
          })}
        </ul>
      )}
    </V2Card>
  );
}

export function SmartMeal({ childIds, actor }: { childIds: string[]; actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.v2;
  const kids = presentChildren(state).filter((c) => childIds.includes(c.id));
  return (
    <V2Card title={uz.ss.modules.meal} dep={t.meal_dep} desc={t.meal_desc}>
      {kids.length === 0 ? <p className="text-sm text-[var(--text-2)]">{uz.ss.analytics.no_data}</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {kids.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
              <span>{c.name}</span>
              {state.meals[c.id]
                ? <Badge variant="success">{t.meal_served} · {fmtTime(state.meals[c.id])}</Badge>
                : <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "meal", childId: c.id, by: actor })}>{t.meal_tap}</button>}
            </li>
          ))}
        </ul>
      )}
    </V2Card>
  );
}

export function SmartCctv() {
  const { state } = useSafety();
  const t = uz.ss.v2;
  return (
    <V2Card title={uz.ss.modules.cctv} dep={t.cctv_dep} desc={t.cctv_desc}>
      <p className="mb-3 text-xs text-[var(--text-3)]">{t.cctv_no_video}</p>
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="cctv">
        {CAMERAS.map((cam) => {
          const ev = state.incidents.find((i) => i.zoneId === cam.zone && i.status !== "resolved");
          return (
            <li key={cam.id} className={`relative aspect-video overflow-hidden rounded-xl border ${ev ? "border-[var(--error-text)]" : "border-[var(--border)]"} bg-[var(--ink)]`}>
              <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true">
                <rect x="10" y="50" width="140" height="30" fill="var(--text-3)" /><circle cx="40" cy="40" r="10" fill="var(--text-3)" /><rect x="90" y="20" width="40" height="30" fill="var(--text-3)" />
              </svg>
              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{cam.id} · {zoneName(cam.zone)}</span>
              {ev && <span className="absolute bottom-2 left-2 rounded bg-[var(--error-text)] px-1.5 py-0.5 text-[11px] font-semibold text-white">{t.cctv_event}: {incidentLabel(ev.type)} · {fmtTime(ev.openedAt, true)}</span>}
            </li>
          );
        })}
      </ul>
    </V2Card>
  );
}

export function SmartBus({ actor }: { actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.v2;
  return (
    <V2Card title={uz.ss.modules.bus} dep={t.bus_dep} desc={t.bus_desc}>
      <ol className="mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="bus-route">
        {BUS_STOPS.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${i === state.busStop ? "bg-[var(--primary)] text-white" : i < state.busStop ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-[var(--border-2)] text-[var(--text-2)]"}`}>{i === state.busStop ? "🚌 " : ""}{s}</li>
        ))}
      </ol>
      <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "bus", by: actor })}>{t.bus_next}</button>
    </V2Card>
  );
}

export function SmartHealth({ childIds }: { childIds: string[] }) {
  const { state } = useSafety();
  const t = uz.ss.v2;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const kids = presentChildren(state).filter((c) => childIds.includes(c.id));
  return (
    <V2Card title={uz.ss.modules.health} dep={t.health_dep} desc={t.health_desc}>
      <p className="mb-3 rounded-lg bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--primary)]">{t.health_note}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {kids.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
            <span>{c.name}</span>
            {checked[c.id] ? <Badge variant="success">{t.health_ok}</Badge>
              : <button type="button" className={btn.secondary} onClick={() => setChecked((x) => ({ ...x, [c.id]: true }))}>{t.health_check}</button>}
          </li>
        ))}
      </ul>
    </V2Card>
  );
}

export function StaffTracking() {
  const { state } = useSafety();
  const t = uz.ss.v2;
  const pos = (staffId: string) => {
    const g = GROUPS.find((x) => x.teacherId === staffId);
    if (g) {
      const kids = presentChildren(state).filter((c) => c.groupId === g.id && state.children[c.id].x !== null);
      if (kids.length) {
        const x = kids.reduce((a, c) => a + state.children[c.id].x!, 0) / kids.length;
        const y = kids.reduce((a, c) => a + state.children[c.id].y!, 0) / kids.length;
        return zoneAt(x, y)?.id ?? null;
      }
    }
    const s = STAFF.find((x) => x.id === staffId);
    return s?.role === "nurse" ? zoneAt(...zoneCenter("z-hall"))?.id ?? null : "z-entrance";
  };
  return (
    <V2Card title={uz.ss.modules.staff} dep={t.staff_dep} desc={t.staff_desc}>
      <ul className="divide-y divide-[var(--border-2)] text-sm" data-testid="staff-list">
        {STAFF.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2">
            <span>{s.name} <span className="text-xs text-[var(--text-3)]">· {s.badgeId}</span></span>
            <span className="text-[var(--label)]">{zoneName(pos(s.id))}</span>
          </li>
        ))}
      </ul>
    </V2Card>
  );
}

export { childName };
