import { describe, it, expect } from "vitest";
import {
  SCENARIOS, initialState, reduce, runSteps, stateBefore, isStale, presentChildren, needsAlarm, kpis, globalStats, demoStartTime,
  type SafetyState,
} from "@/lib/smart-safety/engine";
import { CHILDREN } from "@/lib/smart-safety/model";

const NOTE = "Bola xavfsiz";
const T0 = demoStartTime(new Date(2026, 10, 19));
const after = (id: number) => stateBefore(id + 1, NOTE, T0);
const inc = (s: SafetyState, type: string) => s.incidents.find((i) => i.type === type);

describe("Smart Safety simulyatori — 17 ssenariy", () => {
  it("17 ta ssenariy mavjud va hammasi xatosiz o'tadi", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(() => after(17)).not.toThrow();
  });

  it("1. Kirish: har bir bola bir marta keladi (Smart Attendance), ota-onaga demo bildirishnoma", () => {
    const s = after(1);
    expect(presentChildren(s)).toHaveLength(CHILDREN.length);
    expect(s.log.filter((l) => l.code === "arrival")).toHaveLength(CHILDREN.length);
    expect(s.notices.filter((n) => n.code === "arrival" && n.childId === "demo-c-1")).toHaveLength(1);
    // Qayta kirish takroriy davomat yaratmaydi
    const again = reduce(reduce(s, { type: "tick", ms: 1000 }), { type: "device", event: { kind: "move", childId: "demo-c-1", x: 50, y: 50 } });
    expect(again.log.filter((l) => l.code === "arrival")).toHaveLength(CHILDREN.length);
  });

  it("2–3. Sinfxona va o'yin maydoni zonalari aniqlanadi", () => {
    expect(after(2).children["demo-c-1"].zoneId).toBe("z-class-a");
    expect(after(2).children["demo-c-7"].zoneId).toBe("z-class-b");
    expect(after(3).children["demo-c-1"].zoneId).toBe("z-playground");
    // O'yin maydonidagi bolalar yig'ilish nuqtasiga tasodifan tushmaydi
    ["demo-c-1", "demo-c-2", "demo-c-3", "demo-c-4", "demo-c-5", "demo-c-6"].forEach((id) => expect(after(3).children[id].zoneId).toBe("z-playground"));
  });

  it("4–5. Cheklangan zona → kritik insident, signal, qabul qilinmasa eskalatsiya", () => {
    const s4 = after(4);
    const i = inc(s4, "restricted_zone")!;
    expect(i).toMatchObject({ severity: "critical", status: "open", childId: "demo-c-2", zoneId: "z-kitchen" });
    expect(needsAlarm(s4)).toBe(true);
    expect(needsAlarm(s4, ["demo-c-7"])).toBe(false);   // boshqa guruh tarbiyachisi uchun signal yo'q
    expect(inc(after(5), "restricted_zone")!.escalatedAt).not.toBeNull();
  });

  it("6–8. Qabul qilish insidentni YOPMAYDI; xavfsiz zonaga qaytish; keyin yechish", () => {
    const s6 = after(6);
    expect(inc(s6, "restricted_zone")).toMatchObject({ status: "acknowledged", ackBy: "teacher", resolvedAt: null });
    expect(needsAlarm(s6)).toBe(false);
    const s7 = after(7);
    expect(s7.children["demo-c-2"].zoneId).toBe("z-playground");
    expect(inc(s7, "restricted_zone")!.status).toBe("acknowledged");
    expect(s7.log.some((l) => l.code === "returned_safe")).toBe(true);
    expect(inc(after(8), "restricted_zone")).toMatchObject({ status: "resolved", note: NOTE, resolvedBy: "teacher" });
  });

  it("resolve qabul qilinmagan yoki izohsiz bo'lsa rad etiladi", () => {
    const s4 = after(4);
    const id = inc(s4, "restricted_zone")!.id;
    expect(reduce(s4, { type: "resolve", incidentId: id, by: "teacher", note: NOTE })).toBe(s4);
    const acked = reduce(s4, { type: "ack", incidentId: id, by: "teacher" });
    expect(reduce(acked, { type: "resolve", incidentId: id, by: "teacher", note: " " })).toBe(acked);
    expect(reduce(acked, { type: "ack", incidentId: id, by: "teacher" })).toBe(acked);
  });

  it("9–12. SOS, past batareya, oflayn (eskirgan lokatsiya), bilaguzuk olib tashlandi", () => {
    expect(inc(after(9), "sos")).toMatchObject({ severity: "critical", childId: "demo-c-3" });
    expect(inc(after(10), "battery_low")).toMatchObject({ severity: "warning", deviceId: "demo-WB-104" });
    expect(after(10).devices["demo-WB-104"].battery).toBe(12);
    const s11 = after(11);
    expect(inc(s11, "device_offline")!.childId).toBe("demo-c-5");
    expect(isStale(s11, "demo-c-5")).toBe(true);
    expect(isStale(s11, "demo-c-4")).toBe(true);    // 2 daqiqadan eski joylashuv ham eskirgan deb belgilanadi
    expect(inc(after(12), "device_removed")).toMatchObject({ severity: "high", childId: "demo-c-6" });
  });

  it("13. Ruxsatsiz shaxs rad etiladi, ruxsat etilgan ota-ona olib ketadi", () => {
    const s = after(13);
    expect(s.pickups.map((p) => [p.personId, p.ok])).toEqual([["demo-p-9", false], ["demo-p-1", true]]);
    expect(s.children["demo-c-1"]).toMatchObject({ pickedUpBy: "demo-p-1" });
    expect(s.children["demo-c-1"].departedAt).not.toBeNull();
    expect(s.notices.some((n) => n.childId === "demo-c-1" && n.code === "departure")).toBe(true);
  });

  it("14–15. Evakuatsiya va avtomatik headcount yetishmayotganlarni aniqlaydi", () => {
    expect(after(14).evacuation.active).toBe(true);
    const hc = after(15).headcount!;
    expect(hc.expected).not.toContain("demo-c-1");                      // olib ketilgan bola hisobga olinmaydi
    expect(hc.missing.sort()).toEqual(["demo-c-5", "demo-c-6", "demo-c-8"]);
    expect(after(15).incidents.filter((i) => i.type === "missing")).toHaveLength(3);
  });

  it("16–17. Gateway uzildi: hodisalar buferlanadi; tiklanganda vaqt tartibida sinxronlanadi", () => {
    const s16 = after(16);
    expect(s16.gatewayOnline).toBe(false);
    expect(s16.buffer).toHaveLength(2);
    expect(s16.children["demo-c-8"].zoneId).toBe("z-hall");             // dashboard hali eski holatni ko'radi
    const s17 = after(17);
    expect(s17.buffer).toHaveLength(0);
    expect(s17.children["demo-c-8"].zoneId).toBe("z-assembly");
    expect(s17.headcount!.missing.sort()).toEqual(["demo-c-5", "demo-c-6"]);
    expect(s17.log.some((l) => l.code === "buffer_synced" && l.params.count === 2)).toBe(true);
    // Topilgan bolaning «missing» insidenti avtomatik yopilmaydi
    expect(s17.incidents.find((i) => i.type === "missing" && i.childId === "demo-c-8")!.status).toBe("open");
  });

  it("deduplikatsiya: bir xil hodisa ikki marta qo'llanmaydi", () => {
    const s = after(16);
    const dup = { ...s, buffer: [...s.buffer, s.buffer[0]] };
    const restored = reduce(dup, { type: "gateway", online: true });
    expect(restored.log.some((l) => l.code === "duplicate")).toBe(true);
  });

  it("sintetik ma'lumot: barcha identifikatorlar demo-, Super Admin statistikasida bola ismlari yo'q", () => {
    const s = after(17);
    Object.keys(s.children).forEach((id) => expect(id.startsWith("demo-")).toBe(true));
    Object.keys(s.devices).forEach((id) => expect(id.startsWith("demo-")).toBe(true));
    const stats = JSON.stringify(globalStats(s));
    CHILDREN.forEach((c) => expect(stats).not.toContain(c.name));
    expect(kpis(s).total).toBe(CHILDREN.length);
  });

  it("biriktirish: bitta bolada bitta faol bilaguzuk, gatewayga biriktirib bo'lmaydi", () => {
    const s = initialState(T0);
    const a = reduce(s, { type: "assign", deviceId: "demo-WB-102", childId: "demo-c-1", by: "director" });
    expect(a.devices["demo-WB-102"].childId).toBe("demo-c-1");
    expect(a.devices["demo-WB-101"].childId).toBeNull();
    expect(reduce(s, { type: "assign", deviceId: "demo-GW-01", childId: "demo-c-1", by: "director" })).toBe(s);
  });

  it("geofence: rahbar zonani cheklangan qilsa, kirish insident ochadi", () => {
    let s = after(3);
    s = reduce(s, { type: "zone_restricted", zoneId: "z-hall", restricted: true, by: "director" });
    s = reduce(s, { type: "device", event: { kind: "move", childId: "demo-c-3", x: 70, y: 40 } });
    expect(s.incidents[0]).toMatchObject({ type: "restricted_zone", zoneId: "z-hall", childId: "demo-c-3" });
  });

  it("runSteps toza va deterministik", () => {
    const a = runSteps(initialState(T0), SCENARIOS[0].steps, NOTE);
    const b = runSteps(initialState(T0), SCENARIOS[0].steps, NOTE);
    expect(a).toEqual(b);
  });
});
