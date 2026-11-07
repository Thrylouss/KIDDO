import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AttendanceSheet from "@/components/attendance/AttendanceSheet";
import MonthlyAttendance from "@/components/attendance/MonthlyAttendance";
import MeningGuruhimPage from "@/app/tarbiyachi/guruh/page";
import BolaProfiliPage from "@/app/tarbiyachi/bolalar/[id]/page";
import { api, downloadFile } from "@/lib/api";
import { formatAge, formatDuration } from "@/lib/dates";
import type { AttendanceDay, MonthlyAttendance as MonthlyData, TeacherChild, TeacherChildProfile } from "@/types";
import uz from "@/i18n/uz";

// ── MOCK API — bu testlar real backend integratsiyasi EMAS ────────────────────
// Javoblar shakli backend kontraktiga mos (GET /v1/teacher/children, /attendance/monthly).

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  downloadFile: vi.fn(),
}));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

let params: { id: string } = { id: "5" };
vi.mock("next/navigation", () => ({ useParams: () => params }));
vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => <a href={href} className={className}>{children}</a>,
}));

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

beforeEach(() => {
  vi.clearAllMocks();
  params = { id: "5" };
});

// ── Sana yordamchilari ───────────────────────────────────────────────────────

describe("Sana yordamchilari", () => {
  it("yosh va uyqu davomiyligi", () => {
    expect(formatAge("2022-06-15", new Date(2026, 9, 28))).toBe("4 yosh 4 oy");
    expect(formatAge("2026-01-01", new Date(2026, 9, 28))).toBe("9 oy");
    expect(formatDuration("13:00", "15:30")).toBe("2 soat 30 daqiqa");
    expect(formatDuration("13:00", null)).toBeNull();
    expect(formatDuration("13:00", "12:00")).toBeNull();
  });
});

// ── «Sababli» modali ─────────────────────────────────────────────────────────

const DAY: AttendanceDay = {
  groups: [{ id: 7, name: "Quyosh" }],
  group: { id: 7, name: "Quyosh", age_category: "3-4 yosh", capacity: 20 },
  date: "2026-10-28",
  editable: true,
  editable_from: "2026-10-26",
  children: [
    { id: 1, first_name: "Ali",  last_name: "Valiyev", status: null, note: null },
    { id: 2, first_name: "Vali", last_name: "Aliyev",  status: "excused", excuse_reason: "kasallik", note: "Isitma" },
  ],
  summary: { total: 2, present: 0, absent: 0, excused: 1, unmarked: 1 },
};

describe("Davomat — «Sababli» modali", () => {
  it("modal bola, sana, sabab va izohni so'raydi; bo'sh izoh bilan saqlanmaydi", () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId("status-1-excused"));

    const dialog = screen.getByText(uz.davomat.sababli_sarlavha).closest("div")!.parentElement!;
    expect(within(dialog).getByText("Valiyev Ali")).toBeInTheDocument();
    expect(within(dialog).getByText("28 oktabr 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    expect(screen.getByText(uz.davomat.sabab_majburiy)).toBeInTheDocument();
    expect(screen.getByText(uz.davomat.izoh_majburiy)).toBeInTheDocument();
    expect(screen.getByTestId("status-1-excused")).toHaveAttribute("aria-pressed", "false");

    // Faqat bo'sh joylardan iborat izoh ham qabul qilinmaydi
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.sabab}`), { selector: "input, select, textarea" }), { target: { value: "boshqa" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.izoh}`), { selector: "input, select, textarea" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    expect(screen.getByText(uz.davomat.izoh_majburiy)).toBeInTheDocument();
  });

  it("bekor qilinsa holat o'zgarmaydi", () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId("status-1-excused"));
    fireEvent.click(screen.getByRole("button", { name: uz.common.bekor_qilish }));

    expect(screen.queryByText(uz.davomat.sababli_sarlavha)).toBeNull();
    expect(screen.queryByTestId("unsaved")).toBeNull();
  });

  it("saqlanganda sabab va izoh bilan yuboriladi, ro'yxatda ko'rinadi", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AttendanceSheet day={DAY} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("status-1-excused"));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.sabab}`), { selector: "input, select, textarea" }), { target: { value: "kasallik" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.izoh}`), { selector: "input, select, textarea" }), { target: { value: "  Shifokorda  " } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(screen.getByTestId("excuse-1")).toHaveTextContent(`${uz.davomat.sabab_kasallik}: Shifokorda`);
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { child_id: 1, status: "excused", excuse_reason: "kasallik", note: "Shifokorda" },
    ]));
  });

  it("mavjud sababli izohni tahrirlash — modal oldindan to'ldirilgan", () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);
    expect(screen.getByTestId("excuse-2")).toHaveTextContent(`${uz.davomat.sabab_kasallik}: Isitma`);

    fireEvent.click(screen.getByTestId("status-2-excused"));
    expect((screen.getByLabelText(new RegExp(`^${uz.davomat.sabab}`), { selector: "input, select, textarea" }) as HTMLSelectElement).value).toBe("kasallik");
    expect((screen.getByLabelText(new RegExp(`^${uz.davomat.izoh}`), { selector: "input, select, textarea" }) as HTMLTextAreaElement).value).toBe("Isitma");
  });

  it("Sababli → Keldi: izoh va sabab yuborilmaydi", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AttendanceSheet day={DAY} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("status-2-present"));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ child_id: 2, status: "present", note: null }]));
  });
});

// ── Oylik davomat ────────────────────────────────────────────────────────────

const MONTH: MonthlyData = {
  organization: { name: "QA Bog'cha" },
  group: { id: 7, name: "Quyosh" },
  groups: [{ id: 7, name: "Quyosh" }],
  month: "2026-10",
  from: "2026-10-01",
  to: "2026-10-03",
  days: [
    { date: "2026-10-01", day: 1, weekday: 4, weekend: false, future: false },
    { date: "2026-10-02", day: 2, weekday: 5, weekend: false, future: false },
    { date: "2026-10-03", day: 3, weekday: 6, weekend: true,  future: false },
  ],
  children: [
    { id: 1, first_name: "Ali", last_name: "Valiyev", middle_name: null,
      days: { "2026-10-01": { status: "present", excuse_reason: null, note: null }, "2026-10-02": { status: "excused", excuse_reason: "kasallik", note: "Isitma" } },
      totals: { present: 1, absent: 0, excused: 1, unmarked: 0 } },
    { id: 2, first_name: "Vali", last_name: "Aliyev", middle_name: null, days: {}, totals: { present: 0, absent: 0, excused: 0, unmarked: 2 } },
  ],
  totals: { present: 1, absent: 0, excused: 1, unmarked: 2, working_days: 2 },
  excused_notes: [{ date: "2026-10-02", child_id: 1, child_name: "Valiyev Ali", reason: "kasallik", note: "Isitma" }],
};

describe("Oylik davomat", () => {
  it("joriy oy bilan yuklanadi; jadval, jami va izohlar ko'rinadi", async () => {
    vi.mocked(api.get).mockResolvedValue(MONTH);
    render(<MonthlyAttendance basePath="/v1/teacher/attendance" />);

    const table = await screen.findByTestId("monthly-table");
    expect(vi.mocked(api.get).mock.calls[0][0]).toMatch(/^\/v1\/teacher\/attendance\/monthly\?month=\d{4}-\d{2}$/);
    expect(within(table).getByText("Valiyev Ali")).toBeInTheDocument();
    expect(screen.getByTestId("cell-1-2026-10-01")).toHaveTextContent("+");
    expect(screen.getByText(uz.davomat.izohlar_sarlavha).parentElement).toHaveTextContent("Valiyev Ali · Kasallik — Isitma");
  });

  it("katak bosilsa sabab va izoh ko'rsatiladi", async () => {
    vi.mocked(api.get).mockResolvedValue(MONTH);
    render(<MonthlyAttendance basePath="/v1/teacher/attendance" />);
    fireEvent.click(await screen.findByTestId("cell-1-2026-10-02"));

    expect(screen.getByTestId("cell-detail")).toHaveTextContent(`Valiyev Ali · 2 oktabr 2026 · ${uz.davomat.sababli} (${uz.davomat.sabab_kasallik}) — Isitma`);
  });

  it("bola va sana filtrlari so'rovga qo'shiladi; bola ro'yxati saqlanadi", async () => {
    vi.mocked(api.get).mockResolvedValue(MONTH);
    render(<MonthlyAttendance basePath="/v1/admin/attendance" />);
    await screen.findByTestId("monthly-table");

    vi.mocked(api.get).mockResolvedValue({ ...MONTH, children: [MONTH.children[0]] });
    fireEvent.change(screen.getByLabelText(uz.davomat.bola_filtri), { target: { value: "1" } });
    await waitFor(() => expect(vi.mocked(api.get).mock.lastCall?.[0]).toContain("child_id=1"));
    expect(within(screen.getByLabelText(uz.davomat.bola_filtri)).getAllByRole("option")).toHaveLength(3);

    fireEvent.change(screen.getByLabelText(uz.davomat.dan), { target: { value: "2026-10-02" } });
    await waitFor(() => expect(vi.mocked(api.get).mock.lastCall?.[0]).toContain("from=2026-10-02"));
  });

  it("Excel va PDF yuklab olish — filtrlar bilan; takroriy bosish bitta so'rov", async () => {
    vi.mocked(api.get).mockResolvedValue(MONTH);
    let resolve!: () => void;
    vi.mocked(downloadFile).mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
    render(<MonthlyAttendance basePath="/v1/teacher/attendance" />);
    await screen.findByTestId("monthly-table");

    const excel = screen.getByRole("button", { name: uz.davomat.excel });
    fireEvent.click(excel);
    fireEvent.click(excel);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadFile).mock.calls[0][0]).toMatch(/^\/v1\/teacher\/attendance\/export\?format=xlsx&month=\d{4}-\d{2}$/);
    resolve();
    expect(await screen.findByRole("status")).toHaveTextContent(uz.davomat.yuklab_olindi);

    vi.mocked(downloadFile).mockRejectedValueOnce(apiError(403));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.pdf }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.common.ruxsat_yoq);
  });

  it("kelajakdagi oylar tanlanmaydi", async () => {
    vi.mocked(api.get).mockResolvedValue(MONTH);
    render(<MonthlyAttendance basePath="/v1/teacher/attendance" />);
    await screen.findByTestId("monthly-table");

    const options = within(screen.getByLabelText(uz.davomat.oy)).getAllByRole("option") as HTMLOptionElement[];
    const current = new Date().getMonth() + 1;
    expect(options.filter((o) => !o.disabled).length).toBe(current);
  });

  it("xato va qayta urinish", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(MONTH);
    render(<MonthlyAttendance basePath="/v1/teacher/attendance" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.server_xatosi);
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));
    expect(await screen.findByTestId("monthly-table")).toBeInTheDocument();
  });
});

// ── Mening guruhim va bola profili ───────────────────────────────────────────

const CHILDREN: TeacherChild[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  first_name: `Bola${i + 1}`,
  last_name: i === 0 ? "Valiyev" : "Karimov",
  middle_name: null,
  birth_date: "2022-06-15",
  gender: i % 2 ? "ayol" : "erkak",
  is_active: i !== 19,
  photo_url: null,
  group: { id: 7, name: "Quyosh", age_category: "3-4 yosh" },
  contact: i === 0 ? { name: "Valiyeva Mohira", phone: "+998901112233" } : null,
}));

describe("Mening guruhim", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ groups: [{ id: 7, name: "Quyosh", age_category: "3-4 yosh", capacity: 20 }], data: CHILDREN });
  });

  it("20 nafar bola kartochkada, guruh xulosasi va profil havolalari", async () => {
    render(<MeningGuruhimPage />);
    const cards = await screen.findByTestId("children-cards");

    expect(api.get).toHaveBeenCalledWith("/v1/teacher/children");
    expect(within(cards).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByTestId("group-summary")).toHaveTextContent("Quyosh");
    expect(screen.getByTestId("group-summary")).toHaveTextContent("19 / 20");
    expect(within(cards).getByText("Valiyev Bola1").closest("a")).toHaveAttribute("href", "/tarbiyachi/bolalar/1");
  });

  it("qidiruv (ota-ona ismi bo'yicha ham) va filtrlar", async () => {
    render(<MeningGuruhimPage />);
    await screen.findByTestId("children-cards");

    fireEvent.change(screen.getByLabelText(uz.guruh.qidirish), { target: { value: "mohira" } });
    expect(within(screen.getByTestId("children-cards")).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(uz.guruh.qidirish), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(uz.guruh.holat), { target: { value: "nofaol" } });
    expect(within(screen.getByTestId("children-cards")).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(uz.guruh.holat), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(uz.guruh.jinsi), { target: { value: "ayol" } });
    expect(within(screen.getByTestId("children-cards")).getAllByRole("listitem")).toHaveLength(10);

    fireEvent.change(screen.getByLabelText(uz.guruh.qidirish), { target: { value: "yo'q-bola" } });
    expect(screen.getByText(uz.guruh.natija_yoq)).toBeInTheDocument();
  });

  it("jadval ko'rinishi", async () => {
    render(<MeningGuruhimPage />);
    await screen.findByTestId("children-cards");
    fireEvent.click(screen.getByRole("button", { name: uz.guruh.jadval }));

    const table = screen.getByTestId("children-table");
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    expect(within(table).getByText("Valiyeva Mohira · +998901112233")).toBeInTheDocument();
  });

  it("guruh biriktirilmagan va 403 holatlari", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ groups: [], data: [] });
    const { unmount } = render(<MeningGuruhimPage />);
    expect(await screen.findByText(uz.guruh.guruh_yoq)).toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockRejectedValueOnce(apiError(403, { message: "Tarbiyachi profili faol emas." }));
    render(<MeningGuruhimPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tarbiyachi profili faol emas.");
  });
});

const PROFILE: TeacherChildProfile = {
  ...CHILDREN[0],
  id: 5,
  middle_name: "Anvarovich",
  admitted_at: "2025-09-01",
  medical_notes: "Yong'oqqa allergiya",
  parents: [{ id: 3, first_name: "Mohira", last_name: "Valiyeva", phone: "+998901112233", relation_type: "ona", is_primary: true }],
};

describe("Bola profili", () => {
  it("F.I.Sh., sanalar, ota-ona, tibbiy ma'lumot va bosh harfli rasm", async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path.endsWith("/history") ? { from: "2026-10-15", to: "2026-10-28", days: [] }
        : path.startsWith("/v1/teacher/children/") ? { data: PROFILE } : MONTH);
    render(<BolaProfiliPage />);

    expect(await screen.findByRole("heading", { name: "Valiyev Bola1 Anvarovich" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/v1/teacher/children/5");
    expect(screen.getByText("1 sentabr 2025")).toBeInTheDocument();
    expect(screen.getByTestId("medical-notes")).toHaveTextContent("Yong'oqqa allergiya");
    expect(screen.getByText(`${uz.ota_onalar.rel_ona} · ${uz.guruh.asosiy}`)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "+998901112233" })[0]).toHaveAttribute("href", "tel:+998901112233");
    expect(screen.getAllByRole("img", { name: "Valiyev Bola1" })[0]).toHaveTextContent("VB");
    expect(screen.getByText(uz.guruh.rasm_yoq)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(uz.guruh.orqaga) })).toHaveAttribute("href", "/tarbiyachi/guruh");

    await waitFor(() => expect(vi.mocked(api.get).mock.calls.some(([p]) => String(p).includes("child_id=5") && String(p).includes("group_id=7"))).toBe(true));
  });

  it("begona bola — 404 xabari, qayta urinish tugmasi yo'q", async () => {
    vi.mocked(api.get).mockRejectedValue(apiError(404, { message: "Ma'lumot topilmadi." }));
    render(<BolaProfiliPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ma'lumot topilmadi.");
  });

  it("noto'g'ri ID — so'rov yuborilmaydi", async () => {
    params = { id: "abc" };
    render(<BolaProfiliPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.common.topilmadi);
    expect(api.get).not.toHaveBeenCalled();
  });
});
