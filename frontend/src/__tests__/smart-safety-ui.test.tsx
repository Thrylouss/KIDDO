import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import SmartSafetyApp from "@/components/smart-safety/SmartSafetyApp";
import ParentApp from "@/components/smart-safety/ParentApp";
import PresenterToolbar from "@/components/smart-safety/Presenter";
import { SmartNavGroup } from "@/components/smart-safety/SmartNav";
import { spreadMarkers, wrapLabel } from "@/components/smart-safety/FloorPlan";
import SmartSafetyTeaser from "@/components/landing/SmartSafetyTeaser";
import PresentationPage from "@/app/smart-safety/page";
import { __resetForTests, dispatch, getSnapshot, STEP_MS } from "@/lib/smart-safety/store";
import { stateBefore } from "@/lib/smart-safety/engine";
import { CHILDREN, ZONES, zoneAt, type Role } from "@/lib/smart-safety/model";
import { ALL_MODULES, ROLE_BASE, SECTIONS } from "@/lib/smart-safety/nav";
import { GUIDED, guidedState } from "@/lib/smart-safety/presenter";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

const t = uz.ssx;
const push = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathname,
  useParams: () => ({}),
  notFound: () => { throw new Error("notFound"); },
}));
vi.mock("@/lib/smart-safety/features", () => ({ SMART_SAFETY_DEMO: true }));
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

/** Holatni ssenariy oxiriga qo'yadi (store orqali — barcha panellar bir xil holatni ko'radi). */
function jumpTo(scenario: number) {
  const target = stateBefore(scenario + 1, uz.ss.resolve_note);
  const snap = getSnapshot();
  act(() => { Object.assign(snap, { state: { ...target, version: snap.state.version + 100 } }); dispatch({ type: "tick", ms: 0 }); });
}

const app = (role: Exclude<Role, "parent">, path: string[] = []) => render(<SmartSafetyApp role={role} base={ROLE_BASE[role]} path={path} />);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); __resetForTests(); vi.clearAllMocks(); pathname = "/"; window.history.replaceState(null, "", "/"); });
afterEach(() => { vi.useRealTimers(); });

describe("Navigatsiya va rollar", () => {
  it("barcha 23 funksional modul kamida bitta rol bo'limida mavjud", () => {
    const covered = new Set(Object.values(SECTIONS).flat().flatMap((s) => s.modules));
    ALL_MODULES.forEach((m) => expect(covered.has(m), m).toBe(true));
    expect(ALL_MODULES).toHaveLength(23);
  });

  it("har bir rol faqat o'z bo'limlarini ko'radi (spetsifikatsiya tartibida)", () => {
    expect(SECTIONS.super_admin.map((s) => s.label)).toEqual(["overview", "kindergartens", "devices", "reports", "settings"]);
    expect(SECTIONS.director.map((s) => s.label)).toEqual(["overview", "map", "children", "attendance", "alerts", "devices", "reports", "settings"]);
    expect(SECTIONS.teacher.map((s) => s.label)).toEqual(["overview", "map", "attendance", "headcount", "pickup", "alerts", "activity"]);
  });

  it("sidebar guruhi yig'iladi/ochiladi va joriy bo'lim ichida avtomatik ochiq", () => {
    pathname = "/tarbiyachi/smart-safety/sanash";
    render(<SmartNavGroup role="teacher" base="/tarbiyachi/smart-safety" />);
    const nav = screen.getByTestId("smart-nav-teacher");
    expect(within(nav).getAllByRole("link")).toHaveLength(7);
    expect(within(nav).getByRole("link", { name: t.sections.headcount })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: t.sections.devices })).not.toBeInTheDocument();
  });

  it("har bir rolning har bir bo'limi ochiladi (bo'sh sahifa yo'q)", () => {
    jumpTo(17);
    (["super_admin", "director", "teacher"] as const).forEach((role) => {
      SECTIONS[role].forEach((s) => {
        const { unmount, container } = app(role, s.slug ? [s.slug] : []);
        expect(container.textContent!.length, `${role}/${s.slug}`).toBeGreaterThan(40);
        unmount();
      });
    });
  });

  it("ichki sahifalar: bolalar nazorati, faollik, qurilma tafsiloti", () => {
    jumpTo(17);
    for (const path of [["bolalar", "sanash"], ["bolalar", "topshirish"], ["bolalar", "faollik", "uyqu"], ["bolalar", "avtobus"], ["bolalar", "salomatlik"], ["qurilmalar", "biriktirish"], ["qurilmalar", "demo-WB-104"]]) {
      const { unmount, container } = app("director", path);
      expect(container.textContent!.length, path.join("/")).toBeGreaterThan(40);
      expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
      unmount();
    }
  });

  it("tarbiyachi interfeysida texnik atamalar yo'q (IoT, API, gateway, firmware, qurilma kodlari)", () => {
    jumpTo(17);
    const banned = /\bIoT\b|\bAPI\b|gateway|firmware|proshivka|demo-(WB|GW|AN)-|MQTT|WebSocket/i;
    SECTIONS.teacher.forEach((s) => {
      const { unmount, container } = app("teacher", s.slug ? [s.slug] : []);
      expect(container.textContent, s.slug).not.toMatch(banned);
      unmount();
    });
    for (const sub of ["harakat", "uyqu", "ovqat"]) {
      const { unmount, container } = app("teacher", ["faollik", sub]);
      expect(container.textContent).not.toMatch(banned);
      unmount();
    }
  });

  it("Super Admin: hech bir bo'limda bolalar ismlari yo'q; texnik ma'lumot Sozlamalar ichida yashirin", () => {
    jumpTo(17);
    SECTIONS.super_admin.forEach((s) => {
      const { unmount, container } = app("super_admin", s.slug ? [s.slug] : []);
      container.querySelectorAll("details").forEach((d) => { d.open = true; });
      CHILDREN.forEach((c) => expect(container.textContent, s.slug).not.toContain(c.name));
      unmount();
    });
    const { container } = app("super_admin");
    expect(screen.getByTestId("overview-sa")).toBeInTheDocument();
    expect(container.textContent).not.toContain(uz.ss.sa.firmware);
  });

  it("tarbiyachi faqat o'z guruhini ko'radi", () => {
    jumpTo(3);
    app("teacher", ["xarita"]);
    expect(screen.getByTestId("marker-demo-c-1")).toBeInTheDocument();
    expect(screen.queryByTestId("marker-demo-c-7")).not.toBeInTheDocument();
  });

  it("Super Admin funksiyani o'chirsa — bo'lim menyudan yo'qoladi", () => {
    pathname = "/bogcha/smart-safety";
    act(() => { dispatch({ type: "feature", key: "live_map", enabled: false, by: "super_admin" }); });
    render(<SmartNavGroup role="director" base="/bogcha/smart-safety" />);
    expect(screen.queryByRole("link", { name: t.sections.map })).not.toBeInTheDocument();
  });
});

describe("Bosh sahifalar", () => {
  it("rahbar: holat, 4 hisoblagich va 4 tezkor karta", () => {
    jumpTo(3);
    app("director");
    expect(screen.getByTestId("status-banner")).toHaveAttribute("data-status", "ok");
    expect(screen.getByTestId("count-total")).toHaveTextContent("10");
    expect(screen.getByTestId("count-present")).toHaveTextContent("10");
    expect(screen.getByTestId("count-absent")).toHaveTextContent("0");
    ["xarita", "davomat", "ogohlantirishlar", "qurilmalar"].forEach((s) =>
      expect(document.querySelector(`a[href="/bogcha/smart-safety/${s}"]`)).not.toBeNull());
    expect(screen.queryByTestId("simulator")).not.toBeInTheDocument();     // ish rejimida taqdimot boshqaruvi yo'q
    expect(screen.queryByTestId("presenter")).not.toBeInTheDocument();
  });

  it("tarbiyachi: 3 hisoblagich va 6 ta katta tezkor karta", () => {
    jumpTo(1);
    app("teacher");
    expect(screen.getByTestId("count-total")).toHaveTextContent("6");
    for (const q of [t.ov.q_map, t.ov.q_count, t.ov.q_attendance, t.ov.q_pickup, t.ov.q_alerts, t.ov.q_activity]) expect(screen.getByText(q)).toBeInTheDocument();
  });
});

describe("Xarita", () => {
  it("profil: ism, guruh, joy va vaqt; eskirgan joylashuv «tasdiqlanmagan» deb ko'rsatiladi", () => {
    jumpTo(11);
    app("director", ["xarita"]);
    fireEvent.click(screen.getByTestId("marker-demo-c-2"));
    const p = screen.getByTestId("child-profile");
    expect(p).toHaveTextContent("Jasur B.");
    expect(p).toHaveTextContent("Quyoshcha");
    expect(screen.getByTestId("marker-demo-c-5")).toHaveAttribute("data-stale", "1");
    fireEvent.click(screen.getByTestId("marker-demo-c-5"));
    expect(screen.getByTestId("child-profile")).toHaveTextContent(t.map.last_known);
    expect(screen.getByTestId("child-profile")).not.toHaveTextContent(new RegExp(`^${t.map.live}`));
  });

  it("qidiruv, kattalashtirish va to'liq ekran", () => {
    jumpTo(3);
    app("director", ["xarita"]);
    fireEvent.change(screen.getByLabelText(t.map.search), { target: { value: "sevin" } });
    fireEvent.click(screen.getByRole("option", { name: /Sevinch D\./ }));
    expect(screen.getByTestId("child-profile")).toHaveTextContent("Sevinch D.");
    expect(Number(screen.getByTestId("floor-plan").getAttribute("data-zoom"))).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: t.map.zoom_reset }));
    expect(screen.getByTestId("floor-plan")).toHaveAttribute("data-zoom", "1");
    fireEvent.click(screen.getByRole("button", { name: t.map.fullscreen }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("«Xaritada ko'rish» (?bola=) bolani va xavfli hududni belgilaydi", () => {
    jumpTo(4);
    window.history.replaceState(null, "", "/tarbiyachi/smart-safety/xarita?bola=demo-c-2");
    app("teacher", ["xarita"]);
    expect(screen.getByTestId("child-profile")).toHaveTextContent(t.map.in_danger);
    expect(screen.getByTestId("zone-z-kitchen")).toHaveAttribute("data-danger", "1");
    expect(screen.getByTestId("marker-demo-c-2")).toHaveAttribute("data-alert", "1");
  });

  it("markerlar ustma-ust tushmaydi va zona ichida qoladi; xona nomlari kesilmaydi", () => {
    const pts = CHILDREN.map((c) => ({ id: c.id, x: 50, y: 53, zone: zoneAt(50, 53) }));
    const pos = spreadMarkers(pts);
    const ids = Object.keys(pos);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      expect(Math.hypot(pos[ids[i]][0] - pos[ids[j]][0], pos[ids[i]][1] - pos[ids[j]][1])).toBeGreaterThan(3.5);
    }
    ZONES.forEach((z) => {
      const fs = z.rect[2] < 14 ? 1.15 : 1.7;
      for (const lang of [uz.ss.zone]) {
        const name = Object.values(lang).find(Boolean)!;
        wrapLabel(name, z.rect[2], fs).forEach((line) => expect(line.length * fs * 0.56).toBeLessThanOrEqual(z.rect[2] + fs * 6));
      }
    });
    expect(wrapLabel("Favqulodda chiqish", 10, 1.15)).toEqual(["Favqulodda", "chiqish"]);
  });
});

describe("Ogohlantirishlar", () => {
  it("tushunarli xabar → qabul qilish xavfsiz deb belgilamaydi → tekshirish (belgi + izoh) bilan yopiladi", () => {
    jumpTo(4);
    app("teacher");
    const banner = screen.getByTestId("critical-banner");
    expect(screen.getByTestId("banner-message")).toHaveTextContent("DIQQAT! Jasur oshxona hududiga kirdi.");
    expect(banner).toHaveAttribute("data-tone", "danger");
    expect(within(banner).getByRole("link", { name: new RegExp(t.alert.show_map) })).toHaveAttribute("href", "/tarbiyachi/smart-safety/xarita?bola=demo-c-2");
    expect(within(banner).getByRole("button", { name: new RegExp(uz.ss.sim.sound_on) })).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: t.alert.ack }));
    expect(getSnapshot().state.incidents[0].status).toBe("acknowledged");
    expect(screen.getByTestId("critical-banner")).toHaveTextContent(t.alert.ack_note);   // hal qilinmaguncha ko'rinadi
  });

  it("yopish uchun tekshiruv majburiy; audit yozuvi qoladi", () => {
    jumpTo(6);
    app("teacher", ["ogohlantirishlar"]);
    const id = getSnapshot().state.incidents.find((i) => i.type === "restricted_zone")!.id;
    const box = screen.getByTestId(`verify-${id}`);
    fireEvent.click(within(box).getByRole("button", { name: t.alert.verify_btn }));
    expect(screen.getByText(t.alert.verify_need)).toBeInTheDocument();
    fireEvent.change(within(box).getByPlaceholderText(t.alert.verify_note), { target: { value: "Bolani o'yin maydoniga olib chiqdim" } });
    fireEvent.click(within(box).getByRole("button", { name: t.alert.verify_btn }));
    expect(getSnapshot().state.incidents.find((i) => i.id === id)!.status).toBe("acknowledged");   // belgi qo'yilmagan
    fireEvent.click(within(box).getByRole("checkbox", { name: t.alert.verify_check }));
    fireEvent.click(within(box).getByRole("button", { name: t.alert.verify_btn }));
    expect(getSnapshot().state.incidents.find((i) => i.id === id)).toMatchObject({ status: "resolved", note: "Bolani o'yin maydoniga olib chiqdim" });
    expect(getSnapshot().state.log.some((l) => l.code === "resolved" && l.params.incident === id)).toBe(true);
  });

  it("qabul qilinmasa — «Rahbarga xabar berildi.»", () => {
    jumpTo(5);
    app("teacher");
    expect(screen.getByTestId("escalated")).toHaveTextContent(t.alert.escalated);
  });

  it("boshqa guruh tarbiyachisida banner yo'q, rahbarda bor; ogohlantirishlar sahifasida banner takrorlanmaydi", () => {
    jumpTo(4);
    const snap = getSnapshot();
    act(() => { Object.assign(snap.state.incidents[0], { childId: "demo-c-7" }); dispatch({ type: "tick", ms: 0 }); });
    const a = app("teacher");
    expect(screen.queryByTestId("critical-banner")).not.toBeInTheDocument();
    a.unmount();
    const b = app("director");
    expect(screen.getByTestId("critical-banner")).toBeInTheDocument();
    b.unmount();
    app("director", ["ogohlantirishlar"]);
    expect(screen.queryByTestId("critical-banner")).not.toBeInTheDocument();
  });

  it("batareya — sariq eslatma, oddiy tilda", () => {
    jumpTo(10);
    app("teacher", ["ogohlantirishlar"]);
    expect(screen.getByTestId("warnings")).toHaveTextContent("Asadbekning bilaguzugini quvvatlash kerak.");
  });
});

describe("Davomat, sanash, topshirish, qurilmalar", () => {
  it("davomat: 4 hisoblagich; qurilma aniqlagani tasdiqlangandan ajratiladi", () => {
    jumpTo(13);
    app("teacher", ["davomat"]);
    expect(screen.getByTestId("att-present")).toHaveTextContent("5");
    expect(screen.getByTestId("att-departed")).toHaveTextContent("1");
    const row = screen.getByTestId("att-row-demo-c-2");
    expect(row).toHaveTextContent(t.att.detected);
    fireEvent.click(within(row).getByRole("button", { name: t.att.confirm }));
    expect(screen.getByTestId("att-row-demo-c-2")).toHaveTextContent(t.att.confirmed);
    expect(getSnapshot().state.attendanceConfirmed["demo-c-2"]).toBeTruthy();
  });

  it("sanash: aniqlanmagan bola «tekshirish kerak» (yo'qolgan emas); xodim ko'rib tasdiqlaydi", () => {
    jumpTo(11);
    app("teacher", ["sanash"]);
    expect(screen.getByTestId("headcount-last")).toHaveTextContent(t.hc.never);
    fireEvent.click(screen.getByTestId("run-headcount"));
    const list = screen.getByTestId("headcount-list");
    expect(list).toHaveTextContent("Zarina F.");
    const missing = getSnapshot().state.incidents.find((i) => i.type === "missing" && i.childId === "demo-c-5")!;
    expect(missing.severity).toBe("high");   // qizil emas — tekshirish talab qilinadi
    const zarina = within(list).getByText("Zarina F.").closest("li")!;
    fireEvent.click(within(zarina as HTMLElement).getByRole("button", { name: t.hc.verify_btn }));
    expect(getSnapshot().state.headcount!.verified).toContain("demo-c-5");
    expect(getSnapshot().state.incidents.find((i) => i.id === missing.id)!.status).toBe("resolved");
    expect(getSnapshot().state.log.some((l) => l.code === "child_verified")).toBe(true);
  });

  it("topshirish: ruxsatsiz shaxs rad etiladi; ruxsat etilgan — alohida tasdiqlashdan keyin topshiriladi", () => {
    jumpTo(3);
    app("teacher", ["topshirish"]);
    fireEvent.click(within(screen.getByTestId("pickup-children")).getByRole("button", { name: /Malika A\./ }));
    fireEvent.change(screen.getByLabelText(t.pk.who), { target: { value: "demo-p-9" } });
    fireEvent.click(screen.getByRole("button", { name: t.pk.check }));
    expect(screen.getByTestId("pickup-denied")).toBeInTheDocument();
    expect(getSnapshot().state.children["demo-c-1"].departedAt).toBeNull();
    fireEvent.change(screen.getByLabelText(t.pk.who), { target: { value: "demo-p-1" } });
    fireEvent.click(screen.getByRole("button", { name: t.pk.check }));
    expect(getSnapshot().state.children["demo-c-1"].departedAt).toBeNull();    // tekshirish ≠ topshirish
    fireEvent.click(screen.getByTestId("pickup-confirm"));
    expect(getSnapshot().state.children["demo-c-1"].pickedUpBy).toBe("demo-p-1");
    expect(screen.getByTestId("pickup-history")).toHaveTextContent("Dilnoza A. (demo)");
  });

  it("qurilmalar: konsept katalogi (6 tur), oddiy holatlar, texnik ma'lumot tafsilot sahifasida", () => {
    jumpTo(12);
    const { unmount } = app("director", ["qurilmalar"]);
    expect(within(screen.getByTestId("device-catalog")).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getAllByText(t.dev.concept).length).toBeGreaterThan(0);
    expect(screen.getByTestId("device-attention")).toHaveTextContent("Asadbekning bilaguzugini quvvatlash kerak.");
    expect(screen.queryByText("1.4.2")).not.toBeInTheDocument();
    unmount();
    app("director", ["qurilmalar", "demo-WB-104"]);
    expect(screen.getByTestId("device-tech")).toHaveTextContent("demo-WB-104");
  });
});

describe("Taqdimot", () => {
  it("taqdimotchi paneli: Start / Pause / Reset, ssenariy tanlash; tarmoqqa so'rov yo'q", () => {
    vi.useFakeTimers();
    render(<PresenterToolbar role="director" />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.ss.sim.start) }));
    act(() => { vi.advanceTimersByTime(STEP_MS * 3); });
    expect(getSnapshot().runner.running).toBe(true);
    expect(getSnapshot().state.log.some((l) => l.code === "arrival")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.ss.sim.pause) }));
    const v = getSnapshot().state.version;
    act(() => { vi.advanceTimersByTime(STEP_MS * 5); });
    expect(getSnapshot().state.version).toBe(v);
    fireEvent.change(screen.getByLabelText(uz.ss.sim.scenario), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.ss.sim.run) }));
    act(() => { vi.advanceTimersByTime(STEP_MS * 2); });
    expect(getSnapshot().state.incidents.some((i) => i.type === "sos")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: uz.ss.sim.reset }));
    expect(getSnapshot().state.incidents).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: t.pres.collapse }));
    expect(screen.queryByTestId("presenter")).not.toBeInTheDocument();
    expect(screen.getByTestId("presenter-open")).toBeInTheDocument();
    Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("bosqichma-bosqich taqdimot: 9 qadam, qo'lda oldinga/orqaga, to'g'ri rol va bo'limga o'tadi", () => {
    render(<PresenterToolbar role="director" />);
    fireEvent.click(screen.getByTestId("guided-start"));
    expect(push).toHaveBeenLastCalledWith("/smart-safety/rahbar");
    expect(screen.getByTestId("guided-step")).toHaveTextContent("1 / 9");
    for (let k = 1; k < GUIDED.length; k++) fireEvent.click(screen.getByTestId("guided-next"));
    expect(screen.getByTestId("guided-step")).toHaveTextContent("9 / 9");
    expect(push).toHaveBeenLastCalledWith("/smart-safety/tarbiyachi/topshirish");
    expect(getSnapshot().state.children["demo-c-1"].pickedUpBy).toBe("demo-p-1");
    expect(getSnapshot().runner.running).toBe(false);   // avtomatik shoshirmaydi
  });

  it("taqdimot qadamlari mazmunan to'g'ri (kelish → davomat → xabar → harakat → xavfli hudud → … → topshirish)", () => {
    const note = uz.ss.resolve_note;
    expect(guidedState(0, note).children["demo-c-1"].arrivedAt).toBeTruthy();
    expect(guidedState(2, note).notices.some((n) => n.childId === "demo-c-1" && n.code === "arrival")).toBe(true);
    expect(guidedState(4, note).incidents[0]).toMatchObject({ type: "restricted_zone", status: "open" });
    expect(guidedState(5, note).incidents[0].escalatedAt).toBeTruthy();
    expect(guidedState(7, note).incidents[0].status).toBe("acknowledged");   // tekshiruvni taqdimotchi ko'rsatadi
    expect(guidedState(8, note).incidents[0].status).toBe("resolved");
    expect(guidedState(8, note).notices.some((n) => n.code === "departure")).toBe(true);
  });

  it("taqdimot bosh sahifasi: 4 rol va taqdimotni boshlash", () => {
    render(<PresentationPage />);
    expect(screen.getByRole("heading", { name: t.pres.home_title })).toBeInTheDocument();
    expect(screen.getByTestId("role-parent")).toHaveAttribute("href", "/smart-safety/ota-ona");
    expect(screen.getByTestId("role-super_admin")).toHaveAttribute("href", "/smart-safety/admin");
    fireEvent.click(screen.getByTestId("guided-start-home"));
    expect(push).toHaveBeenCalledWith("/smart-safety/rahbar");
  });

  it("ota-ona ilovasi: faqat o'z farzandi; keldi / topshirildi / xavfsizlik javoblari", () => {
    jumpTo(13);
    const { container } = render(<ParentApp />);
    expect(screen.getByTestId("parent-app")).toHaveTextContent("Malika A.");
    expect(screen.getByTestId("parent-arrived")).toHaveTextContent(t.parent.arrived_yes.split(" ")[0]);
    expect(screen.getByTestId("parent-handed")).toHaveTextContent("Dilnoza A. (demo)");
    expect(screen.getByTestId("parent-notices")).toHaveTextContent(uz.ss.parent.n_arrival);
    CHILDREN.filter((c) => c.id !== "demo-c-1").forEach((c) => expect(container.textContent).not.toContain(c.name));
    expect(screen.getByRole("note")).toHaveTextContent(t.parent.concept);
  });

  it("landing bo'limi: Tez kunda, taqdimotga havola va sintetik ma'lumot ogohlantirishi", () => {
    render(<SmartSafetyTeaser />);
    expect(screen.getByText(uz.ss.landing.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uz.ss.landing.cta })).toHaveAttribute("href", "/smart-safety");
    expect(screen.getByText(uz.ss.landing.disclaimer)).toBeInTheDocument();
  });
});
