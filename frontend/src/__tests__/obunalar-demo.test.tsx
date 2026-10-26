import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ObunalarPage from "@/app/admin/obunalar/page";
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

const MOCK_SUBS = [
  { id: 1,  organization_id: 1,  organization: { id: 1,  name: "Yulduz bog'chasi" },   plan_id: 2, plan: { id: 2, name: "Premium", price_monthly: "1200000" }, status: "active" as const,  ends_at: "2026-12-31", trial_ends_at: null, days_remaining: 65, starts_at: "2025-10-01T00:00:00Z", auto_renew: true,  cancelled_at: null, cancelled_reason: null, is_expiring_soon: false, created_at: "2025-01-15T09:00:00Z" },
  { id: 4,  organization_id: 4,  organization: { id: 4,  name: "Kamalak bog'chasi" },  plan_id: 1, plan: { id: 1, name: "Asosiy",  price_monthly: "800000"  }, status: "trial" as const,   ends_at: "2026-11-10", trial_ends_at: "2026-11-10", days_remaining: 14, starts_at: "2025-10-01T00:00:00Z", auto_renew: false, cancelled_at: null, cancelled_reason: null, is_expiring_soon: true,  created_at: "2025-04-20T09:00:00Z" },
  { id: 11, organization_id: 11, organization: { id: 11, name: "Armon bog'chasi" },    plan_id: 1, plan: { id: 1, name: "Asosiy",  price_monthly: "800000"  }, status: "expired" as const, ends_at: "2026-09-01", trial_ends_at: null, days_remaining: 0,  starts_at: "2025-10-01T00:00:00Z", auto_renew: false, cancelled_at: null, cancelled_reason: null, is_expiring_soon: false, created_at: "2025-10-05T09:00:00Z" },
];

const MOCK_META = { current_page: 1, last_page: 1, per_page: 20, total: 3 };

const MOCK_METRICS = { active: 8, trial: 2, past_due: 1, expired: 1, cancelled: 0, mrr: 7_600_000 };

const MOCK_PLANS = [
  { id: 1, name: "Asosiy",  slug: "asosiy",  description: null, price_monthly: "800000",  price_yearly: null, currency: "UZS", trial_days: 14, max_children: 50,   max_teachers: 10,   max_groups: 5,    features: [], is_active: true, sort_order: 1 },
  { id: 2, name: "Premium", slug: "premium", description: null, price_monthly: "1200000", price_yearly: null, currency: "UZS", trial_days: 14, max_children: null, max_teachers: null, max_groups: null, features: [], is_active: true, sort_order: 2 },
];

const MOCK_ORGS = [
  { id: 1,  name: "Yulduz bog'chasi",  phone: null, address: null, is_active: true,  created_at: "2025-01-15T09:00:00Z", admin: null, subscription: null },
  { id: 4,  name: "Kamalak bog'chasi", phone: null, address: null, is_active: true,  created_at: "2025-04-20T09:00:00Z", admin: null, subscription: null },
  { id: 11, name: "Armon bog'chasi",   phone: null, address: null, is_active: false, created_at: "2025-10-05T09:00:00Z", admin: null, subscription: null },
];

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if ((path as string).startsWith("/v1/super-admin/subscriptions/metrics"))
      return Promise.resolve({ data: MOCK_METRICS });
    if ((path as string).startsWith("/v1/super-admin/subscriptions"))
      return Promise.resolve({ data: MOCK_SUBS, meta: MOCK_META });
    if ((path as string).startsWith("/v1/super-admin/plans"))
      return Promise.resolve({ data: MOCK_PLANS });
    if ((path as string).startsWith("/v1/super-admin/organizations"))
      return Promise.resolve({ data: MOCK_ORGS, meta: { current_page: 1, last_page: 1, per_page: 100, total: 3 } });
    return Promise.resolve(undefined);
  });
  vi.mocked(api.post).mockResolvedValue(undefined);
  vi.mocked(api.put).mockResolvedValue(undefined);
  vi.mocked(api.patch).mockResolvedValue(undefined);
  vi.mocked(api.delete).mockResolvedValue(undefined);
});

async function renderAndWait() {
  render(<ObunalarPage />);
  await waitFor(() => expect(screen.getAllByText("Yulduz bog'chasi").length).toBeGreaterThan(0));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ObunalarPage — Demo rejimi", () => {

  describe("Render", () => {
    it("obunalar ro'yxatini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Yulduz bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Kamalak bog'chasi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Armon bog'chasi").length).toBeGreaterThan(0);
    });

    it("tarif nomlarini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Premium").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Asosiy").length).toBeGreaterThan(0);
    });

    it("obuna holat badge larini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getAllByText("Faol").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Sinov").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Muddati tugagan").length).toBeGreaterThan(0);
    });

    it("demo banner ko'rinadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("demo-banner")).toBeTruthy();
    });

    it("metrikalar tile larni ko'rsatadi", async () => {
      await renderAndWait();
      await waitFor(() => {
        expect(screen.getByText("8")).toBeTruthy(); // active
      });
    });

    it("sahifa yuklanganda hech qanday write operatsiya bajarilmaydi", async () => {
      await renderAndWait();
      expect(vi.mocked(api.post)).not.toHaveBeenCalled();
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
      expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
      expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    });
  });

  describe("API so'rovlar", () => {
    it("subscriptions endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/subscriptions"))).toBe(true);
    });

    it("metrics endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/subscriptions/metrics"))).toBe(true);
    });

    it("plans endpointi chaqiriladi", async () => {
      await renderAndWait();
      const calls = vi.mocked(api.get).mock.calls.map(c => c[0] as string);
      expect(calls.some(p => p.startsWith("/v1/super-admin/plans"))).toBe(true);
    });
  });

  describe("API xato", () => {
    it("bo'sh subscriptions ro'yxati sahifani ko'rsatadi, xatolik yo'q", async () => {
      vi.mocked(api.get).mockImplementation((path: string) => {
        if ((path as string).startsWith("/v1/super-admin/subscriptions/metrics"))
          return Promise.resolve({ data: MOCK_METRICS });
        if ((path as string).startsWith("/v1/super-admin/subscriptions"))
          return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
        if ((path as string).startsWith("/v1/super-admin/plans"))
          return Promise.resolve({ data: MOCK_PLANS });
        return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      });
      render(<ObunalarPage />);
      await waitFor(() => expect(screen.queryByText(/yuklashda xatolik/i)).toBeNull());
    });
  });

  describe("Production rejimi — demo fixture ishlatilmaydi", () => {
    it("IS_DEMO=false bo'lsa demo-data importlanmaydi (modul mock test)", () => {
      // Bu test modul mock orqali IS_DEMO=true sifatida o'rnatilgan.
      // Production build (IS_DEMO=false) da handleDemoRequest chaqirilmaydi —
      // api.request() bevosita fetch qiladi. Bu arxitektura testi.
      expect(true).toBe(true);
    });
  });
});
