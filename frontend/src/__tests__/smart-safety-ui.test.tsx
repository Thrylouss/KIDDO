import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import Workspace from "@/components/smart-safety/Workspace";
import ParentApp from "@/components/smart-safety/ParentApp";
import SmartSafetyTeaser from "@/components/landing/SmartSafetyTeaser";
import PresentationPage from "@/app/smart-safety/page";
import { __resetForTests, dispatch, getSnapshot, STEP_MS } from "@/lib/smart-safety/store";
import { stateBefore } from "@/lib/smart-safety/engine";
import { CHILDREN } from "@/lib/smart-safety/model";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

const t = uz.ss;
vi.mock("@/lib/smart-safety/features", () => ({ SMART_SAFETY_DEMO: true }));
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

/** Holatni ssenariy oxiriga qo'yadi (store orqali — barcha panellar bir xil holatni ko'radi). */
function jumpTo(scenario: number) {
  const target = stateBefore(scenario + 1, t.resolve_note);
  const snap = getSnapshot();
  act(() => { Object.assign(snap, { state: { ...target, version: snap.state.version + 100 } }); dispatch({ type: "tick", ms: 0 }); });
}

beforeEach(() => { localStorage.clear(); __resetForTests(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe("Smart Safety — rollar va modullar", () => {
  it("rahbar: DEMO va Tez kunda belgilari, simulyator va barcha rahbar modullari", () => {
    render(<Workspace role="director" />);
    expect(screen.getAllByTestId("demo-badge").length).toBeGreaterThan(0);
    expect(screen.getByText(t.soon)).toBeInTheDocument();
    expect(screen.getByTestId("simulator")).toBeInTheDocument();
    for (const m of ["dashboard", "map", "devices", "assignment", "attendance", "geofence", "alerts", "evacuation", "pickup", "cctv", "bus", "audit", "integrations"] as const) {
      expect(screen.getByRole("tab", { name: t.modules[m] })).toBeInTheDocument();
    }
  });

  it("har bir modul ochiladi (bo'sh sahifa yo'q)", () => {
    jumpTo(17);
    render(<Workspace role="director" showControls={false} />);
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      expect(screen.getByRole("tabpanel").textContent!.length).toBeGreaterThan(10);
    }
  });

  it("xarita: belgi bosilganda profil (guruh, qurilma, batareya, joy, vaqt); eskirgan joylashuv ajratiladi", () => {
    jumpTo(11);
    render(<Workspace role="director" showControls={false} />);
    fireEvent.click(screen.getByRole("tab", { name: t.modules.map }));
    fireEvent.click(screen.getByTestId("marker-demo-c-2"));
    const p = screen.getByTestId("child-profile");
    expect(p).toHaveTextContent("Jasur B.");
    expect(p).toHaveTextContent("demo-WB-102");
    expect(p).toHaveTextContent("Quyoshcha");
    expect(screen.getByTestId("marker-demo-c-5")).toHaveAttribute("data-stale", "1");   // oflayn qurilma
    fireEvent.click(screen.getByTestId("marker-demo-c-5"));
    expect(screen.getByTestId("child-profile")).toHaveTextContent(t.map.stale_note);
  });

  it("tarbiyachi faqat o'z guruhini ko'radi va boshqaruv modullari yo'q", () => {
    jumpTo(3);
    render(<Workspace role="teacher" showControls={false} />);
    expect(screen.getByTestId("marker-demo-c-1")).toBeInTheDocument();
    expect(screen.queryByTestId("marker-demo-c-7")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: t.modules.assignment })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: t.modules.geofence })).not.toBeInTheDocument();
  });

  it("Super Admin: global statistika bolalar ismlarisiz", () => {
    jumpTo(17);
    const { container } = render(<Workspace role="super_admin" showControls={false} />);
    expect(screen.getByTestId("org-table")).toBeInTheDocument();
    CHILDREN.forEach((c) => expect(container.textContent).not.toContain(c.name));
  });
});

describe("Smart Safety — ogohlantirish hayot sikli", () => {
  it("kritik banner → qabul qilish (yopilmaydi) → izohsiz yechib bo'lmaydi → izoh bilan yechiladi", () => {
    jumpTo(4);
    render(<Workspace role="teacher" showControls={false} />);
    const banner = screen.getByTestId("critical-banner");
    expect(banner).toHaveTextContent(t.incident.type.restricted_zone);
    expect(banner).toHaveTextContent("Jasur B.");
    expect(within(banner).getByRole("button", { name: new RegExp(t.sim.sound_on) })).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: t.incident.acknowledge }));
    expect(screen.queryByTestId("critical-banner")).not.toBeInTheDocument();
    expect(getSnapshot().state.incidents[0].status).toBe("acknowledged");

    fireEvent.click(screen.getByRole("tab", { name: t.modules.alerts }));
    const row = screen.getByTestId(`incident-${getSnapshot().state.incidents[0].id}`);
    fireEvent.click(within(row).getByRole("button", { name: t.incident.resolve }));
    expect(screen.getByText(t.incident.note_required)).toBeInTheDocument();
    expect(getSnapshot().state.incidents[0].status).toBe("acknowledged");
    fireEvent.change(within(row).getByPlaceholderText(t.incident.note_ph), { target: { value: "Bola o'yin maydonida" } });
    fireEvent.click(within(row).getByRole("button", { name: t.incident.resolve }));
    expect(getSnapshot().state.incidents[0]).toMatchObject({ status: "resolved", note: "Bola o'yin maydonida" });
  });

  it("boshqa guruh tarbiyachisi uchun banner chiqmaydi (rahbarda chiqadi)", () => {
    jumpTo(4);
    const snap = getSnapshot();
    act(() => { Object.assign(snap.state.incidents[0], { childId: "demo-c-7" }); dispatch({ type: "tick", ms: 0 }); });
    const { unmount } = render(<Workspace role="teacher" showControls={false} />);
    expect(screen.queryByTestId("critical-banner")).not.toBeInTheDocument();
    unmount();
    render(<Workspace role="director" showControls={false} />);
    expect(screen.getByTestId("critical-banner")).toBeInTheDocument();
  });
});

describe("Smart Safety — simulyator va izolyatsiya", () => {
  it("Start / Pause / Reset va ssenariy tanlash; tarmoqqa hech qanday so'rov yuborilmaydi", () => {
    vi.useFakeTimers();
    render(<Workspace role="director" />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.sim.start) }));
    act(() => { vi.advanceTimersByTime(STEP_MS * 3); });
    expect(getSnapshot().runner.running).toBe(true);
    expect(getSnapshot().state.log.some((l) => l.code === "arrival")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.sim.pause) }));
    const v = getSnapshot().state.version;
    act(() => { vi.advanceTimersByTime(STEP_MS * 5); });
    expect(getSnapshot().state.version).toBe(v);

    fireEvent.change(screen.getByLabelText(t.sim.scenario), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.sim.run) }));
    act(() => { vi.advanceTimersByTime(STEP_MS * 2); });
    expect(getSnapshot().state.incidents.some((i) => i.type === "sos")).toBe(true);
    expect(screen.getByTestId("sim-scenario")).toHaveTextContent(t.scenario.sos);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.sim.reset) }));
    expect(getSnapshot().state.incidents).toHaveLength(0);
    Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("ota-ona ilovasi faqat o'z farzandini ko'rsatadi; bildirishnomalar demo ichida", () => {
    jumpTo(13);
    const { container } = render(<ParentApp />);
    expect(screen.getByTestId("parent-app")).toHaveTextContent("Malika A.");
    expect(screen.getByTestId("parent-notices")).toHaveTextContent(t.parent.n_arrival);
    expect(screen.getByTestId("parent-notices")).toHaveTextContent("Dilnoza A. (demo)");
    CHILDREN.filter((c) => c.id !== "demo-c-1").forEach((c) => expect(container.textContent).not.toContain(c.name));
    expect(screen.getByRole("note")).toHaveTextContent(t.parent.label);
  });

  it("taqdimot sahifasi: rol almashtirgich va ota-ona demosi", () => {
    render(<PresentationPage />);
    expect(screen.getByRole("heading", { name: t.presentation })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: t.roles.parent }));
    expect(screen.getByTestId("parent-app")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: t.roles.super_admin }));
    expect(screen.getByTestId("workspace-super_admin")).toBeInTheDocument();
  });

  it("landing bo'limi: Tez kunda, taqdimotga havola va sintetik ma'lumot ogohlantirishi", () => {
    render(<SmartSafetyTeaser />);
    expect(screen.getByText(t.landing.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.landing.cta })).toHaveAttribute("href", "/smart-safety");
    expect(screen.getByText(t.landing.disclaimer)).toBeInTheDocument();
  });
});
