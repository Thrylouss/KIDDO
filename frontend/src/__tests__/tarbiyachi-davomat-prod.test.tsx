import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TarbiyachiDashboardPage from "@/app/tarbiyachi/dashboard/page";
import { api } from "@/lib/api";
import { getDemoAttendance, saveDemoAttendance } from "@/lib/demo-data";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false: real API kontrakti (GET /v1/teacher/dashboard) ─────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Maftuna Xolmatova", role: "teacher" } }),
}));

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:             false,
  getDemoAttendance:   vi.fn(),
  saveDemoAttendance:  vi.fn(),
  clearDemoAttendance: vi.fn(),
}));

// ── Fixture ────────────────────────────────────────────────────────────────────

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    teacher:       { id: 1, name: "Maftuna Xolmatova", position: "Bosh tarbiyachi" },
    groups:        [{ id: 1, name: "Kamalak guruhi" }, { id: 2, name: "Quyosh guruhi" }],
    group:         { id: 1, name: "Kamalak guruhi", age_category: "3–4 yosh", capacity: 14 },
    date:          "2026-10-28",
    editable:      true,
    editable_from: "2026-10-26",
    children: [
      { id: 1, first_name: "Azizbek", last_name: "Karimov",   status: "present", note: null },
      { id: 2, first_name: "Malika",  last_name: "Yusupova",  status: "absent",  note: "Shamollagan" },
      { id: 3, first_name: "Sardor",  last_name: "Toshmatov", status: null,      note: null },
    ],
    summary: { total: 3, present: 1, absent: 1, excused: 0, unmarked: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(dashboard());
});

describe("Tarbiyachi dashboard — real rejim (IS_DEMO=false)", () => {
  it("real endpointdan yuklaydi va API holatlarini ko'rsatadi", async () => {
    render(<TarbiyachiDashboardPage />);

    expect(await screen.findByText("Karimov Azizbek")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/v1/teacher/dashboard");
    expect(screen.getByTestId("count-present")).toHaveTextContent("1");
    expect(screen.getByTestId("count-absent")).toHaveTextContent("1");
    expect(screen.getByTestId("count-unmarked")).toHaveTextContent("1");
    expect(screen.getByTestId("status-1-present")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Shamollagan")).toBeInTheDocument();
  });

  it("guruh kartasi real javobdan; qayta yuklash sikli yo'q (bitta so'rov)", async () => {
    render(<TarbiyachiDashboardPage />);

    expect(await screen.findByTestId("group-card")).toHaveTextContent("Kamalak guruhi");
    expect(screen.getByTestId("group-card")).toHaveTextContent("Bosh tarbiyachi");
    await new Promise((r) => setTimeout(r, 50));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("demo localStorage funksiyalari ishlatilmaydi va demo tugmalari yo'q", async () => {
    render(<TarbiyachiDashboardPage />);
    await screen.findByText("Karimov Azizbek");

    expect(getDemoAttendance).not.toHaveBeenCalled();
    expect(screen.queryByText(uz.tarbiyachi_panel.bekor_qilish)).toBeNull();
    expect(screen.queryByText(uz.tarbiyachi_panel.demo_xabar)).toBeNull();
    expect(screen.queryByTestId("toggle-1")).toBeNull();
  });

  it("saqlash PUT /v1/teacher/attendance ga faqat o'zgarganlarni (izoh bilan) yuboradi", async () => {
    vi.mocked(api.put).mockResolvedValue(dashboard({
      children: [
        { id: 1, first_name: "Azizbek", last_name: "Karimov",   status: "present", note: null },
        { id: 2, first_name: "Malika",  last_name: "Yusupova",  status: "excused", note: "Shamollagan" },
        { id: 3, first_name: "Sardor",  last_name: "Toshmatov", status: "present", note: null },
      ],
      summary: { total: 3, present: 2, absent: 0, excused: 1, unmarked: 0 },
    }));
    render(<TarbiyachiDashboardPage />);
    await screen.findByText("Karimov Azizbek");

    fireEvent.click(screen.getByTestId("status-2-excused"));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.sabab}`), { selector: "input, select, textarea" }), { target: { value: "kasallik" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.izoh}`), { selector: "input, select, textarea" }), { target: { value: "Shamollagan" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    fireEvent.click(screen.getByTestId("status-3-present"));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.davomat.saqlandi);
    expect(api.put).toHaveBeenCalledWith("/v1/teacher/attendance", {
      date: "2026-10-28",
      group_id: 1,
      records: [
        { child_id: 2, status: "excused", excuse_reason: "kasallik", note: "Shamollagan" },
        { child_id: 3, status: "present", note: null },
      ],
    });
    expect(saveDemoAttendance).not.toHaveBeenCalled();
    expect(screen.getByTestId("count-unmarked")).toHaveTextContent("0");
  });

  it("saqlanmagan belgilash ko'rsatkichlarni o'zgartirmaydi — faqat saqlangan (server) holat", async () => {
    render(<TarbiyachiDashboardPage />);
    await screen.findByText("Karimov Azizbek");

    fireEvent.click(screen.getByTestId("status-3-present"));

    expect(screen.getByTestId("status-3-present")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("count-present")).toHaveTextContent("1");
    expect(screen.getByTestId("count-unmarked")).toHaveTextContent("1");
    expect(screen.getByTestId("unsaved")).toHaveTextContent("1");
  });

  it("guruh tanlansa group_id bilan qayta yuklanadi", async () => {
    render(<TarbiyachiDashboardPage />);
    await screen.findByText("Karimov Azizbek");

    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.guruh}`), { selector: "input, select, textarea" }), { target: { value: "2" } });

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/v1/teacher/dashboard?group_id=2"));
  });

  it("guruh biriktirilmagan bo'lsa tushunarli xabar", async () => {
    vi.mocked(api.get).mockResolvedValue(dashboard({ groups: [], group: null, children: [], summary: null, editable: false }));
    render(<TarbiyachiDashboardPage />);

    expect(await screen.findByText(uz.davomat.guruh_yoq_tarbiyachi)).toBeInTheDocument();
  });

  it("403 → server xabari, saqlash tugmasi yo'q", async () => {
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error("x"), { status: 403, data: { message: "Tarbiyachi profili faol emas." } }));
    render(<TarbiyachiDashboardPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tarbiyachi profili faol emas.");
    expect(screen.queryByRole("button", { name: uz.davomat.saqlash })).toBeNull();
  });

  it("tahrirlash muddati o'tgan sana — faqat ko'rish", async () => {
    vi.mocked(api.get).mockResolvedValue(dashboard({ date: "2026-10-20", editable: false }));
    render(<TarbiyachiDashboardPage />);

    expect(await screen.findByRole("note")).toHaveTextContent(uz.davomat.faqat_korish);
    expect(screen.getByTestId("status-3-present")).toBeDisabled();
    expect(screen.queryByRole("button", { name: uz.davomat.saqlash })).toBeNull();
  });
});
