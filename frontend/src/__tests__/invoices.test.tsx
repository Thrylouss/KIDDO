import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import InvoicesPage from "@/app/admin/invoices/page";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get:   vi.fn(),
    post:  vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockSummary = {
  total:               5,
  draft:               1,
  pending:             2,
  paid:                1,
  overdue:             1,
  cancelled:           0,
  total_pending_amount: 700000,
  total_paid_amount:   499000,
  total_overdue_amount: 299000,
};

const mockPendingInvoice = {
  id:              1,
  invoice_number:  "KIDDO-2024-000001",
  organization:    { id: 10, name: "Bog'cha Yulduz" },
  subscription_id: 1,
  amount:          "499000",
  currency:        "UZS",
  status:          "pending" as const,
  due_at:          "2024-02-15T00:00:00Z",
  paid_at:         null,
  notes:           null,
  created_at:      "2024-01-15T09:00:00Z",
};

const mockPaidInvoice = {
  ...mockPendingInvoice,
  id:             2,
  invoice_number: "KIDDO-2024-000002",
  organization:   { id: 20, name: "Bog'cha Bahor" },
  status:         "paid" as const,
  paid_at:        "2024-01-20T10:00:00Z",
};

const mockOverdueInvoice = {
  ...mockPendingInvoice,
  id:             3,
  invoice_number: "KIDDO-2024-000003",
  organization:   { id: 30, name: "Bog'cha Nilufar" },
  status:         "overdue" as const,
};

const mockInvoicesResponse = {
  data:    [mockPendingInvoice, mockPaidInvoice],
  meta:    { current_page: 1, last_page: 1, per_page: 20, total: 2 },
  summary: mockSummary,
};

const mockDetailResponse = {
  data: {
    ...mockPendingInvoice,
    subscription: { id: 1, status: "active", ends_at: "2024-12-31", plan_id: 1 },
    payments: [
      { id: 10, amount: "499000", currency: "UZS", status: "pending", payment_method: null, paid_at: null, created_at: "2024-01-15T09:00:00Z" },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────

async function renderPage() {
  const { api } = await import("@/lib/api");
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("organizations")) return Promise.resolve({ data: [{ id: 10, name: "Bog'cha Yulduz", phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null }], meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 } });
    return Promise.resolve(mockInvoicesResponse);
  });
  render(<InvoicesPage />);
  await waitFor(() => {
    expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("InvoicesPage — KPI tiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all 6 KPI tile labels", async () => {
    await renderPage();
    expect(screen.getByText("Jami invoicelar")).toBeDefined();
    expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("To'langan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Muddati o'tgan").length).toBeGreaterThan(0);
    expect(screen.getByText("Kutilayotgan summa")).toBeDefined();
    expect(screen.getByText("To'langan summa")).toBeDefined();
  });

  it("renders tile count values from summary", async () => {
    await renderPage();
    expect(screen.getByText("5")).toBeDefined(); // total
    expect(screen.getAllByText("1").length).toBeGreaterThan(0); // paid or overdue count
  });

  it("renders money amount in KPI tile", async () => {
    await renderPage();
    const amountEls = screen.getAllByText(/499.*UZS/);
    expect(amountEls.length).toBeGreaterThan(0);
  });
});

describe("InvoicesPage — table", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders invoice rows with org names", async () => {
    await renderPage();
    expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bog'cha Bahor").length).toBeGreaterThan(0);
  });

  it("renders invoice numbers in table", async () => {
    await renderPage();
    expect(screen.getAllByText("KIDDO-2024-000001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("KIDDO-2024-000002").length).toBeGreaterThan(0);
  });

  it("shows correct status badges", async () => {
    await renderPage();
    expect(screen.getAllByText("Kutilmoqda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("To'langan").length).toBeGreaterThan(0);
  });
});

describe("InvoicesPage — create button", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Hisob-faktura qo'shish button", async () => {
    await renderPage();
    expect(screen.getByText("Hisob-faktura qo'shish")).toBeDefined();
  });

  it("opens create modal when button is clicked", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Hisob-faktura qo'shish"));
    await waitFor(() => {
      expect(screen.getAllByText("Hisob-faktura qo'shish").length).toBeGreaterThan(1);
    });
  });
});

describe("InvoicesPage — detail modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens detail modal when Batafsil is clicked", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      if (url.match(/invoices\/\d+/))    return Promise.resolve(mockDetailResponse);
      return Promise.resolve(mockInvoicesResponse);
    });

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Batafsil"));

    await waitFor(() =>
      expect(screen.getByText("Hisob-faktura tafsilotlari")).toBeDefined()
    );
  });
});

describe("InvoicesPage — mark paid flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows To'lash only for pending invoices (not paid)", async () => {
    await renderPage();

    // Open menu for paid invoice (index 1)
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[1]);
    expect(screen.queryByText("To'lash")).toBeNull();
    fireEvent.click(menuBtns[1]); // close

    // Open menu for pending invoice (index 0)
    fireEvent.click(menuBtns[0]);
    await waitFor(() => expect(screen.getByText("To'lash")).toBeDefined());
  });

  it("opens mark-paid confirm modal when To'lash is clicked", async () => {
    await renderPage();

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("To'lash"));

    await waitFor(() =>
      expect(screen.getByText("To'langan deb belgilash")).toBeDefined()
    );
  });

  it("calls mark-paid API endpoint", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      return Promise.resolve(mockInvoicesResponse);
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { ...mockPendingInvoice, status: "paid", paid_at: new Date().toISOString() } });

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("To'lash"));

    await waitFor(() => expect(screen.getByText("To'langan deb belgilash")).toBeDefined());

    const confirmBtns = screen.getAllByRole("button");
    const tolashBtn = confirmBtns.find(b => b.textContent === "To'lash" && b.tagName === "BUTTON");
    if (tolashBtn) fireEvent.click(tolashBtn);

    await waitFor(() =>
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        "/v1/super-admin/invoices/1/mark-paid", {}
      )
    );
  });
});

describe("InvoicesPage — cancel flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Bekor qilish only for non-paid non-cancelled invoices", async () => {
    await renderPage();

    // Open menu for paid invoice (index 1) - should NOT have Bekor qilish
    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[1]);
    expect(screen.queryByText("Bekor qilish")).toBeNull();
    fireEvent.click(menuBtns[1]); // close

    // Open menu for pending invoice (index 0) - should have Bekor qilish
    fireEvent.click(menuBtns[0]);
    await waitFor(() => expect(screen.getByText("Bekor qilish")).toBeDefined());
  });

  it("opens cancel confirm modal with reason textarea", async () => {
    await renderPage();

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Bekor qilish"));

    await waitFor(() =>
      expect(screen.getByText("Hisob-fakturani bekor qilish")).toBeDefined()
    );
    expect(screen.getByPlaceholderText("Nima sababdan bekor qilinmoqda?")).toBeDefined();
  });

  it("calls cancel API with reason", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      return Promise.resolve(mockInvoicesResponse);
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { ...mockPendingInvoice, status: "cancelled" } });

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Yulduz").length).toBeGreaterThan(0);
    });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    fireEvent.click(screen.getByText("Bekor qilish"));

    await waitFor(() => expect(screen.getByText("Hisob-fakturani bekor qilish")).toBeDefined());

    fireEvent.change(
      screen.getByPlaceholderText("Nima sababdan bekor qilinmoqda?"),
      { target: { value: "Noto'g'ri summa" } },
    );

    const bekorBtns = screen.getAllByRole("button", { name: "Bekor qilish" });
    fireEvent.click(bekorBtns[bekorBtns.length - 1]);

    await waitFor(() =>
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        "/v1/super-admin/invoices/1/cancel",
        { reason: "Noto'g'ri summa" }
      )
    );
  });

  it("shows To'lash option for overdue invoice", async () => {
    const { api } = await import("@/lib/api");
    const overdueResponse = {
      ...mockInvoicesResponse,
      data: [mockOverdueInvoice],
    };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("organizations")) return Promise.resolve({ data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } });
      return Promise.resolve(overdueResponse);
    });

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Bog'cha Nilufar").length).toBeGreaterThan(0);
    });

    const menuBtns = screen.getAllByRole("button", { name: "Amallar" });
    fireEvent.click(menuBtns[0]);
    await waitFor(() => expect(screen.getByText("To'lash")).toBeDefined());
  });
});
