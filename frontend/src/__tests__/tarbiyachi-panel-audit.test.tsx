import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TarbiyachiSozlamalarPage from "@/app/tarbiyachi/sozlamalar/page";
import TarbiyachiFotoPage from "@/app/tarbiyachi/foto/page";
import TarbiyachiDashboardPage from "@/app/tarbiyachi/dashboard/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

// ── MOCK API — javob shakli backend kontraktiga mos (GET /v1/teacher/dashboard, /v1/teacher/photos) ──
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  uploadFile: vi.fn(),
}));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 30, name: "Dilnoza Karimova", role: "teacher", username: "dilnoza", phone: "+998901110001" }, updateUser: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const DASHBOARD = {
  teacher: { id: 3, name: "Dilnoza Karimova", position: "Katta tarbiyachi" },
  groups: [{ id: 7, name: "Quyosh" }, { id: 8, name: "Oy" }],
  group: { id: 7, name: "Quyosh", age_category: "3-4 yosh", capacity: 20 },
  date: "2026-11-06", editable: true, editable_from: "2026-10-07",
  children: [], summary: { total: 0, present: 0, absent: 0, excused: 0, unmarked: 0 },
};

const photo = (id: number, can_delete: boolean) => ({
  id, url: `/api/v1/teacher/photos/${id}/file`, caption: `Rasm ${id}`, taken_on: "2026-11-06",
  group: { id: 7, name: "Quyosh" }, uploaded_by: can_delete ? "Dilnoza Karimova" : "Hamkasb", can_delete,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("Tarbiyachi sozlamalari — ish profili", () => {
  it("lavozim va biriktirilgan guruhlar ko'rsatiladi; parol formasi saqlanadi", async () => {
    vi.mocked(api.get).mockResolvedValue(DASHBOARD);
    render(<TarbiyachiSozlamalarPage />);

    const profile = await screen.findByTestId("teacher-profile");
    expect(profile).toHaveTextContent("Katta tarbiyachi");
    expect(profile).toHaveTextContent("Quyosh, Oy");
    expect(api.get).toHaveBeenCalledWith("/v1/teacher/dashboard");
    expect(screen.getByText(uz.sozlamalar.xavfsizlik)).toBeInTheDocument();
    expect(screen.getByText("dilnoza")).toBeInTheDocument();
  });

  it("guruh biriktirilmagan va xato holatlari", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ ...DASHBOARD, groups: [], group: null, teacher: { ...DASHBOARD.teacher, position: null } });
    const { unmount } = render(<TarbiyachiSozlamalarPage />);
    expect(await screen.findByText(uz.sozlamalar.guruh_biriktirilmagan)).toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    render(<TarbiyachiSozlamalarPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.common.yuklash_xatosi);
  });
});

describe("Tarbiyachi fotogalereyasi — ruxsatsiz tugmalar ko'rinmaydi", () => {
  it("hamkasb rasmida «O'chirish» yo'q, o'z rasmida bor va DELETE yuboriladi", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [photo(1, false), photo(2, true)], meta: { current_page: 1, last_page: 1, total: 2 }, groups: [{ id: 7, name: "Quyosh" }] });
    vi.mocked(api.delete).mockResolvedValue({});
    render(<TarbiyachiFotoPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rasm 1" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: uz.foto.ochirish })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Rasm 2" }));
    fireEvent.click(await screen.findByRole("button", { name: uz.foto.ochirish }));
    const confirm = await screen.findAllByRole("button", { name: uz.foto.ochirish });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/v1/teacher/photos/2"));
    expect(api.delete).not.toHaveBeenCalledWith("/v1/teacher/photos/1");
  });

  it("yuklash tugmasi faqat guruh biriktirilgan bo'lsa", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, groups: [] });
    render(<TarbiyachiFotoPage />);
    expect(await screen.findByText(uz.foto.bosh)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: uz.foto.yuklash })).toBeNull();
  });
});

describe("Tarbiyachi bosh sahifasi — tezkor havolalar", () => {
  it("guruh, kundalik, xabarlar va foto sahifalariga olib boradi", async () => {
    vi.mocked(api.get).mockResolvedValue(DASHBOARD);
    render(<TarbiyachiDashboardPage />);
    expect(await screen.findByTestId("group-card")).toHaveTextContent("Quyosh");
    const nav = screen.getByRole("navigation", { name: uz.tarbiyachi_panel.tez_amallar });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/tarbiyachi/guruh", "/tarbiyachi/kundalik", "/tarbiyachi/xabarlar", "/tarbiyachi/foto"]);
  });
});
