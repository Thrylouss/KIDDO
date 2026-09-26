import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import FoydalanuvchilarPage from "@/app/admin/foydalanuvchilar/page";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: {
    get:   vi.fn(),
    put:   vi.fn(),
    patch: vi.fn(),
    post:  vi.fn(),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockUser = {
  id:            1,
  name:          "Alisher Navoi",
  phone:         "+998901234567",
  email:         "alisher@example.com",
  role:          "admin" as const,
  is_active:     true,
  last_login_at: null,
  created_at:    "2024-01-01T00:00:00Z",
  organization:  { id: 10, name: "Bog'cha #1" },
};

const inactiveUser = { ...mockUser, id: 2, name: "Inactive User", is_active: false, organization: null };

const usersResponse = {
  data: [mockUser, inactiveUser],
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
};

const orgsResponse = {
  data: [
    { id: 10, name: "Bog'cha #1", phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null },
    { id: 20, name: "Bog'cha #2", phone: null, address: null, is_active: true, created_at: "", admin: null, subscription: null },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
};

// ── Helpers ────────────────────────────────────────────────────────

async function renderPage() {
  const { api } = await import("@/lib/api");
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("organizations")) return Promise.resolve(orgsResponse);
    return Promise.resolve(usersResponse);
  });
  render(<FoydalanuvchilarPage />);
  // Wait for users to load
  await waitFor(() => screen.getByText("Alisher Navoi"));
}

async function openMenu(userName: string) {
  const row = screen.getByText(userName).closest("tr")!;
  const btn = within(row).getByRole("button", { name: "Amallar" });
  fireEvent.click(btn);
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Foydalanuvchilar page — table", () => {
  it("renders user names from API", async () => {
    await renderPage();
    expect(screen.getByText("Alisher Navoi")).toBeDefined();
    expect(screen.getByText("Inactive User")).toBeDefined();
  });

  it("shows organization name for users with an org", async () => {
    await renderPage();
    expect(screen.getByText("Bog'cha #1")).toBeDefined();
  });

  it("shows 'Tashkilotsiz' for users without an org", async () => {
    await renderPage();
    expect(screen.getByText("Tashkilotsiz")).toBeDefined();
  });
});

describe("Foydalanuvchilar page — edit modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens edit modal when Tahrirlash is clicked", async () => {
    await renderPage();
    await openMenu("Alisher Navoi");

    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() =>
      expect(screen.getByText("Foydalanuvchini tahrirlash")).toBeDefined()
    );
  });

  it("pre-populates fields with current user data", async () => {
    await renderPage();
    await openMenu("Alisher Navoi");
    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() => screen.getByText("Foydalanuvchini tahrirlash"));

    const nameInput = screen.getByDisplayValue("Alisher Navoi") as HTMLInputElement;
    expect(nameInput.value).toBe("Alisher Navoi");

    const phoneInput = screen.getByDisplayValue("+998901234567") as HTMLInputElement;
    expect(phoneInput.value).toBe("+998901234567");

    const emailInput = screen.getByDisplayValue("alisher@example.com") as HTMLInputElement;
    expect(emailInput.value).toBe("alisher@example.com");
  });

  it("disables save button when name is empty", async () => {
    await renderPage();
    await openMenu("Alisher Navoi");
    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() => screen.getByText("Foydalanuvchini tahrirlash"));

    const nameInput = screen.getByDisplayValue("Alisher Navoi");
    fireEvent.change(nameInput, { target: { value: "" } });

    const saveBtn = screen.getByRole("button", { name: "Yangilash" });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancel closes modal without modifying the table", async () => {
    await renderPage();
    await openMenu("Alisher Navoi");
    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() => screen.getByText("Foydalanuvchini tahrirlash"));

    const nameInput = screen.getByDisplayValue("Alisher Navoi");
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });

    fireEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));

    await waitFor(() =>
      expect(screen.queryByText("Foydalanuvchini tahrirlash")).toBeNull()
    );

    // Original name still in table
    expect(screen.getByText("Alisher Navoi")).toBeDefined();
    // Changed name NOT in table
    expect(screen.queryByText("Changed Name")).toBeNull();
  });

  it("successful update refreshes the row in the table", async () => {
    const { api } = await import("@/lib/api");
    const updatedUser = { ...mockUser, name: "Yangi Ism" };
    vi.mocked(api.put).mockResolvedValueOnce({ data: updatedUser });

    await renderPage();
    await openMenu("Alisher Navoi");
    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() => screen.getByText("Foydalanuvchini tahrirlash"));

    const nameInput = screen.getByDisplayValue("Alisher Navoi");
    fireEvent.change(nameInput, { target: { value: "Yangi Ism" } });

    fireEvent.click(screen.getByRole("button", { name: "Yangilash" }));

    await waitFor(() =>
      expect(screen.queryByText("Foydalanuvchini tahrirlash")).toBeNull()
    );

    expect(screen.getByText("Yangi Ism")).toBeDefined();
    expect(screen.queryByText("Alisher Navoi")).toBeNull();
  });

  it("shows server error message when update fails", async () => {
    const { api } = await import("@/lib/api");
    vi.mocked(api.put).mockRejectedValueOnce({
      data: { message: "Telefon raqami band" },
    });

    await renderPage();
    await openMenu("Alisher Navoi");
    fireEvent.click(screen.getByText("Tahrirlash"));

    await waitFor(() => screen.getByText("Foydalanuvchini tahrirlash"));

    fireEvent.click(screen.getByRole("button", { name: "Yangilash" }));

    await waitFor(() =>
      expect(screen.getByText("Telefon raqami band")).toBeDefined()
    );
  });
});
