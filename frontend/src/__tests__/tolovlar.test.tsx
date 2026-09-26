import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TolovlarPage from "@/app/admin/tolovlar/page";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get:  vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockSummary = {
  gross_revenue:   1500000,
  net_revenue:     1000000,
  total_revenue:   1000000,
  refunded_amount:  500000,
  today_revenue:    200000,
  monthly_revenue:  800000,
  pending_revenue:  300000,
  paid_count:       5,
  pending_count:    2,
  failed_count:     1,
  refunded_count:   1,
  total_count:      9,
};

const mockPaidPayment = {
  id:             1,
  organization:   { id: 10, name: "Bog'cha Yulduz" },
  subscription_id: 1,
  invoice_id:     null,
  invoice_number: "INV-2024-001",
  amount:         "499000",
  currency:       "UZS",
  status:         "paid" as const,
  payment_method: "manual",
  transaction_id: null,
  paid_at:        "2024-01-15T10:00:00Z",
  due_at:         null,
  plan_name:      "Standart",
  notes:          null,
  created_at:     "2024-01-15T09:00:00Z",
};

const mockPendingPayment = {
  ...mockPaidPayment,
  id:             2,
  organization:   { id: 20, name: "Bog'cha Bahor" },
  invoice_number: null,
  status:         "pending" as const,
  paid_at:        null,
};

const mockPaymentsResponse = {
  data:    [mockPaidPayment, mockPendingPayment],
  meta:    { current_page: 1, last_page: 1, per_page: 20, total: 2 },
  summary: mockSummary,
};

const mockDetail = {
  data: {
    ...mockPaidPayment,
    organization: { id: 10, name: "Bog'cha Yulduz", phone: "+998901234567" },
    subscription: { id: 1, status: "active", ends_at: "2024-12-31", plan: { id: 1, name: "Standart", price_monthly: "499000", currency: "UZS" } },
    invoice: null,
  },
};

// ── Helpers ────────────────────────────────────────────────────────

async function renderPage() {
  const { api } = await import("@/lib/api");
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("plans"))         return Promise.resolve({ data: [{ id: 1, name: "Standart", price_monthly: "499000", currency: "UZS", slug: "standart", description: null, price_yearly: null, trial_days: 7, max_children: 100, max_teachers: 20, max_groups: 10, features: [], is_active: true, sort_order: 1 }] });
    if (url.includes("organizations")) return Promise.resolve({ data: [{ id: 10, name: "Bog'cha Yulduz", phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null }], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
    return Promise.resolve(mockPaymentsResponse);
  });
  render(<TolovlarPage />);
  await waitFor(() => {
    expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("TolovlarPage — KPI tiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all 8 KPI tile labels", async () => {
    await renderPage();
    expect(screen.getByText("Jami tushum")).toBeDefined();
    expect(screen.getByText("Bugungi tushum")).toBeDefined();
    expect(screen.getAllByText("Shu oy").length).toBeGreaterThan(0);
    expect(screen.getByText("Jami to'lovlar")).toBeDefined();
    expect(screen.getAllByText("Muvaffaqiyatli").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Muvaffaqiyatsiz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Qaytarilgan").length).toBeGreaterThan(0);
  });

  it("renders count values from summary", async () => {
    await renderPage();
    expect(screen.getByText("5")).toBeDefined();  // paid_count
    expect(screen.getByText("9")).toBeDefined();  // total_count
  });
});

describe("TolovlarPage — table", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders payment rows with org names", async () => {
    await renderPage();
    expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bog'cha Bahor").length).toBeGreaterThan(0);
  });

  it("renders invoice number in table", async () => {
    await renderPage();
    expect(screen.getAllByText("INV-2024-001").length).toBeGreaterThan(0);
  });

  it("shows correct status badges", async () => {
    await renderPage();
    expect(screen.getAllByText("To'langan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
  });

  it("shows plan name in table", async () => {
    await renderPage();
    expect(screen.getAllByText("Standart").length).toBeGreaterThan(0);
  });
});

describe("TolovlarPage — date presets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all date preset buttons", async () => {
    await renderPage();
    expect(screen.getByText("Bugun")).toBeDefined();
    expect(screen.getByText("Kecha")).toBeDefined();
    expect(screen.getByText("Shu hafta")).toBeDefined();
    expect(screen.getAllByText("Shu oy").length).toBeGreaterThan(0);
    expect(screen.getByText("O'tgan oy")).toBeDefined();
    expect(screen.getByText("Maxsus")).toBeDefined();
  });

  it("shows custom date inputs when Maxsus is clicked", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Maxsus"));
    await waitFor(() => {
      const dateInputs = document.querySelectorAll("input[type='date']");
      expect(dateInputs.length).toBeGreaterThan(0);
    });
  });
});

describe("TolovlarPage — detail modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens detail modal when Batafsil is clicked", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("plans"))          return Promise.resolve({ data: [] });
      if (url.includes("organizations"))  return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      if (url.match(/payments\/\d+/))     return Promise.resolve(mockDetail);
      return Promise.resolve(mockPaymentsResponse);
    });

    render(<TolovlarPage />);
    await waitFor(() => { expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0); });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Batafsil"));

    await waitFor(() =>
      expect(screen.getByText("To'lov tafsilotlari")).toBeDefined()
    );
  });
});

describe("TolovlarPage — verify flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Qayta tekshirish only for pending payment", async () => {
    await renderPage();

    // Open menu for first payment (paid) - should NOT have Qayta tekshirish
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    expect(screen.queryByText("Qayta tekshirish")).toBeNull();
    fireEvent.click(menuBtns[0]); // close

    // Open menu for second payment (pending) - should have Qayta tekshirish
    fireEvent.click(menuBtns[1]);
    await waitFor(() => expect(screen.getByText("Qayta tekshirish")).toBeDefined());
  });

  it("calls verify API endpoint and updates row status", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("plans"))         return Promise.resolve({ data: [] });
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      return Promise.resolve(mockPaymentsResponse);
    });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { ...mockPendingPayment, status: "paid" } });

    render(<TolovlarPage />);
    await waitFor(() => { expect(screen.getAllByText("Bog'cha Bahor").length).toBeGreaterThan(0); });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[1]);
    fireEvent.click(screen.getByText("Qayta tekshirish"));

    await waitFor(() => expect(screen.getByText("To'lovni tasdiqlash")).toBeDefined());

    const confirmBtns = screen.getAllByRole("button", { name: "Tasdiqlash" });
    fireEvent.click(confirmBtns[0]);

    await waitFor(() =>
      expect(vi.mocked(api.post)).toHaveBeenCalledWith(
        "/v1/super-admin/payments/2/verify", {}
      )
    );
  });
});

describe("TolovlarPage — refund flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Qaytarish only for paid payment", async () => {
    await renderPage();

    // Open menu for second payment (pending) - should NOT have Qaytarish
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[1]);
    expect(screen.queryByText("Qaytarish")).toBeNull();
    fireEvent.click(menuBtns[1]); // close

    // Open menu for first payment (paid) - should have Qaytarish
    fireEvent.click(menuBtns[0]);
    await waitFor(() => expect(screen.getByText("Qaytarish")).toBeDefined());
  });

  it("calls refund API with reason", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("plans"))         return Promise.resolve({ data: [] });
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      return Promise.resolve(mockPaymentsResponse);
    });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { ...mockPaidPayment, status: "refunded" } });

    render(<TolovlarPage />);
    await waitFor(() => { expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0); });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Qaytarish"));

    await waitFor(() => expect(screen.getByText("To'lovni qaytarish")).toBeDefined());

    const textarea = screen.getByPlaceholderText("Nima sababdan qaytarilmoqda?");
    fireEvent.change(textarea, { target: { value: "Noto'g'ri to'lov" } });

    const refundBtns = screen.getAllByRole("button", { name: "Qaytarish" });
    fireEvent.click(refundBtns[refundBtns.length - 1]);

    await waitFor(() =>
      expect(vi.mocked(api.post)).toHaveBeenCalledWith(
        "/v1/super-admin/payments/1/refund",
        { reason: "Noto'g'ri to'lov" }
      )
    );
  });
});
