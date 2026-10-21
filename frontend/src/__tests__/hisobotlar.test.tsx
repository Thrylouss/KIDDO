import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import HisobotlarPage from "@/app/admin/hisobotlar/page";
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

const mockOverview = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  organizations: { total: 15, active: 12, inactive: 3, new: 4 },
  subscriptions: { active: 10, trial: 2, past_due: 1, expired: 1, cancelled: 1, new: 3, mrr: 4990000, arr: 59880000 },
  revenue: {
    total_paid: 9980000, total_pending: 1000000, total_refunded: 500000,
    gross_revenue: 10480000, period_paid: 4990000, period_pending: 500000,
    avg_revenue_per_org: 832000,
  },
  invoices: {
    total: 20, draft: 2, pending: 5, paid: 10, overdue: 2, cancelled: 1,
    paid_amount: 9980000, pending_amount: 1500000,
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
    { plan_name: "Premium", total: 998000 },
    { plan_name: "Standart", total: 499000 },
  ],
  by_method: [
    { method: "manual", count: 2, total: 1000000 },
    { method: "payme",  count: 1, total: 497000 },
  ],
};

const mockSubscriptions = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  status_distribution: { active: 10, trial: 2, past_due: 1, expired: 1, cancelled: 1 },
  plan_distribution: [
    { plan_id: 1, plan_name: "Premium",  count: 8 },
    { plan_id: 2, plan_name: "Standart", count: 4 },
  ],
  new_in_period: 3,
  cancelled_in_period: 1,
  expired_in_period: 0,
  expiring_soon: 2,
  mrr: 4990000,
  arr: 59880000,
};

const mockOrganizations = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  counts: { total: 15, active: 12, inactive: 3, new_in_period: 4, with_unpaid_invoices: 3, with_expired_subs: 1 },
  plan_distribution: [
    { plan_id: 1, plan_name: "Premium",  count: 8 },
    { plan_id: 2, plan_name: "Standart", count: 4 },
  ],
  growth_series: Array.from({ length: 12 }, (_, i) => ({
    period: `2026-${String(i + 1).padStart(2, "0")}`,
    label:  `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]} 2026`,
    count:  i + 1,
  })),
};

const mockUsers = {
  period: { from: "2026-09-01", to: "2026-09-27" },
  counts: { total: 50, active: 45, inactive: 5, new_in_period: 7 },
  by_role: { super_admin: 1, admin: 15, teacher: 20, parent: 14 },
  by_organization: [
    { organization_id: 1, organization_name: "Bog'cha Yulduz", count: 5 },
    { organization_id: 2, organization_name: "Bog'cha Bahor",  count: 3 },
  ],
};

const mockPlans = {
  data: [
    { id: 1, name: "Premium",  slug: "premium",  description: null, price_monthly: "499000", price_yearly: null, currency: "UZS", trial_days: 14, max_children: null, max_teachers: null, max_groups: null, features: [], is_active: true, sort_order: 1 },
    { id: 2, name: "Standart", slug: "standart", description: null, price_monthly: "299000", price_yearly: null, currency: "UZS", trial_days: 7,  max_children: null, max_teachers: null, max_groups: null, features: [], is_active: true, sort_order: 2 },
  ],
};

// ── Setup ──────────────────────────────────────────────────────────

function setupMocks() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("/plans"))                return Promise.resolve(mockPlans);
    if (url.includes("reports/overview"))      return Promise.resolve(mockOverview);
    if (url.includes("reports/revenue"))       return Promise.resolve(mockRevenue);
    if (url.includes("reports/subscriptions")) return Promise.resolve(mockSubscriptions);
    if (url.includes("reports/organizations")) return Promise.resolve(mockOrganizations);
    if (url.includes("reports/users"))         return Promise.resolve(mockUsers);
    return Promise.resolve({});
  });
}

async function renderPage() {
  setupMocks();
  render(<HisobotlarPage />);
  await waitFor(() => expect(screen.getByText("Hisobotlar")).toBeDefined());
  await waitFor(() => expect(screen.queryAllByText("Yuklanmoqda...").length).toBe(0), { timeout: 3000 });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("HisobotlarPage — rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders page title", async () => {
    await renderPage();
    expect(screen.getByText("Hisobotlar")).toBeDefined();
  });

  it("renders date preset buttons", async () => {
    await renderPage();
    expect(screen.getByText("Bugun")).toBeDefined();
    expect(screen.getByText("Shu hafta")).toBeDefined();
    expect(screen.getByText("Shu oy")).toBeDefined();
    expect(screen.getByText("O'tgan oy")).toBeDefined();
    expect(screen.getByText("Shu yil")).toBeDefined();
    expect(screen.getByText("Maxsus")).toBeDefined();
  });

  it("renders all 5 tab buttons", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "Umumiy" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Daromad" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Obunalar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Tashkilotlar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Foydalanuvchilar" })).toBeDefined();
  });
});

describe("HisobotlarPage — Overview tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads overview data on mount", async () => {
    await renderPage();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(
      expect.stringContaining("reports/overview")
    );
  });

  it("shows organization KPI cards", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("15")).toBeDefined(); // total orgs
    });
  });

  it("shows MRR value in subscriptions section", async () => {
    await renderPage();
    await waitFor(() => {
      const mrrEls = screen.getAllByText(/4.*990.*000.*UZS/);
      expect(mrrEls.length).toBeGreaterThan(0);
    });
  });

  it("shows revenue KPI values", async () => {
    await renderPage();
    await waitFor(() => {
      // total_paid = 9,980,000 UZS appears in the revenue section
      const els = screen.queryAllByText(/9.*980.*000.*UZS/);
      expect(els.length).toBeGreaterThan(0);
    });
  });

  it("shows invoice total count", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("20").length).toBeGreaterThan(0); // invoice total
    });
  });
});

describe("HisobotlarPage — Revenue tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads revenue data when switching to Revenue tab", async () => {
    await renderPage();
    vi.clearAllMocks();
    setupMocks();

    fireEvent.click(screen.getByRole("button", { name: "Daromad" }));

    await waitFor(() => {
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        expect.stringContaining("reports/revenue")
      );
    });
  });

  it("shows by plan section after loading revenue", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Daromad" }));

    await waitFor(() => {
      expect(screen.getByText("Tarif bo'yicha daromad")).toBeDefined();
    });
  });

  it("shows Premium plan in revenue by plan", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Daromad" }));

    await waitFor(() => {
      expect(screen.getAllByText("Premium").length).toBeGreaterThan(0);
    });
  });

  it("shows payment method distribution", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Daromad" }));

    await waitFor(() => {
      expect(screen.getByText("To'lov usuli taqsimoti")).toBeDefined();
    });
  });
});

describe("HisobotlarPage — Subscriptions tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads subscription data when tab is clicked", async () => {
    await renderPage();
    vi.clearAllMocks();
    setupMocks();

    fireEvent.click(screen.getByRole("button", { name: "Obunalar" }));

    await waitFor(() => {
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        expect.stringContaining("reports/subscriptions")
      );
    });
  });

  it("shows status distribution section", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obunalar" }));

    await waitFor(() => {
      expect(screen.getAllByText("Holat taqsimoti").length).toBeGreaterThan(0);
    });
  });

  it("shows plan distribution section", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obunalar" }));

    await waitFor(() => {
      expect(screen.getAllByText("Tarif taqsimoti").length).toBeGreaterThan(0);
    });
  });

  it("shows expiring soon count", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obunalar" }));

    await waitFor(() => {
      expect(screen.getByText("30 kun ichida tugaydi")).toBeDefined();
    });
  });
});

describe("HisobotlarPage — Organizations tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads org data when tab is clicked", async () => {
    await renderPage();
    vi.clearAllMocks();
    setupMocks();

    fireEvent.click(screen.getByRole("button", { name: "Tashkilotlar" }));

    await waitFor(() => {
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        expect.stringContaining("reports/organizations")
      );
    });
  });

  it("shows organization growth chart title", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tashkilotlar" }));

    await waitFor(() => {
      expect(screen.getByText("Tashkilotlar o'sishi (12 oy)")).toBeDefined();
    });
  });

  it("shows orgs with unpaid invoices count", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tashkilotlar" }));

    await waitFor(() => {
      expect(screen.getByText("To'lanmagan invoice bor")).toBeDefined();
    });
  });
});

describe("HisobotlarPage — Users tab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads user data when tab is clicked", async () => {
    await renderPage();
    vi.clearAllMocks();
    setupMocks();

    fireEvent.click(screen.getByRole("button", { name: "Foydalanuvchilar" }));

    await waitFor(() => {
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        expect.stringContaining("reports/users")
      );
    });
  });

  it("shows role distribution section", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Foydalanuvchilar" }));

    await waitFor(() => {
      expect(screen.getByText("Rol bo'yicha taqsimot")).toBeDefined();
    });
  });

  it("shows top organizations table", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Foydalanuvchilar" }));

    await waitFor(() => {
      expect(screen.getByText("Tashkilot bo'yicha (top 10)")).toBeDefined();
    });
  });

  it("shows org names in user distribution table", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Foydalanuvchilar" }));

    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });
  });

  it("shows total user count", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Foydalanuvchilar" }));

    await waitFor(() => {
      expect(screen.getAllByText("50").length).toBeGreaterThan(0);
    });
  });
});

describe("HisobotlarPage — date preset filter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking Bugun preset changes active state", async () => {
    await renderPage();
    const bugunBtn = screen.getByText("Bugun");
    fireEvent.click(bugunBtn);
    // Button should have active styling class after click
    expect(bugunBtn.className).toContain("bg-[#8E315D]");
  });

  it("clicking Maxsus shows custom date inputs", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Maxsus"));
    await waitFor(() => {
      expect(screen.getByText("Boshlanish:")).toBeDefined();
      expect(screen.getByText("Tugash:")).toBeDefined();
    });
  });

  it("custom range apply button is disabled without dates", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Maxsus"));
    await waitFor(() => {
      const btn = screen.getByText("Filtrlash");
      expect(btn.hasAttribute("disabled")).toBe(true);
    });
  });

  it("custom range apply button enables after entering dates", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Maxsus"));

    await waitFor(() => {
      expect(screen.getByText("Boshlanish:")).toBeDefined();
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length >= 2) {
      fireEvent.change(dateInputs[0], { target: { value: "2026-09-01" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-09-27" } });
      const btn = screen.getByText("Filtrlash");
      expect(btn.hasAttribute("disabled")).toBe(false);
    }
  });

  it("changing preset reloads overview data", async () => {
    await renderPage();
    const initialCallCount = vi.mocked(api.get).mock.calls.length;

    fireEvent.click(screen.getByText("O'tgan oy"));

    await waitFor(() => {
      expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});

describe("HisobotlarPage — error state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows retry button on API error", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/plans")) return Promise.resolve(mockPlans);
      return Promise.reject(new Error("Network error"));
    });

    render(<HisobotlarPage />);
    await waitFor(() => expect(screen.getByText("Hisobotlar")).toBeDefined());

    await waitFor(() => {
      expect(screen.getByText("Qayta urinish")).toBeDefined();
    });
  });
});

describe("HisobotlarPage — loading state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows loading skeleton initially", async () => {
    let resolveOverview!: (v: unknown) => void;
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/plans")) return Promise.resolve(mockPlans);
      if (url.includes("reports/overview")) {
        return new Promise((res) => { resolveOverview = res; });
      }
      return Promise.resolve({});
    });

    render(<HisobotlarPage />);

    // During loading, skeleton divs with animate-pulse should be present
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);

    resolveOverview(mockOverview);
  });
});
