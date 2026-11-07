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

  it("real API bugungi davomatni qaytarsa raqamlar va havola ko'rsatiladi", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/groups"))    return Promise.resolve(mockGroups);
      if (url.includes("/dashboard")) return Promise.resolve({
        ...mockSummary,
        bugungi_davomat: { sana: "2026-10-28", jami: 12, keldi: 9, kelmadi: 1, sababli: 1, belgilanmagan: 1 },
      });
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    render(<BogchaDashboardPage />);

    const card = await screen.findByTestId("today-attendance");
    expect(card).toHaveTextContent("Keldi9");
    expect(card).toHaveTextContent("Belgilanmagan1");
    expect(screen.getByRole("link", { name: "Davomatni ochish" })).toHaveAttribute("href", "/bogcha/davomat");
    expect(screen.queryByText("Bugungi davomat tayyor emas")).toBeNull();
  });

  it("so'nggi faoliyatlar va faol bolalar soni real API dan ko'rsatiladi", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/groups"))    return Promise.resolve(mockGroups);
      if (url.includes("/dashboard")) return Promise.resolve({
        ...mockSummary,
        faol_bolalar_soni: 11,
        songgi_faoliyatlar: [
          { id: 9, title: "Ertak tinglash", direction: "nutq", date: "2026-10-28", starts_at: "10:00", group: { id: 1, name: "Kapalaklar" } },
        ],
      });
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    render(<BogchaDashboardPage />);

    const box = await screen.findByTestId("recent-activities");
    expect(box).toHaveTextContent("So'nggi faoliyatlar");
    expect(box).toHaveTextContent("Ertak tinglash");
    expect(box).toHaveTextContent("Kapalaklar · Nutq o'stirish");
    expect(box).toHaveTextContent("2026-10-28 · 10:00");
    expect(screen.getByRole("link", { name: "Kundalikni ochish" })).toHaveAttribute("href", "/bogcha/kundalik");
    expect(screen.getByText(/faol: 11/)).toBeInTheDocument();
  });

  it("so'nggi faoliyat bo'lmasa bo'sh holat ko'rsatiladi", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/groups"))    return Promise.resolve(mockGroups);
      if (url.includes("/dashboard")) return Promise.resolve({ ...mockSummary, songgi_faoliyatlar: [] });
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    render(<BogchaDashboardPage />);
    expect(await screen.findByText("Hali mashg'ulot yozilmagan")).toBeInTheDocument();
  });

  it("bugungi_davomat bo'lmasa (demo) eski bo'sh holat saqlanadi", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);

    expect(await screen.findByText("Bugungi davomat tayyor emas")).toBeTruthy();
    expect(screen.queryByTestId("today-attendance")).toBeNull();
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

  it("bog'cha nomi va manzilini ko'rsatadi", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/groups"))    return Promise.resolve(mockGroups);
      if (url.includes("/dashboard")) return Promise.resolve({
        ...mockSummary,
        bogcha: { id: 7, name: "Quyoshcha bog'chasi", address: "Samarqand", phone: "+998711112233" },
      });
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });
    render(<BogchaDashboardPage />);
    const profile = await screen.findByTestId("bogcha-profile");
    expect(profile).toHaveTextContent("Quyoshcha bog'chasi");
    expect(profile).toHaveTextContent("Samarqand · +998711112233");
  });

  it("tezkor amallar asosiy bo'limlarga olib boradi", async () => {
    setupMocks();
    render(<BogchaDashboardPage />);
    await waitFor(() => expect(screen.getByText("12")).toBeTruthy());
    const nav = screen.getByRole("navigation", { name: "Tezkor amallar" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/bogcha/davomat", "/bogcha/bolalar", "/bogcha/xabarlar"]));
  });
});
