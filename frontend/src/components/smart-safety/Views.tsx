"use client";

import { useState } from "react";
import Link from "next/link";
import uz from "@/i18n";
import Badge from "@/components/ui/Badge";
import { dispatch } from "@/lib/smart-safety/store";
import { CHILDREN, GROUPS, PICKUP_PERSONS } from "@/lib/smart-safety/model";
import {
  BATTERY_LOW, globalStats, groupOf, isStale, kpis, presentChildren,
  type Actor, type DeviceState, type SafetyState,
} from "@/lib/smart-safety/engine";
import type { Role } from "@/lib/smart-safety/model";
import AlertCenter from "./AlertCenter";
import FloorPlan from "./FloorPlan";
import Icon, { Avatar, type AnyIcon } from "./Icons";
import { Analytics, AuditLog, DeviceAssignment, Diagnostics, FeatureManagement, GeofenceManager, Integrations } from "./modules";
import { SmartActivity, SmartBus, SmartCctv, SmartHealth, SmartMeal, SmartSleep, StaffTracking } from "./V2Modules";
import { btn, childName, fmtTime, kindLabel, personName, useSafety, zoneName } from "./shared";

export interface ViewCtx {
  role: Exclude<Role, "parent">;
  actor: Actor;
  childIds: string[];
  /** Bo'lim havolasi: `href("xarita", "?bola=...")`. */
  href: (slug: string, query?: string) => string;
}

const tpl = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const firstName = (id: string | null) => childName(id).split(" ")[0];
const toneOf = (id: string) => (CHILDREN.find((c) => c.id === id)?.groupId === GROUPS[0].id ? "primary" : "accent") as "primary" | "accent";

// ── Umumiy yordamchilar ───────────────────────────────────────────

type BandStatus = "s_ok" | "s_charge" | "s_offline" | "s_unassigned" | "s_removed";
export function bandStatus(d: DeviceState): BandStatus {
  if (d.status === "removed") return "s_removed";
  if (d.status === "offline") return "s_offline";
  if (!d.childId) return "s_unassigned";
  if (d.battery <= BATTERY_LOW) return "s_charge";
  return "s_ok";
}
const BAND_VARIANT: Record<BandStatus, "success" | "warning" | "error" | "neutral"> = { s_ok: "success", s_charge: "warning", s_offline: "warning", s_unassigned: "neutral", s_removed: "error" };

/** E'tibor talab qiladigan bilaguzuklar (rol doirasida). */
export function bandsNeedingAttention(state: SafetyState, childIds: string[], includeUnassigned: boolean) {
  return Object.values(state.devices).filter((d) => d.kind === "wristband"
    && (d.childId ? childIds.includes(d.childId) : includeUnassigned)
    && bandStatus(d) !== "s_ok");
}

function bandMessage(d: DeviceState): string {
  const t = uz.ssx.dev;
  const s = bandStatus(d);
  const child = firstName(d.childId);
  if (s === "s_charge") return tpl(t.charge_msg, { child });
  if (s === "s_offline") return tpl(t.offline_msg, { child });
  if (s === "s_removed") return tpl(t.removed_msg, { child });
  return `${t.band} · ${t.s_unassigned}`;
}

export function overallStatus(state: SafetyState, childIds: string[], attention: number) {
  const open = state.incidents.filter((i) => i.status !== "resolved" && (!i.childId || childIds.includes(i.childId)));
  const urgent = open.filter((i) => i.severity !== "warning").length;
  if (urgent) return { kind: "alert" as const, n: urgent };
  const n = attention + open.filter((i) => i.severity === "warning").length;
  if (n || !state.gatewayOnline) return { kind: "warn" as const, n: Math.max(n, 1) };
  return { kind: "ok" as const, n: 0 };
}

export function StatusBanner({ status, href }: { status: ReturnType<typeof overallStatus>; href: string }) {
  const t = uz.ssx.ov;
  // Kritik/yuqori xabar bo'lsa yuqoridagi ogohlantirish banneri holatni ko'rsatadi — ikkinchi banner takrorlanmaydi
  if (status.kind === "alert") return null;
  const cfg = {
    ok: { icon: "shield" as AnyIcon, title: t.ok, desc: t.ok_desc, cls: "border-[var(--success-border)] bg-[var(--success-soft)]", ic: "bg-[var(--success)] text-white" },
    warn: { icon: "alert" as AnyIcon, title: t.warn, desc: tpl(t.warn_desc, { n: status.n }), cls: "border-[var(--warning-border)] bg-[var(--warning-soft)]", ic: "bg-[var(--warning-text)] text-white" },
    alert: { icon: "bell" as AnyIcon, title: t.alert, desc: tpl(t.alert_desc, { n: status.n }), cls: "border-[var(--error-border)] bg-[var(--error-soft)]", ic: "bg-[var(--error-text)] text-white" },
  }[status.kind];
  const body = (
    <>
      <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${cfg.ic}`}><Icon name={cfg.icon} className="h-6 w-6" /></span>
      <span className="min-w-0">
        <span className="block text-xl font-bold text-[var(--text)]">{cfg.title}</span>
        <span className="block text-sm text-[var(--label)]">{cfg.desc}</span>
      </span>
      {status.kind !== "ok" && <span className="ml-auto text-[var(--text-2)]"><Icon name="chevron" /></span>}
    </>
  );
  const cls = `flex items-center gap-4 rounded-2xl border px-5 py-4 ${cfg.cls}`;
  return status.kind === "ok"
    ? <div className={cls} data-testid="status-banner" data-status="ok">{body}</div>
    : <Link href={href} className={`${cls} hover:opacity-95`} data-testid="status-banner" data-status={status.kind}>{body}</Link>;
}

function Counter({ label, value, icon, tone = "default", testId }: { label: string; value: React.ReactNode; icon: AnyIcon; tone?: "default" | "success" | "warning"; testId?: string }) {
  const color = { default: "text-[var(--text)]", success: "text-[var(--success)]", warning: "text-[var(--warning-text)]" }[tone];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-sm text-[var(--text-2)]"><Icon name={icon} className="h-4 w-4" />{label}</div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function QuickCard({ href, icon, title, subtitle, badge }: { href: string; icon: AnyIcon; title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-h-[7.5rem] flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40">
      <span className="flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-lt)] text-[var(--primary)]"><Icon name={icon} className="h-6 w-6" /></span>
        {badge}
      </span>
      <span className="mt-auto pt-3">
        <span className="block text-base font-semibold text-[var(--text)]">{title}</span>
        <span className="block text-sm text-[var(--text-2)]">{subtitle}</span>
      </span>
    </Link>
  );
}

function CountBadge({ n, tone }: { n: number; tone: "danger" | "warning" }) {
  if (!n) return null;
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold text-white ${tone === "danger" ? "bg-[var(--error-text)]" : "bg-[var(--warning-text)]"}`}>{n}</span>;
}

export function PageTitle({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-[var(--text-2)]">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      {(title || action) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">{title && <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

function Disclosure({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card)]" data-testid={testId}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-[var(--text)]">
        {title}<span className="text-[var(--text-3)] transition-transform group-open:rotate-90"><Icon name="chevron" className="h-4 w-4" /></span>
      </summary>
      <div className="border-t border-[var(--border-2)] p-4">{children}</div>
    </details>
  );
}

function scopeCounts(state: SafetyState, childIds: string[]) {
  const kids = CHILDREN.filter((c) => childIds.includes(c.id));
  const present = presentChildren(state).filter((c) => childIds.includes(c.id)).length;
  const absent = kids.filter((c) => !state.children[c.id].arrivedAt).length;
  const arrived = kids.filter((c) => state.children[c.id].arrivedAt).length;
  const departed = kids.filter((c) => state.children[c.id].departedAt).length;
  return { total: kids.length, present, absent, arrived, departed };
}

// ── Rahbar: umumiy holat ──────────────────────────────────────────

export function DirectorOverview({ ctx }: { ctx: ViewCtx }) {
  const { state } = useSafety();
  const t = uz.ssx.ov;
  const c = scopeCounts(state, ctx.childIds);
  const attention = bandsNeedingAttention(state, ctx.childIds, true).length;
  const status = overallStatus(state, ctx.childIds, attention);
  const open = state.incidents.filter((i) => i.status !== "resolved");
  return (
    <div className="grid gap-5" data-testid="overview-director">
      <StatusBanner status={status} href={ctx.href("ogohlantirishlar")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Counter label={t.total} value={c.total} icon="children" testId="count-total" />
        <Counter label={t.present} value={c.present} icon="check" tone="success" testId="count-present" />
        <Counter label={t.absent} value={c.absent} icon="user" testId="count-absent" />
        <Counter label={t.attention} value={attention} icon="device" tone={attention ? "warning" : "default"} testId="count-attention" />
      </div>
      <section aria-label={t.quick}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-3)]">{t.quick}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickCard href={ctx.href("xarita")} icon="map" title={uz.ssx.sections.map} subtitle={t.q_map} />
          <QuickCard href={ctx.href("davomat")} icon="attendance" title={uz.ssx.teacher_attendance} subtitle={t.q_attendance} />
          <QuickCard href={ctx.href("ogohlantirishlar")} icon="bell" title={uz.ssx.sections.alerts} subtitle={t.q_alerts}
            badge={<CountBadge n={open.length} tone={open.some((i) => i.severity === "critical") ? "danger" : "warning"} />} />
          <QuickCard href={ctx.href("qurilmalar")} icon="device" title={uz.ssx.sections.devices} subtitle={t.q_devices} badge={<CountBadge n={attention} tone="warning" />} />
        </div>
      </section>
    </div>
  );
}

// ── Tarbiyachi: umumiy holat ──────────────────────────────────────

export function TeacherOverview({ ctx }: { ctx: ViewCtx }) {
  const { state } = useSafety();
  const t = uz.ssx.ov;
  const c = scopeCounts(state, ctx.childIds);
  const attention = bandsNeedingAttention(state, ctx.childIds, false).length;
  const status = overallStatus(state, ctx.childIds, attention);
  const open = state.incidents.filter((i) => i.status !== "resolved" && i.childId && ctx.childIds.includes(i.childId));
  const cards: [string, AnyIcon, string, string, React.ReactNode?][] = [
    ["xarita", "map", uz.ssx.sections.map, t.q_map],
    ["sanash", "count", uz.ssx.sections.headcount, t.q_count],
    ["davomat", "attendance", uz.ssx.teacher_attendance, t.q_attendance],
    ["topshirish", "handover", uz.ssx.sections.pickup, t.q_pickup],
    ["ogohlantirishlar", "bell", uz.ssx.sections.alerts, t.q_alerts, <CountBadge key="b" n={open.length} tone={open.some((i) => i.severity === "critical") ? "danger" : "warning"} />],
    ["faollik", "activity", uz.ssx.sections.activity, t.q_activity],
  ];
  return (
    <div className="grid gap-5" data-testid="overview-teacher">
      <StatusBanner status={status} href={ctx.href("ogohlantirishlar")} />
      <div className="grid grid-cols-3 gap-3">
        <Counter label={t.group_total} value={c.total} icon="children" testId="count-total" />
        <Counter label={t.present} value={c.present} icon="check" tone="success" testId="count-present" />
        <Counter label={t.absent} value={c.absent} icon="user" testId="count-absent" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([slug, icon, title, sub, badge]) => <QuickCard key={slug} href={ctx.href(slug)} icon={icon} title={title} subtitle={sub} badge={badge} />)}
      </div>
    </div>
  );
}

// ── Jonli xarita ──────────────────────────────────────────────────

export function MapView({ ctx, focus, withTabs }: { ctx: ViewCtx; focus: string | null; withTabs: boolean }) {
  const t = uz.ssx.map;
  const [tab, setTab] = useState<"map" | "zones" | "cameras" | "staff">("map");
  const tabs: [typeof tab, string][] = [["map", t.map_tab], ["zones", t.zones_tab], ["cameras", t.cameras_tab], ["staff", t.staff_tab]];
  return (
    <div className="grid gap-4">
      {withTabs && (
        <div role="tablist" aria-label={uz.ssx.sections.map} className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-[var(--primary)] text-white" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}>{label}</button>
          ))}
        </div>
      )}
      {tab === "map" && <FloorPlan childIds={ctx.childIds} focusId={focus} showTechnical={ctx.role === "director"} />}
      {tab === "zones" && <GeofenceManager actor={ctx.actor} />}
      {tab === "cameras" && <SmartCctv />}
      {tab === "staff" && <StaffTracking />}
    </div>
  );
}

// ── Aqlli davomat ─────────────────────────────────────────────────

export function AttendanceView({ ctx }: { ctx: ViewCtx }) {
  const { state } = useSafety();
  const t = uz.ssx.att;
  const c = scopeCounts(state, ctx.childIds);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Counter label={t.present} value={c.present} icon="check" tone="success" testId="att-present" />
        <Counter label={t.absent} value={c.absent} icon="user" testId="att-absent" />
        <Counter label={t.arrived} value={c.arrived} icon="door" testId="att-arrived" />
        <Counter label={t.departed} value={c.departed} icon="handover" testId="att-departed" />
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-[var(--info-bg)] px-3 py-2.5 text-sm text-[var(--primary)]" role="note"><Icon name="info" className="mt-0.5 h-4 w-4 flex-shrink-0" />{t.demo_note}</p>
      <ul className="divide-y divide-[var(--border-2)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]" data-testid="smart-attendance">
        {CHILDREN.filter((ch) => ctx.childIds.includes(ch.id)).map((ch) => {
          const st = state.children[ch.id];
          const confirmed = state.attendanceConfirmed[ch.id];
          const status = st.departedAt ? t.departed : st.arrivedAt ? t.arrived : t.absent;
          return (
            <li key={ch.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`att-row-${ch.id}`}>
              <Avatar name={ch.name} tone={toneOf(ch.id)} />
              <span className="min-w-[8rem] flex-1">
                <span className="block font-medium text-[var(--text)]">{ch.name}</span>
                <span className="block text-xs text-[var(--text-2)]">
                  {t.arrival}: <span className="tabular-nums">{fmtTime(st.arrivedAt)}</span> · {t.departure}: <span className="tabular-nums">{fmtTime(st.departedAt)}</span>
                </span>
              </span>
              <Badge variant={st.departedAt ? "neutral" : st.arrivedAt ? "success" : "warning"}>{status}</Badge>
              {st.arrivedAt && (confirmed
                ? <Badge variant="success">✓ {t.confirmed}</Badge>
                : <span className="flex items-center gap-2"><Badge variant="info">{t.detected}</Badge>
                  <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "confirm_attendance", childId: ch.id, by: ctx.actor })}>{t.confirm}</button></span>)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Bolalarni sanash (+ evakuatsiya) ──────────────────────────────

export function HeadcountView({ ctx, canEvacuate }: { ctx: ViewCtx; canEvacuate: boolean }) {
  const { state } = useSafety();
  const t = uz.ssx.hc;
  const [notes, setNotes] = useState<Record<string, boolean>>({});
  const hc = state.headcount;
  const expected = hc ? hc.expected.filter((id) => ctx.childIds.includes(id)) : [];
  const detected = hc ? hc.accounted.filter((id) => ctx.childIds.includes(id)) : [];
  const toVerify = hc ? hc.missing.filter((id) => ctx.childIds.includes(id)) : [];
  const verified = hc?.verified ?? [];
  const pending = toVerify.filter((id) => !verified.includes(id));
  return (
    <div className="grid gap-4">
      {state.evacuation.active && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border-2 border-[var(--error-text)] bg-[var(--error-soft)] px-4 py-3 font-semibold text-[var(--error-text)]">
          <Icon name="alert" />{t.evac_on} · {fmtTime(state.evacuation.startedAt)}
        </p>
      )}
      <Panel>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button type="button" className={`${btn.primary} h-14 px-8 text-lg`} onClick={() => dispatch({ type: "headcount", by: ctx.actor })} data-testid="run-headcount">
            <Icon name="count" className="h-6 w-6" />{t.start}
          </button>
          <p className="text-sm text-[var(--text-2)]" data-testid="headcount-last">{hc ? tpl(t.last, { time: fmtTime(hc.at) }) : t.never}</p>
        </div>
        <p className="mt-3 text-sm text-[var(--text-2)]">{t.note}</p>
      </Panel>
      {hc && (
        <>
          <div className="grid grid-cols-3 gap-3" data-testid="headcount">
            <Counter label={t.expected} value={expected.length} icon="children" />
            <Counter label={t.detected} value={detected.length} icon="check" tone="success" />
            <Counter label={t.verify} value={pending.length} icon="alert" tone={pending.length ? "warning" : "default"} />
          </div>
          {pending.length === 0 && <p className="flex items-center gap-2 rounded-2xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3 font-semibold text-[var(--success)]"><Icon name="check" />{t.all_ok}</p>}
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="headcount-list">
            {expected.map((id) => {
              const isPending = pending.includes(id);
              const wasVerified = verified.includes(id);
              return (
                <li key={id} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${isPending ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--border)] bg-[var(--card)]"}`}>
                  <Avatar name={childName(id)} tone={toneOf(id)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-[var(--text)]">{childName(id)}</span>
                    <span className="block text-xs text-[var(--text-2)]">{isStale(state, id) ? uz.ssx.map.last_known : uz.ssx.map.live}: {zoneName(state.children[id].zoneId)}</span>
                  </span>
                  {isPending
                    ? <button type="button" className={btn.primary} disabled={notes[id]} onClick={() => { setNotes((n) => ({ ...n, [id]: true })); dispatch({ type: "verify_child", childId: id, by: ctx.actor, note: t.verified }); }}>{t.verify_btn}</button>
                    : <Badge variant="success">{wasVerified ? t.verified : t.detected}</Badge>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {canEvacuate && (
        <Disclosure title={t.evac_title} testId="evacuation">
          <div className="flex flex-wrap items-center gap-3">
            {state.evacuation.active
              ? <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "evacuation", active: false, by: ctx.actor })}>{t.evac_end}</button>
              : <button type="button" className={btn.danger} onClick={() => dispatch({ type: "evacuation", active: true, by: ctx.actor })}>{t.evac_start}</button>}
          </div>
          <div className="mt-4"><FloorPlan childIds={ctx.childIds} compact /></div>
        </Disclosure>
      )}
    </div>
  );
}

// ── Xavfsiz topshirish ────────────────────────────────────────────

export function PickupView({ ctx }: { ctx: ViewCtx }) {
  const { state } = useSafety();
  const t = uz.ssx.pk;
  const kids = CHILDREN.filter((c) => ctx.childIds.includes(c.id));
  const [childId, setChildId] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [checked, setChecked] = useState<"allowed" | "denied" | null>(null);
  const child = kids.find((c) => c.id === childId) ?? null;
  const st = child ? state.children[child.id] : null;
  const history = [...state.pickups].filter((p) => ctx.childIds.includes(p.childId)).reverse();

  function choose(id: string) { setChildId(id); setPerson(""); setChecked(null); }
  function check() {
    if (!child || !person) return;
    const ok = child.pickup.includes(person);
    setChecked(ok ? "allowed" : "denied");
    if (!ok) dispatch({ type: "pickup", childId: child.id, personId: person, by: ctx.actor });  // rad etilgan urinish jurnalga yoziladi
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel title={t.step1}>
        <ul className="grid gap-2" data-testid="pickup-children">
          {kids.map((c) => {
            const s = state.children[c.id];
            const here = s.arrivedAt && !s.departedAt;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => choose(c.id)} disabled={!here} aria-pressed={childId === c.id}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left disabled:opacity-60 ${childId === c.id ? "border-[var(--primary)] bg-[var(--primary-lt)]" : "border-[var(--border)] hover:bg-[var(--hover)]"}`}>
                  <Avatar name={c.name} tone={toneOf(c.id)} size="sm" />
                  <span className="flex-1 font-medium text-[var(--text)]">{c.name}</span>
                  {s.departedAt ? <Badge variant="neutral">{t.done} · {fmtTime(s.departedAt)}</Badge> : !here ? <Badge variant="neutral">{t.not_here}</Badge> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
      <div className="grid content-start gap-4">
        {child && st ? (
          <Panel>
            <div className="flex items-center gap-3">
              <Avatar name={child.name} tone={toneOf(child.id)} size="lg" />
              <div><p className="text-lg font-semibold text-[var(--text)]">{child.name}</p><p className="text-sm text-[var(--text-2)]">{groupOf(child.id)?.name}</p></div>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">{t.persons}</h3>
            <ul className="mt-2 grid gap-1.5 text-sm" data-testid="pickup-authorized">
              {child.pickup.map((p) => (
                <li key={p} className="flex items-center gap-2 text-[var(--text)]"><Icon name="check" className="h-4 w-4 text-[var(--success)]" />{personName(p)}
                  <span className="text-[var(--text-2)]">· {uz.ss.relation[PICKUP_PERSONS.find((x) => x.id === p)!.relation]}</span></li>
              ))}
            </ul>
            {st.departedAt ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--success-soft)] px-3 py-2.5 font-semibold text-[var(--success)]" data-testid="pickup-done">
                <Icon name="check" />{t.done}: {personName(st.pickedUpBy)} · {fmtTime(st.departedAt)}
              </p>
            ) : (
              <>
                <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">{t.step2}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="sr-only" htmlFor="ss-pickup-person">{t.who}</label>
                  <select id="ss-pickup-person" value={person} onChange={(e) => { setPerson(e.target.value); setChecked(null); }}
                    className="h-10 min-w-[12rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]">
                    <option value="">{t.who}</option>
                    {PICKUP_PERSONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" className={btn.secondary} disabled={!person} onClick={check}>{t.check}</button>
                </div>
                {checked === "denied" && <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--error-soft)] px-3 py-2.5 font-semibold text-[var(--error-text)]" data-testid="pickup-denied"><Icon name="alert" />{t.denied}</p>}
                {checked === "allowed" && (
                  <div className="mt-3 rounded-xl bg-[var(--success-soft)] px-3 py-3">
                    <p className="flex items-center gap-2 font-semibold text-[var(--success)]"><Icon name="check" />{t.allowed}: {personName(person)}</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text)]">{t.step3}</p>
                    <button type="button" className={`${btn.primary} mt-2 h-11 px-5`} data-testid="pickup-confirm"
                      onClick={() => { dispatch({ type: "pickup", childId: child.id, personId: person, by: ctx.actor }); setChecked(null); }}>{t.confirm}</button>
                  </div>
                )}
              </>
            )}
            <p className="mt-4 text-xs text-[var(--text-3)]">{t.note}</p>
          </Panel>
        ) : <p className="rounded-2xl border border-dashed border-[var(--border-strong)] p-5 text-sm text-[var(--text-2)]">{t.choose_child}</p>}
        <Panel title={t.history}>
          {history.length === 0 ? <p className="text-sm text-[var(--text-2)]">{t.empty}</p> : (
            <ul className="divide-y divide-[var(--border-2)] text-sm" data-testid="pickup-history">
              {history.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="tabular-nums text-[var(--text-2)]">{fmtTime(p.at)}</span>
                  <span className="font-medium text-[var(--text)]">{childName(p.childId)}</span>
                  <span className="text-[var(--label)]">→ {personName(p.personId)}</span>
                  <Badge variant={p.ok ? "success" : "error"}>{p.ok ? t.done : t.denied.split(" — ")[0]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Kunlik faollik ────────────────────────────────────────────────

export function ActivityView({ ctx, sub }: { ctx: ViewCtx; sub: string | undefined }) {
  const { state } = useSafety();
  if (sub === "harakat") return <SmartActivity childIds={ctx.childIds} />;
  if (sub === "uyqu") return <SmartSleep childIds={ctx.childIds} actor={ctx.actor} />;
  if (sub === "ovqat") return <SmartMeal childIds={ctx.childIds} actor={ctx.actor} />;
  const present = presentChildren(state).filter((c) => ctx.childIds.includes(c.id));
  const fed = present.filter((c) => state.meals[c.id]).length;
  const slug = ctx.role === "director" ? "bolalar/faollik" : "faollik";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <QuickCard href={ctx.href(`${slug}/harakat`)} icon="activity" title={uz.ss.modules.activity} subtitle={`${present.length} · ${uz.ssx.att.present}`} />
      <QuickCard href={ctx.href(`${slug}/uyqu`)} icon="home" title={uz.ss.modules.sleep} subtitle={state.nap.active ? `${uz.ss.v2.sleep_active} · ${fmtTime(state.nap.startedAt)}` : uz.ss.v2.sleep_start} />
      <QuickCard href={ctx.href(`${slug}/ovqat`)} icon="check" title={uz.ss.modules.meal} subtitle={`${fed}/${present.length}`} />
    </div>
  );
}

// ── Rahbar: bolalar nazorati markazi ──────────────────────────────

export function ChildrenHub({ ctx, sub, rest }: { ctx: ViewCtx; sub: string | undefined; rest: string | undefined }) {
  if (sub === "sanash") return <HeadcountView ctx={ctx} canEvacuate />;
  if (sub === "topshirish") return <PickupView ctx={ctx} />;
  if (sub === "faollik") return <ActivityView ctx={ctx} sub={rest} />;
  if (sub === "avtobus") return <SmartBus actor={ctx.actor} />;
  if (sub === "salomatlik") return <SmartHealth childIds={ctx.childIds} />;
  const t = uz.ssx.ov;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <QuickCard href={ctx.href("bolalar/sanash")} icon="count" title={uz.ssx.sections.headcount} subtitle={`${t.q_count} · ${uz.ssx.hc.evac_title}`} />
      <QuickCard href={ctx.href("bolalar/topshirish")} icon="handover" title={uz.ssx.sections.pickup} subtitle={t.q_pickup} />
      <QuickCard href={ctx.href("bolalar/faollik")} icon="activity" title={uz.ssx.sections.activity} subtitle={t.q_activity} />
      <QuickCard href={ctx.href("bolalar/avtobus")} icon="map" title={uz.ss.modules.bus} subtitle={uz.ss.v2.badge} />
      <QuickCard href={ctx.href("bolalar/salomatlik")} icon="shield" title={uz.ss.modules.health} subtitle={uz.ss.v2.badge} />
    </div>
  );
}

// ── Ogohlantirishlar ──────────────────────────────────────────────

export function AlertsView({ ctx }: { ctx: ViewCtx }) {
  return <AlertCenter childIds={ctx.role === "teacher" ? ctx.childIds : null} actor={ctx.actor} mapHref={(id) => ctx.href("xarita", `?bola=${id}`)} />;
}

// ── Qurilmalar ────────────────────────────────────────────────────

const CATALOG: { key: "band" | "sense" | "hub" | "gate" | "charger" | "alarm"; kinds: DeviceState["kind"][] }[] = [
  { key: "band", kinds: ["wristband"] }, { key: "sense", kinds: ["anchor"] }, { key: "hub", kinds: ["gateway"] },
  { key: "gate", kinds: [] }, { key: "charger", kinds: [] }, { key: "alarm", kinds: [] },
];

/** Mahsulot konsepti chizmalari (haqiqiy mahsulot rasmi emas). */
function ConceptArt({ k }: { k: (typeof CATALOG)[number]["key"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const art: Record<typeof k, React.ReactNode> = {
    band: <><rect x="34" y="14" width="32" height="44" rx="10" {...common} /><path d="M40 14V6h20v8M40 58v8h20v-8" {...common} /><circle cx="50" cy="36" r="7" {...common} /></>,
    sense: <><circle cx="50" cy="38" r="20" {...common} /><circle cx="50" cy="38" r="4" fill="currentColor" /><path d="M36 24a20 20 0 0 1 28 0M30 18a28 28 0 0 1 40 0" {...common} opacity={0.5} /></>,
    hub: <><rect x="22" y="36" width="56" height="22" rx="6" {...common} /><path d="M36 36V14M64 36V14" {...common} /><circle cx="34" cy="47" r="2" fill="currentColor" /><circle cx="42" cy="47" r="2" fill="currentColor" /></>,
    gate: <><path d="M26 64V22a24 14 0 0 1 48 0v42" {...common} /><path d="M18 64h64" {...common} /><path d="M44 46l6 6 10-12" {...common} /></>,
    charger: <><rect x="18" y="40" width="64" height="20" rx="5" {...common} /><path d="M30 40V26h10v14M46 40V26h10v14M62 40V26h10v14" {...common} /><path d="M48 49l4-4v8l4-4" {...common} /></>,
    alarm: <><path d="M34 54V38a16 16 0 0 1 32 0v16" {...common} /><path d="M26 60h48" {...common} /><path d="M50 12v6M24 24l4 4M76 24l-4 4" {...common} /></>,
  };
  return <svg viewBox="0 0 100 72" className="h-20 w-full text-[var(--primary)]" aria-hidden="true">{art[k]}</svg>;
}

export function DevicesView({ ctx, sub }: { ctx: ViewCtx; sub: string | undefined }) {
  const { state } = useSafety();
  const t = uz.ssx.dev;
  if (sub === "biriktirish") return <DeviceAssignment actor={ctx.actor} />;
  if (sub && state.devices[sub]) return <DeviceDetail ctx={ctx} device={state.devices[sub]} />;
  const attention = bandsNeedingAttention(state, ctx.childIds, true);
  const bands = Object.values(state.devices).filter((d) => d.kind === "wristband");
  return (
    <div className="grid gap-5">
      <Panel title={t.attention} action={<Link href={ctx.href("qurilmalar/biriktirish")} className={btn.secondary}>{t.assign}</Link>}>
        {attention.length === 0 ? <p className="flex items-center gap-2 text-sm text-[var(--success)]"><Icon name="check" className="h-4 w-4" />{t.all_good}</p> : (
          <ul className="grid gap-2" data-testid="device-attention">
            {attention.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2.5">
                <Icon name={bandStatus(d) === "s_charge" ? "battery" : bandStatus(d) === "s_offline" ? "wifi_off" : "alert"} className="h-5 w-5 text-[var(--warning-text)]" />
                <span className="flex-1 text-sm font-medium text-[var(--text)]">{bandMessage(d)}</span>
                <Link href={ctx.href(`qurilmalar/${d.id}`)} className="text-sm font-medium text-[var(--primary)] hover:underline">{t.details}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <section aria-labelledby="ss-catalog">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="ss-catalog" className="text-base font-semibold text-[var(--text)]">KIDDO</h2>
          <Badge variant="info">{t.concept}</Badge>
        </div>
        <p className="mb-3 text-xs text-[var(--text-2)]">{t.concept_note}</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="device-catalog">
          {CATALOG.map(({ key, kinds }) => {
            const items = Object.values(state.devices).filter((d) => kinds.includes(d.kind));
            const ok = items.filter((d) => bandStatus(d) === "s_ok" || (d.kind !== "wristband" && d.status === "online")).length;
            return (
              <li key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="rounded-xl bg-[var(--surface-2)] py-3"><ConceptArt k={key} /></div>
                <p className="mt-3 font-semibold text-[var(--text)]">{t[key]}</p>
                <p className="text-sm text-[var(--text-2)]">{t[`${key}_d` as keyof typeof t]}</p>
                <p className="mt-2 text-sm">
                  {items.length ? <span className="text-[var(--label)]">{tpl(t.installed, { n: items.length })} · <span className={ok === items.length ? "text-[var(--success)]" : "text-[var(--warning-text)]"}>{t.s_ok}: {ok}</span></span>
                    : <span className="text-[var(--text-3)]">{t.planned}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
      <Panel title={t.band}>
        <ul className="divide-y divide-[var(--border-2)]" data-testid="band-list">
          {bands.map((d) => {
            const s = bandStatus(d);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                {d.childId ? <Avatar name={childName(d.childId)} tone={toneOf(d.childId)} size="sm" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-3)]"><Icon name="device" className="h-4 w-4" /></span>}
                <span className="min-w-[8rem] flex-1 text-sm font-medium text-[var(--text)]">{d.childId ? childName(d.childId) : t.s_unassigned}</span>
                <span className="text-sm tabular-nums text-[var(--label)]">{d.battery}%</span>
                <Badge variant={BAND_VARIANT[s]}>{t[s]}</Badge>
                <Link href={ctx.href(`qurilmalar/${d.id}`)} className="text-sm font-medium text-[var(--primary)] hover:underline">{t.details}</Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function DeviceDetail({ ctx, device: d }: { ctx: ViewCtx; device: DeviceState }) {
  const t = uz.ssx.dev;
  const tt = uz.ss.table;
  const s = d.kind === "wristband" ? bandStatus(d) : d.status === "online" ? "s_ok" : "s_offline";
  const rows: [string, React.ReactNode][] = [
    [tt.kind, kindLabel(d.kind)], [tt.child, d.childId ? childName(d.childId) : "—"], [tt.battery, `${d.battery}%`],
    [tt.status, <Badge key="s" variant={BAND_VARIANT[s]}>{t[s]}</Badge>], [tt.last_seen, fmtTime(d.lastSeen, true)],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={d.childId ? childName(d.childId) : kindLabel(d.kind)} action={<Link href={ctx.href("qurilmalar")} className="text-sm font-medium text-[var(--primary)] hover:underline">← {t.back}</Link>}>
        <dl className="grid gap-2.5 text-sm" data-testid="device-detail">
          {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3"><dt className="text-[var(--text-2)]">{k}</dt><dd className="text-right text-[var(--text)]">{v}</dd></div>)}
        </dl>
        {d.kind === "wristband" && s !== "s_ok" && <p className="mt-4 rounded-xl bg-[var(--warning-soft)] px-3 py-2.5 text-sm font-medium text-[var(--warning-text)]">{bandMessage(d)}</p>}
      </Panel>
      <Disclosure title={t.tech} testId="device-tech">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-2)]">{tt.device}</dt><dd><code className="text-xs">{d.id}</code></dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-2)]">{tt.firmware}</dt><dd>{d.firmware}</dd></div>
        </dl>
      </Disclosure>
    </div>
  );
}

// ── Hisobotlar va sozlamalar (rahbar) ─────────────────────────────

export function ReportsView({ anonymous = false }: { anonymous?: boolean }) {
  return (
    <div className="grid gap-4">
      <Analytics />
      <Disclosure title={uz.ss.modules.audit} testId="report-audit"><AuditLog limit={60} anonymous={anonymous} /></Disclosure>
    </div>
  );
}

export function DirectorSettings({ ctx }: { ctx: ViewCtx }) {
  return (
    <div className="grid gap-4">
      <GeofenceManager actor={ctx.actor} />
      <Disclosure title={uz.ss.modules.integrations} testId="settings-integrations"><Integrations /></Disclosure>
      <Disclosure title={uz.ss.modules.audit}><AuditLog limit={60} /></Disclosure>
    </div>
  );
}

// ── Super Admin ───────────────────────────────────────────────────

type OrgStatus = "s_ok" | "s_check" | "s_offline" | "s_none";
function orgStatus(state: SafetyState, r: ReturnType<typeof globalStats>[number]): OrgStatus {
  if (r.devices === 0) return "s_none";
  if (r.id === "demo-org-1" && !state.gatewayOnline) return "s_offline";
  if (r.openIncidents > 0 || r.lowBattery > 0 || r.online < r.devices) return "s_check";
  return "s_ok";
}
const ORG_VARIANT: Record<OrgStatus, "success" | "warning" | "error" | "neutral"> = { s_ok: "success", s_check: "warning", s_offline: "error", s_none: "neutral" };

export function SAOverview({ ctx }: { ctx: ViewCtx }) {
  const { state } = useSafety();
  const t = uz.ssx.sa;
  const rows = globalStats(state);
  const devices = rows.reduce((a, r) => a + r.devices, 0);
  const working = rows.reduce((a, r) => a + r.online, 0);
  const alerts = rows.reduce((a, r) => a + r.openIncidents, 0);
  const statuses = rows.map((r) => orgStatus(state, r));
  const count = (s: OrgStatus) => statuses.filter((x) => x === s).length;
  return (
    <div className="grid gap-5" data-testid="overview-sa">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Counter label={t.kindergartens} value={rows.filter((r) => r.devices > 0).length} icon="building" />
        <Counter label={t.devices} value={devices} icon="device" />
        <Counter label={t.working} value={working} icon="check" tone="success" />
        <Counter label={t.alerts} value={alerts} icon="bell" tone={alerts ? "warning" : "default"} />
      </div>
      <Panel title={t.summary}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["s_ok", "s_check", "s_offline", "s_none"] as OrgStatus[]).map((s) => (
            <div key={s} className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
              <Badge variant={ORG_VARIANT[s]}>{t[s]}</Badge>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]" data-testid={`org-status-${s}`}>{count(s)}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-[var(--border-2)]" data-testid="org-list">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-lt)] text-[var(--primary)]"><Icon name="building" className="h-5 w-5" /></span>
              <span className="min-w-[10rem] flex-1"><span className="block text-sm font-medium text-[var(--text)]">{r.name}</span><span className="block text-xs text-[var(--text-2)]">{r.region}</span></span>
              <Badge variant={ORG_VARIANT[statuses[i]]}>{t[statuses[i]]}</Badge>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="flex items-start gap-2 text-xs text-[var(--text-2)]"><Icon name="lock" className="h-4 w-4 flex-shrink-0" />{t.privacy}</p>
      <Link href={ctx.href("sozlamalar")} className="text-sm font-medium text-[var(--primary)] hover:underline">{t.tech} →</Link>
    </div>
  );
}

export function SAKindergartens() {
  const { state } = useSafety();
  const t = uz.ssx.sa;
  const rows = globalStats(state);
  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="sa-orgs">
      {rows.map((r) => {
        const s = orgStatus(state, r);
        return (
          <li key={r.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-semibold text-[var(--text)]">{r.name}</p><p className="text-sm text-[var(--text-2)]">{r.region}</p></div>
              <Badge variant={ORG_VARIANT[s]}>{t[s]}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-xs text-[var(--text-2)]">{t.devices}</dt><dd className="text-lg font-bold tabular-nums">{r.devices}</dd></div>
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-xs text-[var(--text-2)]">{t.working}</dt><dd className="text-lg font-bold tabular-nums">{r.online}</dd></div>
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-xs text-[var(--text-2)]">{t.alerts}</dt><dd className="text-lg font-bold tabular-nums">{r.openIncidents}</dd></div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function SADevices() {
  const { state } = useSafety();
  const t = uz.ssx.dev;
  const k = kpis(state);
  return (
    <div className="grid gap-4">
      <p className="text-xs text-[var(--text-2)]"><Badge variant="info">{t.concept}</Badge> {t.concept_note}</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="device-catalog">
        {CATALOG.map(({ key }) => (
          <li key={key} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="rounded-xl bg-[var(--surface-2)] py-3"><ConceptArt k={key} /></div>
            <p className="mt-3 font-semibold text-[var(--text)]">{t[key]}</p>
            <p className="text-sm text-[var(--text-2)]">{t[`${key}_d` as keyof typeof t]}</p>
          </li>
        ))}
      </ul>
      <SAKindergartens />
      <p className="text-xs text-[var(--text-3)]">{uz.ssx.sa.devices}: {k.devices} · {uz.ssx.sa.working}: {k.online} (KIDDO Demo)</p>
    </div>
  );
}

export function SASettings({ ctx }: { ctx: ViewCtx }) {
  const t = uz.ssx.sa;
  return (
    <div className="grid gap-3">
      <Panel title={t.tech}><p className="text-sm text-[var(--text-2)]">{t.tech_desc}</p></Panel>
      <Disclosure title={uz.ss.modules.diagnostics} testId="sa-diagnostics"><Diagnostics /></Disclosure>
      <Disclosure title={uz.ss.modules.integrations} testId="sa-integrations"><Integrations /></Disclosure>
      <Disclosure title={uz.ss.modules.features} testId="sa-features"><FeatureManagement actor={ctx.actor} /></Disclosure>
      <Disclosure title={uz.ss.modules.audit} testId="sa-audit"><AuditLog limit={60} anonymous /></Disclosure>
    </div>
  );
}

/** Ichki sahifa nomi (breadcrumb uchun). */
export function subLabel(slug: string, state: SafetyState): string {
  const m: Record<string, string> = {
    sanash: uz.ssx.sections.headcount, topshirish: uz.ssx.sections.pickup, faollik: uz.ssx.sections.activity,
    avtobus: uz.ss.modules.bus, salomatlik: uz.ss.modules.health, harakat: uz.ss.modules.activity, uyqu: uz.ss.modules.sleep,
    ovqat: uz.ss.modules.meal, biriktirish: uz.ss.modules.assignment,
  };
  if (m[slug]) return m[slug];
  const d = state.devices[slug];
  return d ? (d.childId ? `${kindLabel(d.kind)} · ${firstName(d.childId)}` : kindLabel(d.kind)) : slug;
}
