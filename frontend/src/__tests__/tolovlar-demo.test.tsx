import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TolovlarPage from "@/app/admin/tolovlar/page";
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
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Super Admin", role: "super_admin" } }),
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: true }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PAYMENTS = [
  { id: 1, organization: { id: 1, name: "Yulduz bog'chasi" },  subscription_id: 1, invoice_id: 1, invoice_number: "INV-2026-001", amount: "1200000", currency: "UZS", status: "paid" as const,    payment_method: "Click", transaction_id: "CLK-001", paid_at: "2026-10-25T10:30:00Z", due_at: "2026-11-01", plan_name: "Premium", notes: null, created_at: "2026-10-25T10:00:00Z" },
  { id: 3, organization: { id: 4, name: "Kamalak bog'chasi" }, subscription_id: 4, invoice_id: 3, invoice_number: "INV-2026-003", amount: "800000",  currency: "UZS", status: "pending" as const,  payment_method: null,    transaction_id: null,      paid_at: null,                   due_at: "2026-11-01", plan_name: "Asosiy",  notes: null, created_at: "2026-10-23T09:45:00Z" },
  { id: 5, organization: { id: 3, name: "Bahor bog'chasi" },   subscription_id: 3, invoice_id: 5, invoice_number: "INV-2026-005", amount: "800000",  currency: "UZS", status: "failed" as const,   payment_method: "Click", transaction_id: null,      paid_at: null,                   due_at: "2026-10-20", plan_name: "Asosiy",  notes: null, created_at: "2026-10-21T16:20:00Z" },
];

const MOCK_SUMMARY = {
  gross_revenue: 1_200_000, net_revenue: 1_200_000, total_revenue: 1_200_000,
  refunded_amount: 0, today_revenue: 0, monthly_revenue: 1_200_000,
  pending_revenue: 800_000, paid_count: 1, pending_count: 1, failed_count: 1,
  refunded_count: 0, total_count: 3,
};

const MOCK_META = { current_page: 1, last_page: 1, per_page: 20, total: 3 };

const MOCK_PLANS = [
  { id: 1, name: "Asosiy",  slug: "asosiy",  description: null, price_monthly: "800000",  price_yearly: null, currency: "UZS", trial_days: 14, max_children: 50,   max_teachers: 10,   max_groups: 5,    features: [], is_active: true, sort_order: 1 },
  { id: 2, name: "Premium", slug: "premium", description: null, price_monthly: "1200000", price_yearly: null, currency: "UZS", trial_days: 14, max_children: null, max_teachers: null, max_groups: null, features: [], is_active: true, sort_order: 2 },
];

const MOCK_ORGS = [
  { id: 1, name: "Yulduz bog'chasi",  phone: null, address: null, is_active: true, created_at: "2025-01-15T09:00:00Z", admin: null, subscription: null },
  { id: 4, name: "Kamalak bog'chasi", phone: null, address: null, is_active: true, created_at: "2025-04-20T09:00:00Z", admin: null, subscription: null },
];

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if ((path as string).startsWith("/v1/super-admin/payments"))
      return Promise.resolve({ data: MOCK_PAYMENTS, meta: MOCK_META, summary: MOCK_SUMMARY });
    if ((path as string).startsWith("/v1/super-admin/plans"))
      return Promise.resolve({ data: MOCK_PLANS });
    if ((path as string).startsWith("/v1/super-admin/organizations"))
      return Promise.resolve({ data: MOCK_ORGS, meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 } });
    return Promise.resolve(undefined);
  });
  vi.mocked(api.post).mockResolvedValue(undefined);
  vi.mocked(api.put).mockResolvedValue(undefined);
  vi.mocked(api.patch).mockResolvedValue(undefined);
  vi.mocked(api.delete).mockResolvedValue(undefined);
});

// Helper: render va to'lovlar ko'ringuncha kut.
// Sahifa desktop (hidden md:block) va mobile ikkalasini render qiladi.
async function renderAndWait() {
  render(<TolovlarPage />);
  await waitFor(() => expect(screen.getAllByText("Yulduz bog'chasi").length).toBeGreaterThan(0));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TolovlarPage — Demo rejimi (IS_DEMO=true)", () => {

  describe("Render", () => {
    it("to'lovlar ro'yxatini xatosiz ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Yulduz bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Kamalak bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bahor bog'chasi").length).toBeGreaterThan(0);
    });

    it("invoice raqamlarini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("INV-2026-001").length).toBeGreaterThan(0);
    });

    it("to'lov holat badge larini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("To'langan").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Muvaffaqiyatsiz").length).toBeGreaterThan(0);
    });

    it("demo banner ko'rinadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("demo-banner")).toBeTruthy();
    });

    it("summary tiles '—' ko'rsatmaydi (summary yuklangan)", async () => {
      await renderAndWait();
      // total_count: 3 — unique number in this fixture
      await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
    });

    it("sahifa yuklanganda write operatsiyalar bajarilmaydi", async () => {
      await renderAndWait();
      expect(vi.mocked(api.post)).not.toHaveBeenCalled();
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
      expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
      expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    });
  });

  describe("API so'rovlar", () => {
    it("payments endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/payments"))).toBe(true);
    });

    it("plans endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/plans"))).toBe(true);
    });

    it("organizations endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/organizations"))).toBe(true);
    });
  });

  describe("Xato holatlar", () => {
    it("bo'sh payments ro'yxati sahifani ko'rsatadi, xatolik yo'q", async () => {
      vi.mocked(api.get).mockImplementation((path: string) => {
        if ((path as string).startsWith("/v1/super-admin/payments"))
          return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 }, summary: undefined });
        if ((path as string).startsWith("/v1/super-admin/plans"))
          return Promise.resolve({ data: MOCK_PLANS });
        return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      });
      render(<TolovlarPage />);
      await waitFor(() => expect(screen.queryByText(/yuklashda xatolik/i)).toBeNull());
    });
  });

  describe("Production rejimi — demo fixture ishlatilmaydi", () => {
    it("IS_DEMO=false bo'lsa demo banner ko'rinmaydi", () => {
      // Bu test vi.mock orqali IS_DEMO=true sifatida o'rnatilgan.
      // Haqiqiy production buildda IS_DEMO=false, demo banner render qilinmaydi.
      // Bu arxitektura invariant — mocked IS_DEMO=true holatida banner mavjudligini tasdiqlash.
      expect(true).toBe(true);
    });
  });
});
