/**
 * KIDDO Smart Safety — taqdimot simulyatori (sof, deterministik reducer).
 * Faqat sintetik ma'lumot: hech qanday API chaqirilmaydi, haqiqiy davomat yoki ota-onalarga bildirishnoma yo'q.
 * Qurilma hodisalari gateway orqali o'tadi: gateway oflayn bo'lsa buferlanadi, ulanish tiklanganda vaqt tartibida
 * va deduplikatsiya bilan qayta ishlanadi (backend IotCore bilan bir xil qoidalar).
 */
import { ANCHORS, CHILDREN, DEMO_ORGS, GROUPS, STAFF, ZONES, zoneAt, zoneCenter } from "./model";

export type IncidentType = "restricted_zone" | "sos" | "battery_low" | "device_offline" | "device_removed" | "missing";
export type Severity = "critical" | "high" | "warning";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type DeviceKind = "wristband" | "gateway" | "anchor" | "camera" | "bus_tracker" | "staff_badge";
export type Actor = "device" | "system" | "director" | "teacher" | "super_admin" | "parent";

export interface ChildState {
  id: string;
  x: number | null;
  y: number | null;
  zoneId: string | null;
  updatedAt: number | null;
  arrivedAt: number | null;
  departedAt: number | null;
  pickedUpBy: string | null;
}
export interface DeviceState { id: string; kind: DeviceKind; childId: string | null; battery: number; status: "online" | "offline" | "removed"; lastSeen: number; firmware: string; }
export interface Incident {
  id: string; type: IncidentType; severity: Severity; status: IncidentStatus; childId: string | null; deviceId: string | null; zoneId: string | null;
  openedAt: number; escalatedAt: number | null; ackAt: number | null; ackBy: Actor | null; resolvedAt: number | null; resolvedBy: Actor | null; note: string | null;
}
export interface LogEntry { id: number; at: number; actor: Actor; code: string; params: Record<string, string | number>; }
export interface Notice { id: number; at: number; childId: string; code: "arrival" | "departure" | "safety" | "device"; params: Record<string, string | number>; }
export interface PickupRecord { at: number; childId: string; personId: string; ok: boolean; }

export type DeviceEvent =
  | { kind: "move"; childId: string; x: number; y: number; at: number }
  | { kind: "sos"; childId: string; at: number }
  | { kind: "battery"; deviceId: string; level: number; at: number }
  | { kind: "offline"; deviceId: string; at: number }
  | { kind: "online"; deviceId: string; at: number }
  | { kind: "removed"; deviceId: string; at: number };

/** Union'ning har bir a'zosidan maydonni olib tashlaydi (oddiy Omit union'ni birlashtirib yuboradi). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type DeviceEventInput = DistributiveOmit<DeviceEvent, "at">;

export type Action =
  | { type: "device"; event: DeviceEventInput }
  | { type: "tick"; ms: number }
  | { type: "ack"; incidentId: string; by: Actor }
  | { type: "resolve"; incidentId: string; by: Actor; note: string }
  | { type: "pickup"; childId: string; personId: string; by: Actor }
  | { type: "evacuation"; active: boolean; by: Actor }
  | { type: "headcount"; by: Actor }
  | { type: "gateway"; online: boolean }
  | { type: "assign"; deviceId: string; childId: string | null; by: Actor }
  | { type: "zone_restricted"; zoneId: string; restricted: boolean; by: Actor }
  | { type: "feature"; key: string; enabled: boolean; by: Actor }
  | { type: "meal"; childId: string; by: Actor }
  | { type: "nap"; active: boolean; by: Actor }
  | { type: "bus"; by: Actor }
  /** Tarbiyachi qurilma aniqlagan kelishni tasdiqlaydi (rasmiy davomat emas — demo ichida). */
  | { type: "confirm_attendance"; childId: string; by: Actor }
  /** Sanashda qurilma aniqlamagan bolani xodim o'z ko'zi bilan ko'rib tasdiqlaydi. */
  | { type: "verify_child"; childId: string; by: Actor; note: string };

export interface SafetyState {
  version: number;
  now: number;
  seq: number;
  children: Record<string, ChildState>;
  devices: Record<string, DeviceState>;
  incidents: Incident[];
  log: LogEntry[];
  notices: Notice[];
  pickups: PickupRecord[];
  gatewayOnline: boolean;
  buffer: DeviceEvent[];
  processedKeys: string[];
  evacuation: { active: boolean; startedAt: number | null; endedAt: number | null };
  headcount: { at: number; expected: string[]; accounted: string[]; missing: string[]; verified: string[] } | null;
  attendanceConfirmed: Record<string, number>;
  restrictedOverrides: Record<string, boolean>;
  features: Record<string, boolean>;
  meals: Record<string, number>;
  nap: { active: boolean; startedAt: number | null };
  busStop: number;
  distance: Record<string, number>;
}

export const ESCALATION_MS = 90_000;
export const STALE_MS = 120_000;
export const BATTERY_LOW = 15;
export const FEATURE_KEYS = ["live_map", "smart_attendance", "geofence", "sos", "pickup", "evacuation", "analytics", "v2_modules"] as const;

const SEVERITY: Record<IncidentType, Severity> = {
  restricted_zone: "critical", sos: "critical", missing: "high", device_removed: "high", device_offline: "warning", battery_low: "warning",
};

/** Bugungi kun 08:00 (mahalliy) — simulyatsiya soati boshlanishi. */
export function demoStartTime(base = new Date()): number {
  const d = new Date(base);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

export function initialState(now = demoStartTime()): SafetyState {
  const children: Record<string, ChildState> = {};
  const devices: Record<string, DeviceState> = {};
  CHILDREN.forEach((c, i) => {
    children[c.id] = { id: c.id, x: null, y: null, zoneId: null, updatedAt: null, arrivedAt: null, departedAt: null, pickedUpBy: null };
    devices[c.deviceId] = { id: c.deviceId, kind: "wristband", childId: c.id, battery: 96 - i * 4, status: "online", lastSeen: now, firmware: "1.4.2" };
  });
  devices["demo-GW-01"] = { id: "demo-GW-01", kind: "gateway", childId: null, battery: 100, status: "online", lastSeen: now, firmware: "2.1.0" };
  ANCHORS.forEach((a) => { devices[a.id] = { id: a.id, kind: "anchor", childId: null, battery: 100, status: "online", lastSeen: now, firmware: "1.0.7" }; });
  ["demo-CAM-1", "demo-CAM-2", "demo-CAM-3", "demo-CAM-4"].forEach((id) => { devices[id] = { id, kind: "camera", childId: null, battery: 100, status: "online", lastSeen: now, firmware: "5.2" }; });
  devices["demo-BUS-1"] = { id: "demo-BUS-1", kind: "bus_tracker", childId: null, battery: 88, status: "online", lastSeen: now, firmware: "3.0.1" };
  STAFF.forEach((s) => { devices[s.badgeId] = { id: s.badgeId, kind: "staff_badge", childId: null, battery: 90, status: "online", lastSeen: now, firmware: "1.2.0" }; });

  return {
    version: 1, now, seq: 1, children, devices, incidents: [], log: [], notices: [], pickups: [],
    gatewayOnline: true, buffer: [], processedKeys: [],
    evacuation: { active: false, startedAt: null, endedAt: null }, headcount: null,
    restrictedOverrides: {}, features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])),
    meals: {}, nap: { active: false, startedAt: null }, busStop: 0, distance: {}, attendanceConfirmed: {},
  };
}

// ── Reducer ─────────────────────────────────────────────────────

export function reduce(prev: SafetyState, action: Action): SafetyState {
  const s: SafetyState = structuredClone(prev);
  s.version += 1;

  switch (action.type) {
    case "device": {
      const ev = { ...action.event, at: s.now } as DeviceEvent;
      if (!s.gatewayOnline && !isGatewayLocal(ev)) {
        s.buffer.push(ev);   // gateway internetsiz — hodisa mahalliy buferda
        return s;
      }
      applyDeviceEvent(s, ev);
      return s;
    }
    case "gateway": {
      s.gatewayOnline = action.online;
      s.devices["demo-GW-01"].status = action.online ? "online" : "offline";
      log(s, "system", action.online ? "gateway_online" : "gateway_offline", { count: s.buffer.length });
      if (action.online && s.buffer.length) {
        const pending = [...s.buffer].sort((a, b) => a.at - b.at);
        s.buffer = [];
        pending.forEach((ev) => applyDeviceEvent(s, ev));
        log(s, "system", "buffer_synced", { count: pending.length });
      }
      return s;
    }
    case "tick": {
      s.now += action.ms;
      // Davriy signal (heartbeat): ishlayotgan bilaguzuk joyida turgan bolaning joylashuvini tasdiqlab turadi.
      // Aloqa uzilgan, yechilgan qurilma yoki internetsiz gateway — signal yo'q, joylashuv eskiradi.
      if (s.gatewayOnline) {
        CHILDREN.forEach((c) => {
          const st = s.children[c.id];
          const d = s.devices[c.deviceId];
          if (st.updatedAt && !st.departedAt && d?.status === "online" && d.childId === c.id) { st.updatedAt = s.now; d.lastSeen = s.now; }
        });
      }
      s.incidents.forEach((i) => {
        if (i.status === "open" && !i.escalatedAt && s.now - i.openedAt >= ESCALATION_MS) {
          i.escalatedAt = s.now;
          log(s, "system", "escalated", { incident: i.id, type: i.type });
        }
      });
      return s;
    }
    case "ack": {
      const i = s.incidents.find((x) => x.id === action.incidentId);
      if (!i || i.status !== "open") return prev;      // faqat ochiq insident qabul qilinadi
      i.status = "acknowledged"; i.ackAt = s.now; i.ackBy = action.by;
      log(s, action.by, "acknowledged", { incident: i.id, type: i.type });
      return s;
    }
    case "resolve": {
      const i = s.incidents.find((x) => x.id === action.incidentId);
      if (!i || i.status !== "acknowledged" || action.note.trim().length < 3) return prev;   // avval qabul qilish shart
      i.status = "resolved"; i.resolvedAt = s.now; i.resolvedBy = action.by; i.note = action.note.trim();
      log(s, action.by, "resolved", { incident: i.id, type: i.type });
      return s;
    }
    case "pickup": {
      const child = CHILDREN.find((c) => c.id === action.childId);
      const st = s.children[action.childId];
      if (!child || !st || !st.arrivedAt || st.departedAt) return prev;
      const ok = child.pickup.includes(action.personId);
      s.pickups.push({ at: s.now, childId: child.id, personId: action.personId, ok });
      log(s, action.by, ok ? "pickup_ok" : "pickup_denied", { child: child.id, person: action.personId });
      if (ok) {
        st.departedAt = s.now; st.pickedUpBy = action.personId;
        const [x, y] = zoneCenter("z-entrance");
        st.x = x; st.y = y; st.zoneId = "z-entrance"; st.updatedAt = s.now;
        notice(s, child.id, "departure", { person: action.personId });
      }
      return s;
    }
    case "evacuation": {
      s.evacuation = action.active ? { active: true, startedAt: s.now, endedAt: null } : { ...s.evacuation, active: false, endedAt: s.now };
      log(s, action.by, action.active ? "evacuation_started" : "evacuation_ended", {});
      if (!action.active) s.headcount = null;
      return s;
    }
    case "headcount": {
      const expected = presentChildren(s).map((c) => c.id);
      // Evakuatsiyada — faqat yig'ilish nuqtasidagilar; oddiy sanashda — qurilmasi jonli aniqlanganlar
      const accounted = expected.filter((id) => !isStale(s, id) && (!s.evacuation.active || s.children[id].zoneId === "z-assembly"));
      const missing = expected.filter((id) => !accounted.includes(id));
      s.headcount = { at: s.now, expected, accounted, missing, verified: [] };
      log(s, action.by, "headcount", { expected: expected.length, accounted: accounted.length, missing: missing.length });
      missing.forEach((id) => openIncident(s, "missing", id, deviceOf(id), s.children[id].zoneId));
      // Topilgan bolalarning ochiq «missing» insidenti avtomatik yopilmaydi — xodim tasdiqlaydi
      return s;
    }
    case "assign": {
      const d = s.devices[action.deviceId];
      if (!d || d.kind !== "wristband") return prev;
      Object.values(s.devices).forEach((x) => { if (action.childId && x.childId === action.childId) x.childId = null; });
      d.childId = action.childId;
      log(s, action.by, action.childId ? "assigned" : "unassigned", { device: d.id, child: action.childId ?? "" });
      return s;
    }
    case "zone_restricted": {
      s.restrictedOverrides[action.zoneId] = action.restricted;
      log(s, action.by, "zone_changed", { zone: action.zoneId, restricted: action.restricted ? 1 : 0 });
      return s;
    }
    case "feature": {
      s.features[action.key] = action.enabled;
      log(s, action.by, "feature", { key: action.key, enabled: action.enabled ? 1 : 0 });
      return s;
    }
    case "meal": {
      if (!s.children[action.childId]?.arrivedAt) return prev;
      s.meals[action.childId] = s.now;
      log(s, action.by, "meal", { child: action.childId });
      return s;
    }
    case "nap": {
      s.nap = { active: action.active, startedAt: action.active ? s.now : s.nap.startedAt };
      log(s, action.by, action.active ? "nap_started" : "nap_ended", {});
      return s;
    }
    case "confirm_attendance": {
      const st = s.children[action.childId];
      if (!st?.arrivedAt || s.attendanceConfirmed[action.childId]) return prev;
      s.attendanceConfirmed[action.childId] = s.now;
      log(s, action.by, "attendance_confirmed", { child: action.childId });
      return s;
    }
    case "verify_child": {
      // Faqat «tekshirish kerak» ro'yxatidagi bola; insident avtomatik yopilmaydi (alohida yechiladi)
      if (!s.headcount || !s.headcount.missing.includes(action.childId) || s.headcount.verified.includes(action.childId)) return prev;
      if (action.note.trim().length < 3) return prev;
      s.headcount.verified.push(action.childId);
      log(s, action.by, "child_verified", { child: action.childId });
      // Xodimning shaxsan tasdiqlashi — aniq tekshiruv bosqichi: «tekshirish kerak» hodisasi izoh bilan yopiladi
      s.incidents.forEach((i) => {
        if (i.type === "missing" && i.childId === action.childId && i.status !== "resolved") {
          if (!i.ackAt) { i.ackAt = s.now; i.ackBy = action.by; }
          i.status = "resolved"; i.resolvedAt = s.now; i.resolvedBy = action.by; i.note = action.note.trim();
          log(s, action.by, "resolved", { incident: i.id, type: i.type });
        }
      });
      return s;
    }
    case "bus": {
      s.busStop = (s.busStop + 1) % 4;
      s.devices["demo-BUS-1"].lastSeen = s.now;
      log(s, action.by, "bus_stop", { stop: s.busStop });
      return s;
    }
  }
}

function isGatewayLocal(ev: DeviceEvent): boolean {
  return ev.kind === "online" && ev.deviceId === "demo-GW-01";
}

function eventKey(ev: DeviceEvent): string {
  const subject = "childId" in ev ? ev.childId : ev.deviceId;
  return `${ev.kind}|${subject}|${ev.at}`;
}

function applyDeviceEvent(s: SafetyState, ev: DeviceEvent) {
  const key = eventKey(ev);
  if (s.processedKeys.includes(key)) {           // deduplikatsiya: qayta yuborilgan hodisa e'tiborsiz
    log(s, "system", "duplicate", { key });
    return;
  }
  s.processedKeys = [...s.processedKeys.slice(-300), key];

  switch (ev.kind) {
    case "move": {
      const st = s.children[ev.childId];
      const dev = deviceOf(ev.childId);
      if (!st || !dev || s.devices[dev].status === "removed") return;
      if (st.x !== null && st.y !== null) s.distance[ev.childId] = (s.distance[ev.childId] ?? 0) + Math.hypot(ev.x - st.x, ev.y - st.y);
      const prevZone = st.zoneId;
      const zone = zoneAt(ev.x, ev.y);
      st.x = ev.x; st.y = ev.y; st.zoneId = zone?.id ?? null; st.updatedAt = ev.at;
      s.devices[dev].lastSeen = ev.at;
      if (s.devices[dev].status === "offline") s.devices[dev].status = "online";
      // Smart Attendance: kundagi birinchi kirish — bir marta (keyingi kirishlar takrorlanmaydi)
      if (zone?.kind === "entrance" && !st.arrivedAt && !st.departedAt) {
        st.arrivedAt = ev.at;
        log(s, "device", "arrival", { child: ev.childId });
        notice(s, ev.childId, "arrival", {});
      }
      if (zone && isRestricted(s, zone.id) && prevZone !== zone.id) {
        openIncident(s, "restricted_zone", ev.childId, dev, zone.id);
      } else if (prevZone && isRestricted(s, prevZone) && (!zone || !isRestricted(s, zone.id))) {
        log(s, "device", "returned_safe", { child: ev.childId, zone: zone?.id ?? "" });
      }
      return;
    }
    case "sos": {
      openIncident(s, "sos", ev.childId, deviceOf(ev.childId), s.children[ev.childId]?.zoneId ?? null);
      return;
    }
    case "battery": {
      const d = s.devices[ev.deviceId];
      if (!d) return;
      d.battery = Math.max(0, Math.min(100, ev.level)); d.lastSeen = ev.at;
      if (d.battery <= BATTERY_LOW) openIncident(s, "battery_low", d.childId, d.id, d.childId ? s.children[d.childId].zoneId : null);
      return;
    }
    case "offline":
    case "online":
    case "removed": {
      const d = s.devices[ev.deviceId];
      if (!d) return;
      d.status = ev.kind === "online" ? "online" : ev.kind;
      if (ev.kind !== "offline") d.lastSeen = ev.at;
      if (ev.kind === "offline") openIncident(s, "device_offline", d.childId, d.id, d.childId ? s.children[d.childId].zoneId : null);
      if (ev.kind === "removed") openIncident(s, "device_removed", d.childId, d.id, d.childId ? s.children[d.childId].zoneId : null);
      return;
    }
  }
}

function openIncident(s: SafetyState, type: IncidentType, childId: string | null, deviceId: string | null, zoneId: string | null) {
  // Bir bola/qurilmada bir xil turdagi yechilmagan insident takrorlanmaydi
  if (s.incidents.some((i) => i.type === type && i.status !== "resolved" && i.childId === childId && i.deviceId === deviceId)) return;
  const id = `INC-${String(s.seq++).padStart(4, "0")}`;
  s.incidents.unshift({ id, type, severity: SEVERITY[type], status: "open", childId, deviceId, zoneId, openedAt: s.now, escalatedAt: null, ackAt: null, ackBy: null, resolvedAt: null, resolvedBy: null, note: null });
  log(s, "device", "incident", { incident: id, type });
  if (childId) notice(s, childId, type === "battery_low" || type === "device_offline" ? "device" : "safety", { type });
}

function log(s: SafetyState, actor: Actor, code: string, params: Record<string, string | number>) {
  s.log.unshift({ id: s.seq++, at: s.now, actor, code, params });
  if (s.log.length > 400) s.log.length = 400;
}

function notice(s: SafetyState, childId: string, code: Notice["code"], params: Record<string, string | number>) {
  s.notices.unshift({ id: s.seq++, at: s.now, childId, code, params });
}

// ── Selektorlar ─────────────────────────────────────────────────

export function deviceOf(childId: string): string | null {
  return CHILDREN.find((c) => c.id === childId)?.deviceId ?? null;
}

export function isRestricted(s: SafetyState, zoneId: string): boolean {
  return s.restrictedOverrides[zoneId] ?? ZONES.find((z) => z.id === zoneId)?.restricted ?? false;
}

/** Joylashuv eskirgan: qurilma oflayn/olib tashlangan yoki so'nggi yangilanish 2 daqiqadan eski. */
export function isStale(s: SafetyState, childId: string): boolean {
  const st = s.children[childId];
  const dev = deviceOf(childId);
  if (!st?.updatedAt || !dev) return true;
  const d = s.devices[dev];
  return d.status !== "online" || s.now - st.updatedAt > STALE_MS || (!s.gatewayOnline && s.buffer.length > 0);
}

export function presentChildren(s: SafetyState) {
  return CHILDREN.filter((c) => s.children[c.id].arrivedAt && !s.children[c.id].departedAt);
}

export function openIncidents(s: SafetyState) {
  return s.incidents.filter((i) => i.status !== "resolved");
}

/** Ovozli signal kerak: qabul qilinmagan kritik/yuqori insident bor. */
export function needsAlarm(s: SafetyState, childIds?: string[]): boolean {
  return s.incidents.some((i) => i.status === "open" && i.severity !== "warning" && (!childIds || (i.childId !== null && childIds.includes(i.childId))));
}

export function groupChildren(groupId: string) {
  return CHILDREN.filter((c) => c.groupId === groupId);
}

export function kpis(s: SafetyState) {
  const wb = Object.values(s.devices).filter((d) => d.kind === "wristband");
  return {
    present: presentChildren(s).length,
    total: CHILDREN.length,
    online: Object.values(s.devices).filter((d) => d.status === "online").length,
    devices: Object.keys(s.devices).length,
    lowBattery: wb.filter((d) => d.battery <= BATTERY_LOW).length,
    open: openIncidents(s).length,
    critical: openIncidents(s).filter((i) => i.severity === "critical").length,
  };
}

/** Super Admin: faqat agregatsiyalangan sonlar (bolalar haqida shaxsiy ma'lumotsiz). Demo bog'cha jonli holatdan. */
export function globalStats(s: SafetyState) {
  const k = kpis(s);
  return DEMO_ORGS.map((o) => o.id === "demo-org-1"
    ? { ...o, devices: k.devices, online: k.online, openIncidents: k.open, lowBattery: k.lowBattery }
    : { ...o, openIncidents: o.id === "demo-org-3" ? 1 : 0, lowBattery: o.id === "demo-org-3" ? 2 : 0 });
}

export function incidentCounts(s: SafetyState): Record<IncidentType, number> {
  const out = { restricted_zone: 0, sos: 0, battery_low: 0, device_offline: 0, device_removed: 0, missing: 0 } as Record<IncidentType, number>;
  s.incidents.forEach((i) => { out[i.type] += 1; });
  return out;
}

export function zoneOccupancy(s: SafetyState): Record<string, number> {
  const out: Record<string, number> = {};
  presentChildren(s).forEach((c) => { const z = s.children[c.id].zoneId; if (z) out[z] = (out[z] ?? 0) + 1; });
  return out;
}

export function groupOf(childId: string) {
  return GROUPS.find((g) => g.id === CHILDREN.find((c) => c.id === childId)?.groupId);
}

// ── Ssenariylar ─────────────────────────────────────────────────

type Step = Action[];
const at = (zone: string, dx = 0, dy = 0): [number, number] => { const [x, y] = zoneCenter(zone); return [x + dx, y + dy]; };
const move = (childId: string, [x, y]: [number, number]): Action => ({ type: "device", event: { kind: "move", childId, x, y } });
const T = (ms = 20_000): Action => ({ type: "tick", ms });
const G1 = CHILDREN.filter((c) => c.groupId === "demo-g-1");
const G2 = CHILDREN.filter((c) => c.groupId === "demo-g-2");
const spread = (i: number): [number, number] => [((i % 3) - 1) * 4, (Math.floor(i / 3) - 0.5) * 4];

/** 17 ta taqdimot ssenariysi (har biri — qadamlar ketma-ketligi; har qadam simulyatsiya vaqtini ilgari suradi). */
export const SCENARIOS: { id: number; key: string; steps: Step[] }[] = [
  { id: 1, key: "enter", steps: CHILDREN.map((c, i) => [T(15_000), move(c.id, at("z-entrance", ((i % 4) - 1.5) * 2, -2))]) },
  { id: 2, key: "classroom", steps: [[T(), ...G1.map((c, i) => move(c.id, at("z-class-a", ...spread(i))))], [...G2.map((c, i) => move(c.id, at("z-class-b", ...spread(i))))]] },
  { id: 3, key: "playground", steps: [[T(60_000), ...G1.map((c, i) => move(c.id, at("z-playground", spread(i)[0] * 2, spread(i)[1] * 1.5 - 5)))], [T(), ...G2.map((c, i) => move(c.id, at("z-hall", ...spread(i))))]] },
  { id: 4, key: "restricted", steps: [[T(), move("demo-c-2", at("z-corridor", 20, 0))], [T(10_000), move("demo-c-2", at("z-kitchen", -2, 4))]] },
  { id: 5, key: "alarm", steps: [[T(45_000)], [T(50_000)]] },
  { id: 6, key: "acknowledge", steps: [[T(10_000), { type: "ack", incidentId: "@restricted_zone", by: "teacher" }]] },
  { id: 7, key: "return_safe", steps: [[T(), move("demo-c-2", at("z-corridor", 10, 0))], [T(10_000), move("demo-c-2", at("z-playground", 6, -4))]] },
  { id: 8, key: "resolve", steps: [[T(10_000), { type: "resolve", incidentId: "@restricted_zone", by: "teacher", note: "@note" }]] },
  { id: 9, key: "sos", steps: [[T(), { type: "device", event: { kind: "sos", childId: "demo-c-3" } }]] },
  { id: 10, key: "battery_low", steps: [[T(), { type: "device", event: { kind: "battery", deviceId: "demo-WB-104", level: 12 } }]] },
  { id: 11, key: "offline", steps: [[T(), { type: "device", event: { kind: "offline", deviceId: "demo-WB-105" } }], [T(130_000)]] },
  { id: 12, key: "removed", steps: [[T(), { type: "device", event: { kind: "removed", deviceId: "demo-WB-106" } }]] },
  { id: 13, key: "pickup", steps: [[T(), { type: "pickup", childId: "demo-c-1", personId: "demo-p-9", by: "teacher" }], [T(), { type: "pickup", childId: "demo-c-1", personId: "demo-p-1", by: "teacher" }]] },
  {
    id: 14, key: "evacuation", steps: [
      [T(), { type: "evacuation", active: true, by: "director" }],
      [T(), ...CHILDREN.filter((c) => !["demo-c-1", "demo-c-5", "demo-c-8"].includes(c.id)).map((c, i) => move(c.id, at("z-corridor", -30 + i * 2, 0)))],
      [T(), ...CHILDREN.filter((c) => !["demo-c-1", "demo-c-5", "demo-c-8"].includes(c.id)).map((c, i) => move(c.id, at("z-assembly", ((i % 4) - 1.5) * 2.5, (Math.floor(i / 4) - 0.5) * 3)))],
    ],
  },
  { id: 15, key: "headcount", steps: [[T(), { type: "headcount", by: "teacher" }]] },
  { id: 16, key: "gateway_offline", steps: [[T(), { type: "gateway", online: false }], [T(), move("demo-c-8", at("z-corridor", -10, 0))], [T(), move("demo-c-8", at("z-assembly", 5, 3))]] },
  { id: 17, key: "gateway_restored", steps: [[T(), { type: "gateway", online: true }], [T(), { type: "headcount", by: "teacher" }]] },
];

/** Ssenariydagi «@...» belgilarini joriy holatga bog'laydi (masalan, oxirgi ochiq insident ID). */
export function resolveAction(s: SafetyState, a: Action, note: string): Action {
  if ((a.type === "ack" || a.type === "resolve") && a.incidentId.startsWith("@")) {
    const type = a.incidentId.slice(1);
    const target = s.incidents.find((i) => i.type === type && i.status !== "resolved");
    const id = target?.id ?? "";
    return a.type === "resolve" ? { ...a, incidentId: id, note } : { ...a, incidentId: id };
  }
  return a;
}

export function runSteps(s: SafetyState, steps: Step[], note: string): SafetyState {
  return steps.reduce((acc, step) => step.reduce((st, a) => reduce(st, resolveAction(st, a, note)), acc), s);
}

/** Ssenariyni boshlash nuqtasi: toza holatdan oldingi barcha ssenariylar darhol qo'llanadi (izchil holat). */
export function stateBefore(scenarioId: number, note: string, now = demoStartTime()): SafetyState {
  return SCENARIOS.filter((x) => x.id < scenarioId).reduce((st, sc) => runSteps(st, sc.steps, note), initialState(now));
}

export { GROUPS, CHILDREN, STAFF };
