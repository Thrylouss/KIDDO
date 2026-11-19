"use client";

import { useState } from "react";
import uz from "@/i18n";
import Badge from "@/components/ui/Badge";
import { dispatch } from "@/lib/smart-safety/store";
import { CHILDREN, DEMO_ORGS, PICKUP_PERSONS, ZONES } from "@/lib/smart-safety/model";
import {
  BATTERY_LOW, FEATURE_KEYS, globalStats, incidentCounts, isRestricted, kpis, presentChildren, zoneOccupancy,
  type Actor, type DeviceKind, type IncidentType,
} from "@/lib/smart-safety/engine";
import FloorPlan from "./FloorPlan";
import { BatteryBar, Bars, Card, Kpi, btn, childName, fmtLog, fmtTime, incidentLabel, kindLabel, personName, useSafety, zoneName } from "./shared";

// ── Panel (rahbar/tarbiyachi) ─────────────────────────────────────

export function SafetyDashboard({ childIds }: { childIds: string[] }) {
  const { state } = useSafety();
  const k = kpis(state);
  const t = uz.ss.kpi;
  const present = presentChildren(state).filter((c) => childIds.includes(c.id)).length;
  const scoped = state.incidents.filter((i) => i.status !== "resolved" && (!i.childId || childIds.includes(i.childId)));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t.present} value={`${present}/${childIds.length}`} tone="success" />
        <Kpi label={t.open_incidents} value={scoped.length} tone={scoped.length ? "danger" : "default"} />
        <Kpi label={t.critical} value={scoped.filter((i) => i.severity === "critical").length} tone="danger" />
        <Kpi label={t.devices_online} value={`${k.online}/${k.devices}`} />
        <Kpi label={t.gateway} value={state.gatewayOnline ? t.online : t.offline} tone={state.gatewayOnline ? "success" : "warning"}
          hint={state.buffer.length ? `${state.buffer.length} ${t.buffered}` : undefined} />
      </div>
      <Card title={uz.ss.modules.map}><FloorPlan childIds={childIds} compact /></Card>
      <AuditLog limit={8} />
    </div>
  );
}

export function LiveMap({ childIds }: { childIds: string[] }) {
  return <Card title={uz.ss.modules.map}><FloorPlan childIds={childIds} /></Card>;
}

// ── Qurilmalar va biriktirish ─────────────────────────────────────

export function DeviceTable({ kinds, childIds }: { kinds?: DeviceKind[]; childIds?: string[] }) {
  const { state } = useSafety();
  const t = uz.ss.table;
  const rows = Object.values(state.devices).filter((d) => (!kinds || kinds.includes(d.kind)) && (!childIds || (d.childId && childIds.includes(d.childId))));
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm" data-testid="device-table">
        <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-[var(--text-2)]">
          <tr>{[t.device, t.kind, t.child, t.battery, t.status, t.last_seen, t.firmware].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-2)]">
          {rows.map((d) => (
            <tr key={d.id} className="hover:bg-[var(--hover)]">
              <td className="px-3 py-2"><code className="text-xs">{d.id}</code></td>
              <td className="px-3 py-2 text-[var(--label)]">{kindLabel(d.kind)}</td>
              <td className="px-3 py-2 text-[var(--label)]">{d.childId ? childName(d.childId) : "—"}</td>
              <td className="px-3 py-2"><BatteryBar level={d.battery} /></td>
              <td className="px-3 py-2"><Badge variant={d.status === "online" ? "success" : d.status === "removed" ? "error" : "warning"}>{uz.ss.device_status[d.status]}</Badge></td>
              <td className="px-3 py-2 whitespace-nowrap text-[var(--text-2)]">{fmtTime(d.lastSeen, true)}</td>
              <td className="px-3 py-2 text-[var(--text-2)]">{d.firmware}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeviceAssignment({ actor }: { actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.assign;
  const bands = Object.values(state.devices).filter((d) => d.kind === "wristband");
  return (
    <Card title={uz.ss.modules.assignment}>
      <p className="mb-3 text-xs text-[var(--text-2)]">{t.rule}</p>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="assignment-list">
        {bands.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
            <code className="text-xs text-[var(--label)]">{d.id}</code>
            <label className="sr-only" htmlFor={`assign-${d.id}`}>{t.select_child}</label>
            <select id={`assign-${d.id}`} value={d.childId ?? ""} onChange={(e) => dispatch({ type: "assign", deviceId: d.id, childId: e.target.value || null, by: actor })}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--text)]">
              <option value="">{t.unassigned}</option>
              {CHILDREN.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function BatteryMonitor({ childIds }: { childIds: string[] }) {
  const { state } = useSafety();
  const rows = Object.values(state.devices).filter((d) => d.kind === "wristband" && d.childId && childIds.includes(d.childId)).sort((a, b) => a.battery - b.battery);
  const low = rows.filter((d) => d.battery <= BATTERY_LOW);
  return (
    <Card title={uz.ss.modules.battery}>
      {low.length === 0 && <p className="mb-3 text-sm text-[var(--success)]">{uz.ss.battery.all_ok}</p>}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((d) => (
          <li key={d.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${d.battery <= BATTERY_LOW ? "border-[var(--error-border)] bg-[var(--error-soft)]" : "border-[var(--border)]"}`}>
            <span className="truncate text-[var(--text)]">{childName(d.childId)}</span>
            <BatteryBar level={d.battery} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Davomat, geofence ─────────────────────────────────────────────

export function SmartAttendance({ childIds }: { childIds: string[] }) {
  const { state } = useSafety();
  const t = uz.ss.attendance;
  return (
    <Card title={uz.ss.modules.attendance} action={<Badge variant="info">{t.source}</Badge>}>
      <p className="mb-3 text-xs text-[var(--text-2)]">{t.note}</p>
      <ul className="divide-y divide-[var(--border-2)] text-sm" data-testid="smart-attendance">
        {CHILDREN.filter((c) => childIds.includes(c.id)).map((c) => {
          const st = state.children[c.id];
          const status = st.departedAt ? t.departed : st.arrivedAt ? t.arrived : t.not_arrived;
          return (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-[var(--text)]">{c.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-[var(--text-2)]">{fmtTime(st.arrivedAt)}{st.departedAt ? ` → ${fmtTime(st.departedAt)}` : ""}</span>
                <Badge variant={st.departedAt ? "neutral" : st.arrivedAt ? "success" : "warning"}>{status}</Badge>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function GeofenceManager({ actor }: { actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.geofence;
  return (
    <Card title={uz.ss.modules.geofence}>
      <p className="mb-3 text-xs text-[var(--text-2)]">{t.note}</p>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="geofence-list">
        {ZONES.filter((z) => z.kind !== "assembly").map((z) => {
          const restricted = isRestricted(state, z.id);
          return (
            <li key={z.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
              <span className="text-sm text-[var(--text)]">{zoneName(z.id)}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--label)]">
                <input type="checkbox" checked={restricted} onChange={(e) => dispatch({ type: "zone_restricted", zoneId: z.id, restricted: e.target.checked, by: actor })}
                  className="h-4 w-4 accent-[var(--error-text)]" aria-label={`${t.toggle}: ${zoneName(z.id)}`} />
                <Badge variant={restricted ? "error" : "success"}>{restricted ? t.restricted : t.safe}</Badge>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Evakuatsiya va headcount ──────────────────────────────────────

export function Evacuation({ actor, childIds, canControl }: { actor: Actor; childIds: string[]; canControl: boolean }) {
  const { state } = useSafety();
  const t = uz.ss.evac;
  const hc = state.headcount;
  const scoped = hc ? { expected: hc.expected.filter((id) => childIds.includes(id)), accounted: hc.accounted.filter((id) => childIds.includes(id)), missing: hc.missing.filter((id) => childIds.includes(id)) } : null;
  return (
    <div className="grid gap-4">
      <Card title={uz.ss.modules.evacuation}
        action={<Badge variant={state.evacuation.active ? "error" : "neutral"}>{state.evacuation.active ? t.active : t.inactive}</Badge>}>
        <div className="flex flex-wrap gap-2">
          {canControl && (state.evacuation.active
            ? <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "evacuation", active: false, by: actor })}>{t.end}</button>
            : <button type="button" className={btn.danger} onClick={() => dispatch({ type: "evacuation", active: true, by: actor })}>{t.start}</button>)}
          <button type="button" className={btn.primary} onClick={() => dispatch({ type: "headcount", by: actor })}>{t.run_headcount}</button>
        </div>
      </Card>
      {scoped && (
        <Card title={`${uz.ss.modules.headcount} · ${t.last}: ${fmtTime(hc!.at, true)}`}>
          <div className="grid grid-cols-3 gap-3" data-testid="headcount">
            <Kpi label={t.expected} value={scoped.expected.length} />
            <Kpi label={t.accounted} value={scoped.accounted.length} tone="success" />
            <Kpi label={t.missing} value={scoped.missing.length} tone={scoped.missing.length ? "danger" : "success"} />
          </div>
          {scoped.missing.length === 0 ? <p className="mt-3 text-sm text-[var(--success)]">{t.all_accounted}</p> : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {scoped.missing.map((id) => (
                <li key={id} className="rounded-lg bg-[var(--error-soft)] px-2.5 py-1 text-sm text-[var(--error-text)]">{childName(id)} · {zoneName(state.children[id].zoneId)}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Card title={uz.ss.modules.map}><FloorPlan childIds={childIds} compact /></Card>
    </div>
  );
}

// ── Smart pickup ──────────────────────────────────────────────────

export function SmartPickup({ childIds, actor }: { childIds: string[]; actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.pickup;
  const [choice, setChoice] = useState<Record<string, string>>({});
  const last = (childId: string) => [...state.pickups].reverse().find((p) => p.childId === childId);
  return (
    <Card title={uz.ss.modules.pickup}>
      <ul className="divide-y divide-[var(--border-2)]" data-testid="pickup-list">
        {CHILDREN.filter((c) => childIds.includes(c.id)).map((c) => {
          const st = state.children[c.id];
          const rec = last(c.id);
          return (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--text)]">{c.name}</span>
                {st.departedAt ? <Badge variant="success">{t.picked}: {personName(st.pickedUpBy)}</Badge> : !st.arrivedAt ? <Badge variant="neutral">{t.not_present}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-[var(--text-2)]">{t.authorized}: {c.pickup.map((p) => `${personName(p)} (${uz.ss.relation[PICKUP_PERSONS.find((x) => x.id === p)!.relation]})`).join(", ")}</p>
              {st.arrivedAt && !st.departedAt && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="sr-only" htmlFor={`pick-${c.id}`}>{t.select_person}</label>
                  <select id={`pick-${c.id}`} value={choice[c.id] ?? ""} onChange={(e) => setChoice((x) => ({ ...x, [c.id]: e.target.value }))}
                    className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--text)]">
                    <option value="">{t.select_person}</option>
                    {PICKUP_PERSONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" className={btn.primary} disabled={!choice[c.id]}
                    onClick={() => dispatch({ type: "pickup", childId: c.id, personId: choice[c.id], by: actor })}>{t.verify}</button>
                </div>
              )}
              {rec && !rec.ok && !st.departedAt && <p role="alert" className="mt-1 text-xs font-medium text-[var(--error-text)]">{t.denied}: {personName(rec.personId)}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ── Tahlil, audit, integratsiya ───────────────────────────────────

export function Analytics() {
  const { state } = useSafety();
  const t = uz.ss.analytics;
  const counts = incidentCounts(state);
  const occ = zoneOccupancy(state);
  const acked = state.incidents.filter((i) => i.ackAt);
  const avg = acked.length ? Math.round(acked.reduce((s, i) => s + (i.ackAt! - i.openedAt), 0) / acked.length / 1000) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t.by_type}>
        <Bars rows={(Object.keys(counts) as IncidentType[]).map((k) => ({ label: incidentLabel(k), value: counts[k] }))} />
      </Card>
      <Card title={t.by_zone}>
        {Object.keys(occ).length === 0 ? <p className="text-sm text-[var(--text-2)]">{t.no_data}</p> :
          <Bars rows={Object.entries(occ).map(([z, v]) => ({ label: zoneName(z), value: v }))} />}
      </Card>
      <Kpi label={t.response} value={avg === null ? "—" : `${avg} ${t.seconds}`} />
    </div>
  );
}

export function AuditLog({ limit }: { limit?: number }) {
  const { state } = useSafety();
  const t = uz.ss.audit;
  const rows = limit ? state.log.slice(0, limit) : state.log;
  return (
    <Card title={uz.ss.modules.audit}>
      {rows.length === 0 ? <p className="text-sm text-[var(--text-2)]">—</p> : (
        <ol className="space-y-1.5 text-sm" data-testid="audit-log">
          {rows.map((e) => (
            <li key={e.id} className="grid grid-cols-[4.5rem_6rem_1fr] gap-2">
              <span className="tabular-nums text-xs text-[var(--text-3)]">{fmtTime(e.at, true)}</span>
              <span className="truncate text-xs font-medium text-[var(--text-2)]">{t.actors[e.actor]}</span>
              <span className="text-[var(--text)]">{fmtLog(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const PROVIDERS = [
  { key: "demo", label: "KIDDO Demo Provider", active: true },
  { key: "blueiot", label: "BlueIOT", active: false },
  { key: "mokosmart", label: "MOKOSmart", active: false },
  { key: "minew", label: "Minew", active: false },
];

export function Integrations() {
  const t = uz.ss.integrations;
  const transports: [string, boolean][] = [[t.http_push, true], [t.rest_pull, false], [t.websocket, false], [t.mqtt, false]];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t.providers}>
        <ul className="divide-y divide-[var(--border-2)] text-sm" data-testid="providers">
          {PROVIDERS.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-2 py-2">
              <span className="font-medium text-[var(--text)]">{p.label}</span>
              <Badge variant={p.active ? "success" : "neutral"}>{p.active ? t.demo_active : t.awaiting}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-2)]">{t.note}</p>
      </Card>
      <Card title={t.transports}>
        <ul className="space-y-2 text-sm">
          {transports.map(([label, ready]) => (
            <li key={label} className="flex items-center justify-between"><span className="text-[var(--text)]">{label}</span><Badge variant={ready ? "success" : "neutral"}>{ready ? t.ready : t.needs_docs}</Badge></li>
          ))}
        </ul>
        <div className="mt-3 space-y-1.5 text-xs text-[var(--text-2)]">
          <p>{t.pipeline}</p><p>{t.security}</p><p className="font-medium text-[var(--warning-text)]">{t.local_alarm}</p>
        </div>
      </Card>
    </div>
  );
}

// ── Super Admin ───────────────────────────────────────────────────

export function GlobalDashboard() {
  const { state } = useSafety();
  const t = uz.ss.sa;
  const rows = globalStats(state);
  const totals = rows.reduce((a, r) => ({ devices: a.devices + r.devices, online: a.online + r.online, open: a.open + r.openIncidents }), { devices: 0, online: 0, open: 0 });
  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--primary)]">{t.privacy}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={uz.super_admin.jami_bogchalar} value={rows.length} />
        <Kpi label={t.devices} value={totals.devices} />
        <Kpi label={t.online} value={`${totals.online}/${totals.devices}`} tone="success" />
        <Kpi label={t.open} value={totals.open} tone={totals.open ? "danger" : "default"} />
      </div>
      <OrgTable />
    </div>
  );
}

function OrgTable({ allocation = false }: { allocation?: boolean }) {
  const { state } = useSafety();
  const t = uz.ss.sa;
  const rows = globalStats(state);
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm" data-testid="org-table">
        <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-[var(--text-2)]">
          <tr>{[t.org, t.region, t.devices, t.online, allocation ? t.gateways : t.open, allocation ? t.firmware : t.low_battery].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-2)]">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-medium text-[var(--text)]">{r.name}</td>
              <td className="px-3 py-2 text-[var(--label)]">{r.region}</td>
              <td className="px-3 py-2 tabular-nums">{r.devices || <span className="text-[var(--text-3)]">{t.not_allocated}</span>}</td>
              <td className="px-3 py-2"><Badge variant={r.devices === 0 ? "neutral" : r.online === r.devices ? "success" : "warning"}>{r.online}/{r.devices}</Badge></td>
              <td className="px-3 py-2 tabular-nums">{allocation ? r.gateways : r.openIncidents}</td>
              <td className="px-3 py-2 tabular-nums">{allocation ? r.firmware : r.lowBattery}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Allocation() {
  return <OrgTable allocation />;
}

export function Diagnostics() {
  const t = uz.ss.sa;
  const latest = "1.4.2";
  return (
    <Card title={uz.ss.modules.diagnostics}>
      <ul className="divide-y divide-[var(--border-2)] text-sm" data-testid="diagnostics">
        {DEMO_ORGS.filter((o) => o.devices > 0).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-[var(--text)]">{o.name}</span>
            <span className="flex items-center gap-2 text-xs text-[var(--text-2)]">
              {t.firmware}: {o.firmware}
              <Badge variant={o.firmware === latest ? "success" : "warning"}>{o.firmware === latest ? t.up_to_date : t.outdated}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function FeatureManagement({ actor }: { actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.features;
  return (
    <Card title={uz.ss.modules.features}>
      <p className="mb-3 text-xs text-[var(--text-2)]">{t.note}</p>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="feature-flags">
        {FEATURE_KEYS.map((k) => (
          <li key={k} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
            <span className="text-[var(--text)]">{t[k]}</span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--label)]">
              <input type="checkbox" checked={state.features[k]} onChange={(e) => dispatch({ type: "feature", key: k, enabled: e.target.checked, by: actor })}
                className="h-4 w-4 accent-[var(--primary)]" aria-label={t[k]} />
              {state.features[k] ? t.on : t.off}
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
