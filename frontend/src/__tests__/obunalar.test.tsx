import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ObunalarPage from "@/app/admin/obunalar/page";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get:   vi.fn(),
    post:  vi.fn(),
    patch: vi.fn(),
    put:   vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockMetrics = {
  data: { active: 5, trial: 3, past_due: 1, expired: 2, cancelled: 0, mrr: 2_500_000 },
};

const mockSub = {
  id:              1,
  organization_id: 10,
  organization:    { id: 10, name: "Bog'cha Yulduz" },
  plan_id:         1,
  plan:            { id: 1, name: "Standart", price_monthly: "499000", currency: "UZS" },
  status:          "active" as const,
  starts_at:       "2024-01-01T00:00:00Z",
  ends_at:         "2024-12-31T00:00:00Z",
  trial_ends_at:   null,
  days_remaining:  90,
  auto_renew:      false,
  cancelled_at:    null,
  cancelled_reason: null,
  is_expiring_soon: false,
  created_at:      "2024-01-01T00:00:00Z",
};

const mockSub2 = {
  ...mockSub,
  id:              2,
  organization_id: 20,
  organization:    { id: 20, name: "Bog'cha Bahor" },
  status:          "trial" as const,
  auto_renew:      true,
};

const mockSubsResponse = {
  data: [mockSub, mockSub2],
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
};

const mockPlans = {
  data: [
    { id: 1, name: "Standart", price_monthly: "499000", currency: "UZS", slug: "standart",
      description: null, price_yearly: null, trial_days: 7, max_children: 100,
      max_teachers: 20, max_groups: 10, features: [], is_active: true, sort_order: 1 },
  ],
};

const mockOrgs = {
  data: [
    { id: 10, name: "Bog'cha Yulduz", phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null },
    { id: 20, name: "Bog'cha Bahor",  phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
};

const mockDetail = {
  data: {
    ...mockSub,
    organization_detail: { id: 10, name: "Bog'cha Yulduz", phone: "+998901234567", address: "Toshkent" },
    plan_detail: {
      id: 1, name: "Standart", description: null, price_monthly: "499000",
      price_yearly: null, currency: "UZS", trial_days: 7,
      max_children: 100, max_teachers: 20, max_groups: 10, features: [],
    },
    payment_summary: { total_paid: 499000, total_pending: 0, latest_payment_at: "2024-01-01T00:00:00Z" },
    recent_invoices: [],
    recent_payments: [],
  },
};

// ── Helpers ────────────────────────────────────────────────────────

async function renderPage() {
  const { api } = await import("@/lib/api");
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("metrics"))       return Promise.resolve(mockMetrics);
    if (url.includes("plans"))         return Promise.resolve(mockPlans);
    if (url.includes("organizations")) return Promise.resolve(mockOrgs);
    return Promise.resolve(mockSubsResponse);
  });
  render(<ObunalarPage />);
  // Org appears in both table link and select options — use getAllByText
  await waitFor(() => {
    const matches = screen.getAllByText("Bog'cha Yulduz");
    expect(matches.length).toBeGreaterThan(0);
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Obunalar page — KPI tiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders metrics tiles", async () => {
    await renderPage();
    // Active count tile
    expect(screen.getByText("5")).toBeDefined();
    // Trial count tile
    expect(screen.getByText("3")).toBeDefined();
    // MRR tile shows formatted value
    expect(screen.getByText("2.5M")).toBeDefined();
  });
});

describe("Obunalar page — table", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders subscription org names from API", async () => {
    await renderPage();
    // Names appear in both table links and select options
    expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bog'cha Bahor").length).toBeGreaterThan(0);
  });

  it("renders plan names in table", async () => {
    await renderPage();
    const planCells = screen.getAllByText("Standart");
    expect(planCells.length).toBeGreaterThan(0);
  });

  it("shows active badge for active subscription", async () => {
    await renderPage();
    // "Faol" appears in both badge and filter select option
    expect(screen.getAllByText("Faol").length).toBeGreaterThan(0);
  });

  it("shows trial badge for trial subscription", async () => {
    await renderPage();
    // "Sinov" appears in both badge and filter select option
    expect(screen.getAllByText("Sinov").length).toBeGreaterThan(0);
  });
});

describe("Obunalar page — detail modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens detail modal when Batafsil is clicked", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("metrics"))         return Promise.resolve(mockMetrics);
      if (url.includes("plans"))           return Promise.resolve(mockPlans);
      if (url.includes("organizations"))   return Promise.resolve(mockOrgs);
      if (url.match(/subscriptions\/\d+/)) return Promise.resolve(mockDetail);
      return Promise.resolve(mockSubsResponse);
    });

    render(<ObunalarPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    // Open ⋮ menu
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Batafsil"));

    await waitFor(() =>
      expect(screen.getByText("Obuna tafsilotlari")).toBeDefined()
    );
  });
});

describe("Obunalar page — create modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens create modal when button is clicked", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obuna qo'shish" }));
    // Modal title should appear
    await waitFor(() => {
      const headings = screen.getAllByText("Obuna qo'shish");
      expect(headings.length).toBeGreaterThan(1); // button + modal title
    });
  });

  it("shows ends_at field only when status is active", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Obuna qo'shish" }));

    // Wait for modal status select — display value is option label text ("Sinov")
    await waitFor(() => {
      const allSelects = document.querySelectorAll("select");
      const statusSelect = Array.from(allSelects).find(
        (s) => s.value === "trial"
      );
      expect(statusSelect).toBeDefined();
    });

    const statusSelect = Array.from(document.querySelectorAll("select")).find(
      (s) => s.value === "trial"
    )!;

    // "Yangi tugash sanasi" label should NOT exist yet (trial mode)
    expect(screen.queryByText("Yangi tugash sanasi")).toBeNull();

    // Switch to active
    fireEvent.change(statusSelect, { target: { value: "active" } });

    // ends_at input's label should now appear
    await waitFor(() =>
      expect(screen.getByText("Yangi tugash sanasi")).toBeDefined()
    );
  });
});

describe("Obunalar page — cancel modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancel action calls correct API endpoint", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("metrics"))       return Promise.resolve(mockMetrics);
      if (url.includes("plans"))         return Promise.resolve(mockPlans);
      if (url.includes("organizations")) return Promise.resolve(mockOrgs);
      return Promise.resolve(mockSubsResponse);
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...mockSub, status: "cancelled" },
    });

    render(<ObunalarPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    // Open ⋮ menu for first sub
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Bekor qilish"));

    // Modal title appears
    await waitFor(() =>
      expect(screen.getByText("Obunani bekor qilish")).toBeDefined()
    );

    // Two "Bekor qilish" buttons in modal footer — last is the submit (danger)
    const cancelBtns = screen.getAllByRole("button", { name: "Bekor qilish" });
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);

    await waitFor(() =>
      expect(vi.mocked(api.post)).toHaveBeenCalledWith(
        "/v1/super-admin/subscriptions/1/cancel",
        expect.any(Object)
      )
    );
  });
});

describe("Obunalar page — auto-renew toggle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles auto-renew via switch button", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("metrics"))       return Promise.resolve(mockMetrics);
      if (url.includes("plans"))         return Promise.resolve(mockPlans);
      if (url.includes("organizations")) return Promise.resolve(mockOrgs);
      return Promise.resolve(mockSubsResponse);
    });
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: { ...mockSub, auto_renew: true },
    });

    render(<ObunalarPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    // Find the first toggle switch in the table (first sub has auto_renew: false)
    const toggleBtns = screen.getAllByTitle("Avto-yangilash");
    fireEvent.click(toggleBtns[0]);

    await waitFor(() =>
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        "/v1/super-admin/subscriptions/1/toggle-auto-renew",
        {}
      )
    );
  });
});
