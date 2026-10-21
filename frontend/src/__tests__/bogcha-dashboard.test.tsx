import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BogchaDashboardPage from "@/app/bogcha/dashboard/page";
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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Barno Yusupova", role: "admin" } }),
}));

// ── Fixtures ───────────────────────────────────────────────────────

const mockSummary = {
  bolalar_soni:     12,
  guruhlar_soni:    3,
  tarbiyachilar_soni: 5,
  ota_onalar_soni:  10,
};

const mockGroups = {
  data: [
    { id: 1, name: "Qoʻngʻiroqchalar", age_category: "3-4 yosh", capacity: 20, children_count: 15 },
    { id: 2, name: "Kapalaklar",       age_category: "4-5 yosh", capacity: 15, children_count: 15 },
    { id: 3, name: "Yulduzchalar",     age_category: "5-6 yosh", capacity: 10, children_count: 10 },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────

function setupMocks() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes("/groups"))    return Promise.resolve(mockGroups);
    if (url.includes("/dashboard")) return Promise.resolve(mockSummary);
    return Promise.reject(new Error(`Unexpected: ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────

describe("BogchaDashboardPage", () => {
  it("shows greeting with user first name", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Barno/)).toBeTruthy();
    });
  });

  it("shows loading skeleton initially", () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    const skeletons = document.querySelectorAll(".animate-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders stat cards with correct counts after load", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("12")).toBeTruthy();  // bolalar
    });
    expect(screen.getByText("3")).toBeTruthy();     // guruhlar
    expect(screen.getByText("5")).toBeTruthy();     // tarbiyachilar
    expect(screen.getByText("10")).toBeTruthy();    // ota-onalar
  });

  it("renders group progress bars", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Qoʻngʻiroqchalar")).toBeTruthy();
    });
    expect(screen.getByText("Kapalaklar")).toBeTruthy();
    expect(screen.getByText("Yulduzchalar")).toBeTruthy();
  });

  it("renders group capacity fractions", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("15/20")).toBeTruthy();
    });
    expect(screen.getAllByText("15/15").length).toBeGreaterThan(0);
  });

  it("renders groups section heading", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Guruhlar holati")).toBeTruthy();
    });
  });

  it("renders attendance placeholder section", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Bugungi davomat")).toBeTruthy();
    });
  });

  it("renders empty state when no groups", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/groups"))    return Promise.resolve({ data: [] });
      if (url.includes("/dashboard")) return Promise.resolve(mockSummary);
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Hali guruh yaratilmagan")).toBeTruthy();
    });
  });

  it("shows error state with retry button on API failure", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(<BogchaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Qayta urinish")).toBeTruthy();
    });
  });

  it("calls /v1/admin/dashboard endpoint", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => expect(screen.getByText("12")).toBeTruthy());
    const calls = vi.mocked(api.get).mock.calls.map(([url]) => url as string);
    expect(calls.some((u) => u.includes("/admin/dashboard"))).toBe(true);
  });

  it("calls /v1/admin/groups endpoint", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => expect(screen.getByText("12")).toBeTruthy());
    const calls = vi.mocked(api.get).mock.calls.map(([url]) => url as string);
    expect(calls.some((u) => u.includes("/admin/groups"))).toBe(true);
  });
});
