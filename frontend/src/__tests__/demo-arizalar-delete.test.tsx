import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DemoArizalarPage from "@/app/admin/demo-arizalar/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

const t = uz.demo_arizalar;

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const base = {
  kindergarten_type: "xususiy", region: "Toshkent shahri", district: "Chilonzor", address: null, director_name: "Karimova",
  phone: "+998901234567", children_count: 10, groups_count: 2, comment: null, status: "new", status_label: "Yangi ariza",
  internal_note: null, handled_by: null, demo_starts_at: null, demo_ends_at: null, demo_days_left: null,
  telegram: { status: "sent", attempts: 1, sent_at: null, error: null }, created_at: "2026-11-05T10:00:00Z",
};
const rowA = { ...base, id: 1, kindergarten_name: "Quyoshcha" };
const rowB = { ...base, id: 2, kindergarten_name: "Lola" };
const meta = (total: number) => ({ current_page: 1, last_page: 1, total, counts: { new: total }, telegram_configured: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [rowA, rowB], meta: meta(2) });
});

describe("Super Admin — DEMO arizasini o'chirish", () => {
  it("tasdiqdan so'ng DELETE yuboradi va ro'yxat hamda statistikani qayta yuklaydi", async () => {
    vi.mocked(api.delete).mockResolvedValue({ message: "Ariza o'chirildi." });
    vi.mocked(api.get).mockResolvedValueOnce({ data: [rowA], meta: meta(1) });
    render(<DemoArizalarPage />);
    await screen.findByText("Lola");

    fireEvent.click(screen.getByRole("button", { name: `${t.ochirish}: Lola` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(new RegExp(t.ochirish_matn.slice(0, 20)))).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: t.ochirish }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/v1/super-admin/demo-requests/2"));
    await waitFor(() => expect(screen.queryByText("Lola")).not.toBeInTheDocument());
    expect(screen.getByText("Quyoshcha")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(t.ochirildi);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("bekor qilinsa hech narsa o'chirilmaydi", async () => {
    render(<DemoArizalarPage />);
    await screen.findByText("Lola");
    fireEvent.click(screen.getByRole("button", { name: `${t.ochirish}: Lola` }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: uz.common.bekor_qilish }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText("Lola")).toBeInTheDocument();
  });

  it("server rad etsa (409 — bog'langan ariza), xato dialogda ko'rinadi va qator qoladi", async () => {
    vi.mocked(api.delete).mockRejectedValue(Object.assign(new Error("Arizaga demo tashkilot bog'langan."), { status: 409, data: { message: "Arizaga demo tashkilot bog'langan." } }));
    render(<DemoArizalarPage />);
    await screen.findByText("Lola");
    fireEvent.click(screen.getByRole("button", { name: `${t.ochirish}: Lola` }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.ochirish }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(t.ochirish_boglangan);
    expect(screen.getByText("Lola")).toBeInTheDocument();
  });
});
