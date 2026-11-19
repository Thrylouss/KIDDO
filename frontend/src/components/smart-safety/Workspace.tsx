"use client";

import { useEffect, useState } from "react";
import uz from "@/i18n";
import { pause, reset, setResolveNote, start } from "@/lib/smart-safety/store";
import { SCENARIOS, type Actor } from "@/lib/smart-safety/engine";
import { CHILDREN, DEMO_TEACHER_ID, GROUPS, type Role } from "@/lib/smart-safety/model";
import AlertCenter, { AlertBanner } from "./AlertCenter";
import ParentApp from "./ParentApp";
import {
  Allocation, Analytics, AuditLog, BatteryMonitor, DeviceAssignment, DeviceTable, Diagnostics, Evacuation, FeatureManagement,
  GeofenceManager, GlobalDashboard, Integrations, LiveMap, SafetyDashboard, SmartAttendance, SmartPickup,
} from "./modules";
import { SmartActivity, SmartBus, SmartCctv, SmartHealth, SmartMeal, SmartSleep, StaffTracking } from "./V2Modules";
import { DemoBadge, SoonBadge, btn, fmtTime, useSafety } from "./shared";

type ModuleKey = keyof typeof uz.ss.modules;

/** Har bir rol faqat o'z vakolatidagi modullarni ko'radi. */
export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  super_admin: ["global", "inventory", "allocation", "diagnostics", "integrations", "features", "analytics", "audit"],
  director: ["dashboard", "map", "devices", "assignment", "attendance", "geofence", "alerts", "evacuation", "battery", "pickup", "analytics",
    "activity", "sleep", "meal", "cctv", "bus", "health", "staff", "audit", "integrations"],
  teacher: ["map", "attendance", "alerts", "headcount", "pickup", "battery", "activity", "sleep", "meal"],
  parent: ["parent_app"],
};

/** Modul qaysi feature flag'ga bog'liq (Super Admin «Funksiyalarni boshqarish» orqali o'chirsa — modul ko'rsatilmaydi). */
const FLAG: Partial<Record<ModuleKey, string>> = {
  map: "live_map", attendance: "smart_attendance", geofence: "geofence", pickup: "pickup", evacuation: "evacuation", headcount: "evacuation",
  analytics: "analytics", activity: "v2_modules", sleep: "v2_modules", meal: "v2_modules", cctv: "v2_modules", bus: "v2_modules", health: "v2_modules", staff: "v2_modules",
};

export function scopeFor(role: Role): string[] {
  if (role === "teacher") {
    const g = GROUPS.find((x) => x.teacherId === DEMO_TEACHER_ID)!;
    return CHILDREN.filter((c) => c.groupId === g.id).map((c) => c.id);
  }
  return role === "director" ? CHILDREN.map((c) => c.id) : [];
}

export function SimulatorControls() {
  const { state, runner } = useSafety();
  const t = uz.ss.sim;
  const [pick, setPick] = useState<string>("full");
  useEffect(() => { setResolveNote(uz.ss.resolve_note); });
  const sc = SCENARIOS.find((s) => s.id === runner.scenario);
  const scenarioName = (key: string) => (uz.ss.scenario as Record<string, string>)[key] ?? key;

  return (
    <section className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3" aria-label={t.title} data-testid="simulator">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-[var(--text)]">{t.title}</span>
        <label className="sr-only" htmlFor="ss-scenario">{t.scenario}</label>
        <select id="ss-scenario" value={pick} onChange={(e) => setPick(e.target.value)}
          className="h-9 max-w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--text)]">
          <option value="full">{t.full}</option>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.id}. {scenarioName(s.key)}</option>)}
        </select>
        {runner.running
          ? <button type="button" className={btn.secondary} onClick={pause}>⏸ {t.pause}</button>
          : <button type="button" className={btn.primary} onClick={() => start(pick === "full" ? null : Number(pick))}>▶ {pick === "full" ? t.start : t.run}</button>}
        <button type="button" className={btn.secondary} onClick={reset}>↺ {t.reset}</button>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-[var(--text-2)]" aria-live="polite">
          <span className={`inline-block h-2 w-2 rounded-full ${runner.running ? "bg-[var(--success)] motion-safe:animate-pulse" : "bg-[var(--text-3)]"}`} />
          {runner.running ? t.running : t.paused}
          {sc && <span data-testid="sim-scenario">· {t.scenario} {sc.id}: {scenarioName(sc.key)} · {t.step} {Math.min(runner.step, sc.steps.length)}/{sc.steps.length}</span>}
          <span>· {t.clock}: <span className="tabular-nums" data-testid="sim-clock">{fmtTime(state.now, true)}</span></span>
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-3)]">{t.tabs_hint}</p>
    </section>
  );
}

export default function Workspace({ role, showControls = true }: { role: Role; showControls?: boolean }) {
  const { state } = useSafety();
  const actor: Actor = role;
  const childIds = scopeFor(role);
  const mods = ROLE_MODULES[role].filter((m) => !FLAG[m] || state.features[FLAG[m]!] !== false);
  const [active, setActive] = useState<ModuleKey>(mods[0]);
  const current = mods.includes(active) ? active : mods[0];

  const render = (m: ModuleKey) => {
    switch (m) {
      case "dashboard": return <SafetyDashboard childIds={childIds} />;
      case "map": return <LiveMap childIds={childIds} />;
      case "devices": return <DeviceTable />;
      case "inventory": return <DeviceTable />;
      case "assignment": return <DeviceAssignment actor={actor} />;
      case "attendance": return <SmartAttendance childIds={childIds} />;
      case "geofence": return <GeofenceManager actor={actor} />;
      case "alerts": return <AlertCenter childIds={role === "teacher" ? childIds : null} actor={actor} />;
      case "evacuation": return <Evacuation actor={actor} childIds={childIds} canControl />;
      case "headcount": return <Evacuation actor={actor} childIds={childIds} canControl={false} />;
      case "pickup": return <SmartPickup childIds={childIds} actor={actor} />;
      case "battery": return <BatteryMonitor childIds={childIds} />;
      case "analytics": return <Analytics />;
      case "activity": return <SmartActivity childIds={childIds} />;
      case "sleep": return <SmartSleep childIds={childIds} actor={actor} />;
      case "meal": return <SmartMeal childIds={childIds} actor={actor} />;
      case "cctv": return <SmartCctv />;
      case "bus": return <SmartBus actor={actor} />;
      case "health": return <SmartHealth childIds={childIds} />;
      case "staff": return <StaffTracking />;
      case "audit": return <AuditLog />;
      case "integrations": return <Integrations />;
      case "global": return <GlobalDashboard />;
      case "allocation": return <Allocation />;
      case "diagnostics": return <Diagnostics />;
      case "features": return <FeatureManagement actor={actor} />;
      case "parent_app": return <ParentApp />;
    }
  };

  return (
    <div className="min-w-0" data-testid={`workspace-${role}`}>
      <div role="note" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-text)]">
        <DemoBadge /><SoonBadge /><span>{uz.ss.demo_banner}</span>
      </div>
      {showControls && <SimulatorControls />}
      {(role === "teacher" || role === "director") && <AlertBanner childIds={role === "teacher" ? childIds : null} actor={actor} />}
      {mods.length > 1 && (
        <nav aria-label={uz.ss.modules_label} className="mb-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
          {mods.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={current === m} onClick={() => setActive(m)}
              className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${current === m ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--label)] hover:bg-[var(--hover)]"}`}>
              {uz.ss.modules[m]}
            </button>
          ))}
        </nav>
      )}
      <div role="tabpanel">{render(current)}</div>
    </div>
  );
}
