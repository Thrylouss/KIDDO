import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DashboardPage from "@/app/admin/dashboard/page";
import { api } from "@/lib/api";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockSummary = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  jami_bogchalar: 15,
  faol_bogchalar: 12,
  nofaol_bogchalar: 3,
  yangi_bogchalar: 4,
  muddati_yaqin: 2,
  tolov_kutilmoqda: 3,
  jami_foydalanuvchilar: 45,
  oxirgi_bogchalar: [
    {
      id: 1,
      name: "Yulduzcha Bog'cha",
      phone: "+998901234567",
      is_active: true,
      created_at: "2026-09-01T10:00:00Z",
      subscription: { status: "active", ends_at: "2026-12-31", plan: "Premium" },
    },
    {
      id: 2,
      name: "Bahor Bog'cha",
      phone: null,
      is_active: false,
      created_at: "2026-09-10T10:00:00Z",
      subscription: null,
    },
  ],
  obuna_holati: { active: 10, trial: 2, past_due: 1, expired: 1, cancelled: 1 },
  billing: {
    mrr: 4990000,
    arr: 59880000,
    monthly_revenue: 4500000,
    pending_revenue: 1200000,
    period_paid: 3500000,
    prev_period_paid: 2800000,
    total_paid: 45000000,
    total_refunded: 500000,
  },
};

const mockRevenue = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  group_by: "day" as const,
  series: [
    { period: "2026-09-01", label: "01/09", total: 499000, count: 1 },
    { period: "2026-09-15", label: "15/09", total: 998000, count: 2 },
  ],
  total: 1497000,
  by_plan: [
    { plan_name: "Premium",  total: 998000 },
    { plan_name: "Standart", total: 499000 },
  ],
  by_method: [{ method: "manual", count: 3, total: 1497000 }],
};

const mockSubscriptions = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  status_distribution: { active: 10, trial: 2, past_due: 1, expired: 1, cancelled: 1 },
  plan_distribution: [
    { plan_id: 1, plan_name: "Premium",  count: 8 },
    { plan_id: 2, plan_name: "Standart", count: 4 },
  ],
  new_in_period: 3,
  cancelled_in_period: 0,
  expired_in_period: 1,
  expiring_soon: 2,
  mrr: 4990000,
  arr: 59880000,
};

const mockRecent = {
  payments: [
    {
      id: 1,
      organization: { id: 1, name: "Yulduzcha Bog'cha" },
      amount: "499000",
      currency: "UZS",
      status: "paid",
      payment_method: "manual",
      paid_at: "2026-09-20T10:00:00Z",
      created_at: "2026-09-20T10:00:00Z",
    },
    {
      id: 2,
      organization: { id: 2, name: "Bahor Bog'cha" },
      amount: "299000",
      currency: "UZS",
      status: "pending",
      payment_method: null,
      paid_at: null,
      created_at: "2026-09-21T10:00:00Z",
    },
  ],
  invoices: [
    {
      id: 1,
      invoice_number: "INV-0001",
      organization: { id: 1, name: "Yulduzcha Bog'cha" },
      amount: "499000",
      currency: "UZS",
      status: "paid",
      due_at: "2026-09-30T00:00:00Z",
      paid_at: "2026-09-20T10:00:00Z",
      created_at: "2026-09-01T10:00:00Z",
    },
  ],
  activity: [
    {
      id: 1,
      action: "subscription.created",
      description: "Obuna yaratildi: org #1",
      created_at: "2026-09-20T10:00:00Z",
      user: { id: 1, name: "Admin User" },
      organization: { id: 1, name: "Yulduzcha Bog'cha" },
    },
  ],
};

// ── Setup ──────────────────────────────────────────────────────────

function setupMocks() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("/dashboard/recent"))      return Promise.resolve(mockRecent);
    if (url.includes("/dashboard"))             return Promise.resolve(mockSummary);
    if (url.includes("/reports/revenue"))       return Promise.resolve(mockRevenue);
    if (url.includes("/reports/subscriptions")) return Promise.resolve(mockSubscriptions);
    return Promise.reject(new Error(`Unexpected: ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  it("renders page title", async () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.getByText("Super Admin")).toBeTruthy();
  });

  it("shows date filter presets", async () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.getByText("Shu hafta")).toBeTruthy();
    expect(screen.getByText("Shu oy")).toBeTruthy();
    expect(screen.getByText("O'tgan oy")).toBeTruthy();
    expect(screen.getByText("Shu yil")).toBeTruthy();
    expect(screen.getByText("Maxsus")).toBeTruthy();
  });

  it("shows skeleton while loading", () => {
    setupMocks();
    render(<DashboardPage />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders KPI cards after load", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("15")).toBeTruthy();   // jami_bogchalar
    });
    expect(screen.getByText("12")).toBeTruthy();     // faol_bogchalar
    expect(screen.getByText("45")).toBeTruthy();     // foydalanuvchilar
    // "4" appears in multiple places (yangi_bogchalar + plan distribution count)
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("renders billing MRR KPI", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/4 990 000/)).toBeTruthy();
    });
  });

  it("renders period trend badge when prev period exists", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      // trend: (3500000-2800000)/2800000 = 25%
      expect(screen.getByText(/25\.0%/)).toBeTruthy();
    });
  });

  it("renders recent orgs table with org name", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      // Org appears in both recent-orgs table and recent-payments list
      expect(screen.getAllByText("Yulduzcha Bog'cha").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Bahor Bog'cha").length).toBeGreaterThan(0);
  });

  it("renders subscription distribution bars", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Obuna holati")).toBeTruthy();
    });
  });

  it("renders revenue trend section", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Daromad dinamikasi")).toBeTruthy();
    });
  });

  it("renders plan distribution from subs report", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Tarif taqsimoti")).toBeTruthy();
    });
  });

  it("renders recent payments section", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("So'nggi to'lovlar")).toBeTruthy();
    });
  });

  it("renders recent invoices section", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("So'nggi hisob-fakturalar")).toBeTruthy();
    });
  });

  it("renders recent activity section with description", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("So'nggi faoliyat")).toBeTruthy();
    });
    expect(screen.getByText("Obuna yaratildi: org #1")).toBeTruthy();
  });

  it("renders quick actions links", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Tezkor harakatlar")).toBeTruthy();
    });
    expect(screen.getByText("Bog'chalarni boshqarish")).toBeTruthy();
    expect(screen.getByText("Hisobotlarni ko'rish")).toBeTruthy();
  });

  it("renders invoice number in invoices list", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("INV-0001")).toBeTruthy();
    });
  });

  it("switches to custom preset and shows date inputs", async () => {
    setupMocks();
    render(<DashboardPage />);
    fireEvent.click(screen.getByText("Maxsus"));
    await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="date"]');
      expect(inputs.length).toBe(2);
    });
  });

  it("shows filter button for custom preset", async () => {
    setupMocks();
    render(<DashboardPage />);
    fireEvent.click(screen.getByText("Maxsus"));
    await waitFor(() => {
      expect(screen.getByText("Filtrlash")).toBeTruthy();
    });
  });

  it("reloads data when preset changes to Shu hafta", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("15")).toBeTruthy());

    fireEvent.click(screen.getByText("Shu hafta"));
    await waitFor(() => {
      // api.get should have been called multiple times due to re-render
      expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("shows error state and retry when api fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(<DashboardPage />);
    await waitFor(() => {
      const retryBtns = screen.getAllByText("Qayta urinish");
      expect(retryBtns.length).toBeGreaterThan(0);
    });
  });

  it("calls /dashboard endpoint for KPIs", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("15")).toBeTruthy());
    const dashCalls = vi.mocked(api.get).mock.calls
      .filter(([url]) => (url as string).includes("/dashboard") && !(url as string).includes("recent") && !(url as string).includes("revenue"));
    expect(dashCalls.length).toBeGreaterThan(0);
  });

  it("calls /reports/revenue endpoint for revenue chart", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Daromad dinamikasi")).toBeTruthy());
    const revCalls = vi.mocked(api.get).mock.calls
      .filter(([url]) => (url as string).includes("/reports/revenue"));
    expect(revCalls.length).toBeGreaterThan(0);
  });

  it("calls /dashboard/recent endpoint for recent items", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("So'nggi to'lovlar")).toBeTruthy());
    const recentCalls = vi.mocked(api.get).mock.calls
      .filter(([url]) => (url as string).includes("/dashboard/recent"));
    expect(recentCalls.length).toBeGreaterThan(0);
  });

  it("renders by_plan breakdown in revenue section", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Tarif bo'yicha daromad")).toBeTruthy();
    });
    // By plan data appears
    const premiumEntries = screen.getAllByText("Premium");
    expect(premiumEntries.length).toBeGreaterThan(0);
  });

  it("renders paid badge for paid payment", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      const badges = screen.getAllByText("To'langan");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("renders pending badge for pending payment", async () => {
    setupMocks();
    render(<DashboardPage />);
    await waitFor(() => {
      const badges = screen.getAllByText("Kutilmoqda");
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
