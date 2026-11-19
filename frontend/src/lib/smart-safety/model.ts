/**
 * KIDDO Smart Safety — SINTETIK taqdimot ma'lumotlari. Haqiqiy bola, xodim yoki bog'cha yozuvlari bilan bog'liq emas;
 * barcha identifikatorlar «demo-» prefiksi bilan. Koordinatalar — bog'cha rejasi (100 × 60 m).
 */
export type ZoneKind = "classroom" | "playground" | "entrance" | "exit" | "kitchen" | "technical" | "corridor" | "hall" | "assembly";
export type Role = "super_admin" | "director" | "teacher" | "parent";

export interface Zone { id: string; kind: ZoneKind; restricted: boolean; rect: [number, number, number, number]; }
export interface Anchor { id: string; x: number; y: number; }
export interface DemoGroup { id: string; name: string; ages: string; teacherId: string; }
export interface DemoChild { id: string; name: string; groupId: string; deviceId: string; pickup: string[]; }
export interface DemoPerson { id: string; name: string; relation: "mother" | "father" | "grandmother" | "grandfather"; }
export interface DemoStaff { id: string; name: string; role: "teacher" | "director" | "nurse" | "cook"; badgeId: string; }

export const DEMO_ORG = { id: "demo-org-1", name: "KIDDO Demo bog'chasi" };

/** Super Admin global ko'rinishi uchun sintetik tashkilotlar (faqat agregatsiyalangan sonlar). */
export const DEMO_ORGS = [
  { id: "demo-org-1", name: "KIDDO Demo bog'chasi", region: "Toshkent", devices: 24, online: 23, gateways: 2, firmware: "1.4.2" },
  { id: "demo-org-2", name: "Namuna bog'cha №2", region: "Samarqand", devices: 18, online: 18, gateways: 1, firmware: "1.4.2" },
  { id: "demo-org-3", name: "Namuna bog'cha №3", region: "Buxoro", devices: 12, online: 10, gateways: 1, firmware: "1.3.9" },
  { id: "demo-org-4", name: "Namuna bog'cha №4", region: "Farg'ona", devices: 0, online: 0, gateways: 0, firmware: "—" },
];

export const PLAN = { width: 100, height: 60 };

export const ZONES: Zone[] = [
  { id: "z-class-a", kind: "classroom", restricted: false, rect: [0, 0, 30, 24] },
  { id: "z-class-b", kind: "classroom", restricted: false, rect: [32, 0, 26, 24] },
  { id: "z-kitchen", kind: "kitchen", restricted: true, rect: [60, 0, 18, 24] },
  { id: "z-tech", kind: "technical", restricted: true, rect: [80, 0, 20, 24] },
  { id: "z-corridor", kind: "corridor", restricted: false, rect: [0, 25, 100, 8] },
  { id: "z-playground", kind: "playground", restricted: false, rect: [0, 34, 42, 26] },
  { id: "z-hall", kind: "hall", restricted: false, rect: [58, 34, 42, 26] },
  { id: "z-entrance", kind: "entrance", restricted: false, rect: [44, 46, 12, 14] },
  { id: "z-exit", kind: "exit", restricted: false, rect: [90, 25, 10, 8] },
  { id: "z-assembly", kind: "assembly", restricted: false, rect: [2, 50, 14, 9] },
];

export const ANCHORS: Anchor[] = [
  { id: "demo-AN-01", x: 15, y: 12 }, { id: "demo-AN-02", x: 45, y: 12 }, { id: "demo-AN-03", x: 69, y: 12 },
  { id: "demo-AN-04", x: 90, y: 12 }, { id: "demo-AN-05", x: 25, y: 29 }, { id: "demo-AN-06", x: 75, y: 29 },
  { id: "demo-AN-07", x: 20, y: 47 }, { id: "demo-AN-08", x: 79, y: 47 }, { id: "demo-AN-09", x: 50, y: 53 },
];

export const GROUPS: DemoGroup[] = [
  { id: "demo-g-1", name: "Quyoshcha", ages: "4–5", teacherId: "demo-st-1" },
  { id: "demo-g-2", name: "Kamalak", ages: "5–6", teacherId: "demo-st-2" },
];

export const PICKUP_PERSONS: DemoPerson[] = [
  { id: "demo-p-1", name: "Dilnoza A. (demo)", relation: "mother" },
  { id: "demo-p-2", name: "Rustam A. (demo)", relation: "father" },
  { id: "demo-p-3", name: "Saodat K. (demo)", relation: "grandmother" },
  { id: "demo-p-4", name: "Bahodir T. (demo)", relation: "father" },
  { id: "demo-p-9", name: "Noma'lum shaxs (demo)", relation: "father" },
];

export const CHILDREN: DemoChild[] = [
  { id: "demo-c-1", name: "Malika A.", groupId: "demo-g-1", deviceId: "demo-WB-101", pickup: ["demo-p-1", "demo-p-2"] },
  { id: "demo-c-2", name: "Jasur B.", groupId: "demo-g-1", deviceId: "demo-WB-102", pickup: ["demo-p-3"] },
  { id: "demo-c-3", name: "Sevinch D.", groupId: "demo-g-1", deviceId: "demo-WB-103", pickup: ["demo-p-4"] },
  { id: "demo-c-4", name: "Asadbek E.", groupId: "demo-g-1", deviceId: "demo-WB-104", pickup: ["demo-p-4"] },
  { id: "demo-c-5", name: "Zarina F.", groupId: "demo-g-1", deviceId: "demo-WB-105", pickup: ["demo-p-3"] },
  { id: "demo-c-6", name: "Temur G.", groupId: "demo-g-1", deviceId: "demo-WB-106", pickup: ["demo-p-1"] },
  { id: "demo-c-7", name: "Oysha H.", groupId: "demo-g-2", deviceId: "demo-WB-201", pickup: ["demo-p-2"] },
  { id: "demo-c-8", name: "Bobur I.", groupId: "demo-g-2", deviceId: "demo-WB-202", pickup: ["demo-p-4"] },
  { id: "demo-c-9", name: "Madina J.", groupId: "demo-g-2", deviceId: "demo-WB-203", pickup: ["demo-p-3"] },
  { id: "demo-c-10", name: "Sardor K.", groupId: "demo-g-2", deviceId: "demo-WB-204", pickup: ["demo-p-1"] },
];

export const STAFF: DemoStaff[] = [
  { id: "demo-st-1", name: "Nodira X. (demo)", role: "teacher", badgeId: "demo-SB-01" },
  { id: "demo-st-2", name: "Gulnora Y. (demo)", role: "teacher", badgeId: "demo-SB-02" },
  { id: "demo-st-3", name: "Kamola Z. (demo)", role: "director", badgeId: "demo-SB-03" },
  { id: "demo-st-4", name: "Hamshira (demo)", role: "nurse", badgeId: "demo-SB-04" },
];

/** Taqdimotdagi tarbiyachi va ota-ona (rollar bo'yicha ko'rinishni cheklash uchun). */
export const DEMO_TEACHER_ID = "demo-st-1";
export const DEMO_PARENT_CHILD_ID = "demo-c-1";

export const CAMERAS = [
  { id: "demo-CAM-1", zone: "z-playground" }, { id: "demo-CAM-2", zone: "z-corridor" },
  { id: "demo-CAM-3", zone: "z-entrance" }, { id: "demo-CAM-4", zone: "z-kitchen" },
];

export const BUS_STOPS = ["Chilonzor-9", "Bunyodkor", "Novza", "KIDDO Demo bog'chasi"];

export function zoneAt(x: number, y: number): Zone | null {
  // Kichikroq (aniqroq) zona ustuvor: kirish/chiqish/yig'ilish nuqtasi katta zonalar ichida
  const hits = ZONES.filter((z) => x >= z.rect[0] && x <= z.rect[0] + z.rect[2] && y >= z.rect[1] && y <= z.rect[1] + z.rect[3]);
  return hits.sort((a, b) => a.rect[2] * a.rect[3] - b.rect[2] * b.rect[3])[0] ?? null;
}

export function zoneCenter(id: string): [number, number] {
  const z = ZONES.find((x) => x.id === id)!;
  return [z.rect[0] + z.rect[2] / 2, z.rect[1] + z.rect[3] / 2];
}
