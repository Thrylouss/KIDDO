import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import InvoicesPage from "@/app/admin/invoices/page";
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

const MOCK_INVOICES = [
  { id: 1, invoice_number: "INV-2026-001", organization: { id: 1, name: "Yulduz bog'chasi" },   subscription_id: 1, amount: "1200000", currency: "UZS", status: "paid" as const,    due_at: "2026-11-01", paid_at: "2026-10-25T10:30:00Z", notes: null, created_at: "2026-10-15T09:00:00Z" },
  { id: 3, invoice_number: "INV-2026-003", organization: { id: 4, name: "Kamalak bog'chasi" },  subscription_id: 4, amount: "800000",  currency: "UZS", status: "pending" as const,  due_at: "2026-11-01", paid_at: null,                   notes: null, created_at: "2026-10-15T09:00:00Z" },
  { id: 4, invoice_number: "INV-2026-004", organization: { id: 3, name: "Bahor bog'chasi" },    subscription_id: 3, amount: "800000",  currency: "UZS", status: "overdue" as const,  due_at: "2026-10-20", paid_at: null,                   notes: null, created_at: "2026-10-01T09:00:00Z" },
];

const MOCK_SUMMARY = {
  total: 3, draft: 0, pending: 1, paid: 1, overdue: 1, cancelled: 0,
  total_pending_amount: 800_000,
  total_paid_amount:    1_200_000,
  total_overdue_amount: 800_000,
};

const MOCK_META = { current_page: 1, last_page: 1, per_page: 20, total: 3 };

const MOCK_ORGS = [
  { id: 1, name: "Yulduz bog'chasi",  phone: null, address: null, is_active: true,  created_at: "2025-01-15T09:00:00Z", admin: null, subscription: null },
  { id: 4, name: "Kamalak bog'chasi", phone: null, address: null, is_active: true,  created_at: "2025-04-20T09:00:00Z", admin: null, subscription: null },
  { id: 3, name: "Bahor bog'chasi",   phone: null, address: null, is_active: true,  created_at: "2025-03-05T09:00:00Z", admin: null, subscription: null },
];

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if ((path as string).startsWith("/v1/super-admin/invoices"))
      return Promise.resolve({ data: MOCK_INVOICES, meta: MOCK_META, summary: MOCK_SUMMARY });
    if ((path as string).startsWith("/v1/super-admin/organizations"))
      return Promise.resolve({ data: MOCK_ORGS, meta: { current_page: 1, last_page: 1, per_page: 100, total: 3 } });
    return Promise.resolve(undefined);
  });
  vi.mocked(api.post).mockResolvedValue(undefined);
  vi.mocked(api.put).mockResolvedValue(undefined);
  vi.mocked(api.patch).mockResolvedValue(undefined);
  vi.mocked(api.delete).mockResolvedValue(undefined);
});

// Helper: render va invoicelar ko'ringuncha kut.
// Desktop va mobile ikkalasi render qilinadi — getAllByText ishlatiladi.
async function renderAndWait() {
  render(<InvoicesPage />);
  await waitFor(() => expect(screen.getAllByText("INV-2026-001").length).toBeGreaterThan(0));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("InvoicesPage — Demo rejimi (IS_DEMO=true)", () => {

  describe("Render", () => {
    it("hisob-fakturalar ro'yxatini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("INV-2026-001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("INV-2026-003").length).toBeGreaterThan(0);
      expect(screen.getAllByText("INV-2026-004").length).toBeGreaterThan(0);
    });

    it("bog'cha nomlarini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Yulduz bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Kamalak bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bahor bog'chasi").length).toBeGreaterThan(0);
    });

    it("holat badge larini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("To'langan").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Muddati o'tgan").length).toBeGreaterThan(0);
    });

    it("demo banner ko'rinadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("demo-banner")).toBeTruthy();
    });

    it("summary tiles '—' ko'rsatmaydi (summary yuklangan)", async () => {
      await renderAndWait();
      // total: 3 — unique number in this fixture
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
    it("invoices endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/invoices"))).toBe(true);
    });

    it("organizations endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/organizations"))).toBe(true);
    });
  });

  describe("Xato holatlar", () => {
    it("bo'sh invoices ro'yxati sahifani ko'rsatadi, xatolik yo'q", async () => {
      vi.mocked(api.get).mockImplementation((path: string) => {
        if ((path as string).startsWith("/v1/super-admin/invoices"))
          return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 }, summary: undefined });
        return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      });
      render(<InvoicesPage />);
      await waitFor(() => expect(screen.queryByText(/yuklashda xatolik/i)).toBeNull());
    });
  });
});
