import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DemoArizalarPage from "@/app/admin/demo-arizalar/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

const t = uz.demo_arizalar;

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const row = {
  id: 5, kindergarten_name: "Quyoshcha", kindergarten_type: "xususiy", region: "Toshkent shahri", district: "Chilonzor",
  address: null, director_name: "Karimova Dilnoza", phone: "+998901234567", children_count: 120, groups_count: 6,
  comment: "Davomat qiziq", status: "new", status_label: "Yangi ariza", internal_note: null, handled_by: null,
  demo_starts_at: null, demo_ends_at: null, demo_days_left: null,
  telegram: { status: "failed", attempts: 1, sent_at: null, error: "api.telegram.org manzili topilmadi (DNS / ENOTFOUND)" },
  created_at: "2026-11-05T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [row], meta: { current_page: 1, last_page: 1, total: 1, counts: { new: 1 }, telegram_configured: false } });
});

describe("Super Admin — DEMO arizalari", () => {
  it("ro'yxat: bog'cha, rahbar, telefon, hudud, soni, holat va Telegram holati", async () => {
    render(<DemoArizalarPage />);
    expect(await screen.findByText("Quyoshcha")).toBeInTheDocument();
    expect(screen.getByText("Karimova Dilnoza")).toBeInTheDocument();
    expect(screen.getByText("+998901234567")).toBeInTheDocument();
    expect(screen.getByText("120 / 6")).toBeInTheDocument();
    expect(screen.getAllByText("Yangi ariza").length).toBeGreaterThan(0);
    expect(screen.getByText(t.tg_failed)).toBeInTheDocument();
    expect(screen.getByTestId("tg-not-configured")).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls[0][0]).toMatch(/^\/v1\/super-admin\/demo-requests\?/);
  });

  it("holat bo'yicha filtr", async () => {
    render(<DemoArizalarPage />);
    await screen.findByText("Quyoshcha");
    fireEvent.click(screen.getByRole("tab", { name: /Demo faol/ }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[0]).toContain("status=active"));
  });

  it("ko'rish, holatni o'zgartirish va ichki qayd", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...row, status: "active", status_label: "Demo faol", internal_note: "Qo'ng'iroq qilindi",
      demo_starts_at: "2026-11-05T10:00:00Z", demo_ends_at: "2026-11-19T10:00:00Z", demo_days_left: 14 } });
    render(<DemoArizalarPage />);
    fireEvent.click(await screen.findByRole("button", { name: t.korish }));
    const dialog = document.body;
    await screen.findByLabelText(t.ichki_qayd);
    expect(within(dialog).getByText("Davomat qiziq")).toBeInTheDocument();
    expect(within(dialog).getByText(/ENOTFOUND/)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(t.holatni_ozgartirish), { target: { value: "active" } });
    fireEvent.change(within(dialog).getByLabelText(t.ichki_qayd), { target: { value: "Qo'ng'iroq qilindi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: t.saqlash }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/super-admin/demo-requests/5", { status: "active", internal_note: "Qo'ng'iroq qilindi" }));
    expect(await screen.findByTestId("demo-period")).toHaveTextContent("14 kun qoldi");
  });

  it("Telegramga qayta yuborish", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...row, telegram: { ...row.telegram, status: "sent", attempts: 2, error: null } }, message: "Telegramga yuborildi." });
    render(<DemoArizalarPage />);
    fireEvent.click(await screen.findByRole("button", { name: t.korish }));
    fireEvent.click(await screen.findByRole("button", { name: t.qayta_yuborish }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/super-admin/demo-requests/5/retry-telegram"));
    expect(await screen.findByText("Telegramga yuborildi.")).toBeInTheDocument();
  });
});
