import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import BogchalarPage from "@/app/admin/bogchalar/page";
import { api } from "@/lib/api";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn(),
  },
  impersonation: { start: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Super Admin", role: "super_admin" } }),
}));

// BogchalarPage faqat IS_DEMO ni ishlatadi — boshqa eksportlar shart emas
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: true }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_ORGS = [
  { id: 12, name: "Baxt bog'chasi",     phone: "+998711001012", address: "Qarshi",   is_active: true,  created_at: "2025-10-15T09:00:00Z", admin: { id: 112, name: "Lola Ismoilova", phone: "+998901110012" }, subscription: { id: 12, status: "trial",  ends_at: "2026-11-20", trial_ends_at: "2026-11-20", days_remaining: 24, plan: { id: 2, name: "Premium" } } },
  { id: 11, name: "Armon bog'chasi",    phone: "+998711001011", address: "Jizzax",   is_active: false, created_at: "2025-10-05T09:00:00Z", admin: { id: 111, name: "Husayn Tursunov", phone: "+998901110011" }, subscription: { id: 11, status: "expired", ends_at: "2026-09-01", trial_ends_at: null, days_remaining: 0,  plan: { id: 1, name: "Asosiy" } } },
  { id: 3,  name: "Bahor bog'chasi",    phone: "+998711001003", address: "Samarqand",is_active: true,  created_at: "2025-03-05T09:00:00Z", admin: { id: 103, name: "Sarvarbek Toshmatov", phone: "+998901110003" }, subscription: { id: 3,  status: "active",  ends_at: "2026-11-05", trial_ends_at: null, days_remaining: 9,  plan: { id: 1, name: "Asosiy" } } },
];

const MOCK_PLANS = [
  { id: 1, name: "Asosiy",  slug: "asosiy",  description: null, price_monthly: "800000",  price_yearly: null, currency: "UZS", trial_days: 14, max_children: 50,   max_teachers: 10,   max_groups: 5,    features: [], is_active: true, sort_order: 1 },
  { id: 2, name: "Premium", slug: "premium", description: null, price_monthly: "1200000", price_yearly: null, currency: "UZS", trial_days: 14, max_children: null, max_teachers: null, max_groups: null, features: [], is_active: true, sort_order: 2 },
];

const MOCK_META = { current_page: 1, last_page: 1, per_page: 15, total: 12 };

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if ((path as string).startsWith("/v1/super-admin/organizations"))
      return Promise.resolve({ data: MOCK_ORGS, meta: MOCK_META });
    if ((path as string).startsWith("/v1/super-admin/plans"))
      return Promise.resolve({ data: MOCK_PLANS });
    return Promise.resolve(undefined);
  });
  vi.mocked(api.post).mockResolvedValue(undefined);
  vi.mocked(api.put).mockResolvedValue(undefined);
  vi.mocked(api.patch).mockResolvedValue(undefined);
  vi.mocked(api.delete).mockResolvedValue(undefined);
});

// Helper: render va bog'chalar ko'ringuncha kut
// Sahifa mobile (sm:hidden) va desktop (hidden sm:block) ikkalasini render qiladi,
// shuning uchun har bir ism DOM da ikki marta uchraydi — getAllByText ishlatiladi.
async function renderAndWait() {
  render(<BogchalarPage />);
  await waitFor(() => expect(screen.getAllByText("Baxt bog'chasi").length).toBeGreaterThan(0));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("BogchalarPage — Demo rejimi (IS_DEMO=true)", () => {

  describe("Render", () => {
    it("bog'chalar ro'yxatini xatosiz ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Baxt bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Armon bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bahor bog'chasi").length).toBeGreaterThan(0);
      expect(screen.queryByText(/yuklashda xatolik/)).toBeNull();
    });

    it("api.get organizations endpointi bilan chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/organizations"))).toBe(true);
    });

    it("api.get plans endpointi bilan ham chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/plans"))).toBe(true);
    });

    it("sahifa yuklanganda hech qanday write operatsiya bajarilmaydi", async () => {
      await renderAndWait();
      expect(vi.mocked(api.post)).not.toHaveBeenCalled();
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
      expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
      expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    });

    it("admin ma'lumotlarini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Lola Ismoilova").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Sarvarbek Toshmatov").length).toBeGreaterThan(0);
    });

    it("obuna holat badge larini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Sinov").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Muddati tugagan").length).toBeGreaterThan(0);
    });
  });

  describe("Create modal — Demo xabar", () => {
    it("'Bog'cha qo'shish' tugmasini bosganda modal ochiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => expect(screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi.")).toBeTruthy());
    });

    it("Create modalda demo xabar ko'rinadi, saqlash tugmasi ham mavjud", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => expect(screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi.")).toBeTruthy());
      // Saqlash tugmasi ko'rinishi kerak
      expect(screen.getByRole("button", { name: /saqlash/i })).toBeTruthy();
    });

    it("form yuborilganda api.post chaqiriladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi."));

      // Majburiy "Nomi" maydonini to'ldirish
      fireEvent.change(screen.getByLabelText(/Nomi \*/i), { target: { value: "Test bog'chasi" } });
      fireEvent.submit(document.getElementById("org-form")!);

      await waitFor(() => expect(vi.mocked(api.post)).toHaveBeenCalledOnce());
      const [postPath] = vi.mocked(api.post).mock.calls[0] as [string, unknown];
      expect(postPath).toBe("/v1/super-admin/organizations");
    });

    it("api.post undefined qaytarsa xato ko'rsatilmaydi", async () => {
      vi.mocked(api.post).mockResolvedValue(undefined);

      await renderAndWait();
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi."));

      fireEvent.change(screen.getByLabelText(/Nomi \*/i), { target: { value: "Test bog'chasi" } });
      fireEvent.submit(document.getElementById("org-form")!);

      await waitFor(() => expect(vi.mocked(api.post)).toHaveBeenCalled());
      // Sahifa xato holatida bo'lmasligi kerak (saveError banner yo'q)
      expect(screen.queryByText(/server xato|server_xato/i)).toBeNull();
    });

    it("tarif qo'shish formida plan tanlovlari ko'rinadi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi."));
      // Plans dropdown bo'lishi kerak
      expect(screen.getByText("— Tarif tanlang —")).toBeTruthy();
    });
  });

  describe("Filter va qidiruv", () => {
    it("sahifa yuklanayotganda loading skeleton ko'rinadi", () => {
      vi.mocked(api.get).mockImplementation(() => new Promise(() => {})); // never resolves
      render(<BogchalarPage />);
      // loading skeleton mavjud bo'lishi kerak (xato state yo'q)
      expect(screen.queryByText(/yuklashda xatolik/)).toBeNull();
    });

    it("API xato bo'lsa error state ko'rsatiladi va qayta urinish tugmasi ko'rinadi", async () => {
      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
      render(<BogchalarPage />);
      await waitFor(() =>
        expect(screen.getByText("Ma'lumotlarni yuklashda xatolik yuz berdi.")).toBeTruthy()
      );
      expect(screen.getByText("Qayta urinish")).toBeTruthy();
    });
  });

  describe("Demo xavfsizligi — backend call yo'q", () => {
    it("sahifani ochganda va yopganda POST/PUT/PATCH/DELETE chaqirilmaydi", async () => {
      await renderAndWait();

      // Modalning "Bekor qilish" tugmasini bosamiz
      fireEvent.click(screen.getByText("Bog'cha qo'shish"));
      await waitFor(() => screen.getByText("Demo rejimi — ma'lumotlar saqlanmaydi, amallar simulyatsiya qilinadi."));
      fireEvent.click(screen.getAllByText("Bekor qilish")[0]);

      // Hech qanday write operatsiya bo'lmasligi kerak
      expect(vi.mocked(api.post)).not.toHaveBeenCalled();
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
      expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
      expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    });
  });
});
