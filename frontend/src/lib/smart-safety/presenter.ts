/**
 * Taqdimotchi rejimi: boshqaruv paneli (Start/Pause/Reset, ssenariylar, rollarni almashtirish, boshqariladigan taqdimot)
 * FAQAT /smart-safety taqdimot marshrutlarida ko'rinadi. Panel (ish rejimi) sahifalarida hech qachon ko'rsatilmaydi.
 */
import { SCENARIOS, initialState, reduce, resolveAction, runSteps, type Action, type SafetyState } from "./engine";
import type { Role } from "./model";

/** Boshqariladigan taqdimot: 9 qadam, har biri qaysi rol/bo'limda ko'rsatilishi bilan. */
export interface GuidedStep { key: string; role: Role; section: string; scenarios?: number[]; actions?: Action[]; query?: string; }

export const GUIDED: GuidedStep[] = [
  { key: "arrive", role: "director", section: "", scenarios: [1] },
  { key: "attendance", role: "teacher", section: "davomat" },
  { key: "parent", role: "parent", section: "" },
  { key: "move", role: "director", section: "xarita", scenarios: [2, 3] },
  { key: "restricted", role: "teacher", section: "", scenarios: [4] },
  { key: "alarm", role: "teacher", section: "", scenarios: [5] },
  { key: "locate", role: "teacher", section: "xarita", query: "?bola=demo-c-2" },
  // Qabul qilingan holatda ochiladi — taqdimotchi tekshiruvni (belgi + izoh) jonli ko'rsatadi
  { key: "resolve", role: "teacher", section: "ogohlantirishlar", scenarios: [6, 7] },
  { key: "handover", role: "teacher", section: "topshirish", scenarios: [8], actions: [{ type: "pickup", childId: "demo-c-1", personId: "demo-p-1", by: "teacher" }] },
];

/** k-qadamgacha bo'lgan holat — har doim toza holatdan deterministik quriladi (oldinga/orqaga xavfsiz). */
export function guidedState(k: number, note: string): SafetyState {
  let s = initialState();
  GUIDED.slice(0, k + 1).forEach((g) => {
    (g.scenarios ?? []).forEach((id) => { s = runSteps(s, SCENARIOS.find((x) => x.id === id)!.steps, note); });
    (g.actions ?? []).forEach((a) => { s = reduce(s, resolveAction(s, a, note)); });
  });
  return s;
}
