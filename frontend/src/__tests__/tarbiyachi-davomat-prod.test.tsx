import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TarbiyachiDashboardPage from "@/app/tarbiyachi/dashboard/page";
import { api } from "@/lib/api";
import { getDemoAttendance } from "@/lib/demo-data";

// ── Mocks — IS_DEMO explicitly false ──────────────────────────────────────────

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
  useAuth: () => ({ user: { name: "Maftuna Xolmatova", role: "teacher" } }),
}));

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:             false,
  getDemoAttendance:   vi.fn(),
  saveDemoAttendance:  vi.fn(),
  clearDemoAttendance: vi.fn(),
}));

// ── Fixture ────────────────────────────────────────────────────────────────────

const mockDashboard = {
  teacher: { id: 1, name: "Maftuna Xolmatova", position: "Bosh tarbiyachi" },
  group:   { id: 1, name: "Kamalak guruhi", age_category: "3–4 yosh", capacity: 14 },
  today: {
    date: "2026-10-27",
    total: 3,
    present: 2,
    absent: 1,
    children: [
      { id: 1, first_name: "Azizbek", last_name: "Karimov",   status: "present" as const },
      { id: 2, first_name: "Malika",  last_name: "Yusupova",  status: "present" as const },
      { id: 3, first_name: "Sardor",  last_name: "Toshmatov", status: "absent"  as const },
    ],
  },
  schedule: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(mockDashboard);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TarbiyachiDashboardPage — Production rejimi (IS_DEMO=false)", () => {
  it("toggle tugmalari ko'rinmaydi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByText("Azizbek Karimov")).toBeTruthy());

    expect(screen.queryByTestId("toggle-1")).toBeNull();
    expect(screen.queryByTestId("toggle-2")).toBeNull();
    expect(screen.queryByTestId("toggle-3")).toBeNull();
  });

  it("'Barchasini keldi deb belgilash' tugmasi ko'rinmaydi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByText("Azizbek Karimov")).toBeTruthy());

    expect(screen.queryByText("Barchasini keldi deb belgilash")).toBeNull();
  });

  it("'O'zgarishlarni bekor qilish' tugmasi ko'rinmaydi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByText("Azizbek Karimov")).toBeTruthy());

    expect(screen.queryByText("O'zgarishlarni bekor qilish")).toBeNull();
  });

  it("saqlash holati ko'rsatilmaydi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByText("Azizbek Karimov")).toBeTruthy());

    expect(screen.queryByTestId("save-status-saved")).toBeNull();
    expect(screen.queryByTestId("save-status-idle")).toBeNull();
  });

  it("getDemoAttendance chaqirilmaydi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByText("Azizbek Karimov")).toBeTruthy());

    expect(vi.mocked(getDemoAttendance)).not.toHaveBeenCalled();
  });

  it("API dan kelgan present/absent sonlarini ko'rsatadi", async () => {
    render(<TarbiyachiDashboardPage />);
    await waitFor(() => expect(screen.getByTestId("stat-present")).toBeTruthy());

    expect(screen.getByTestId("stat-present")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-absent")).toHaveTextContent("1");
  });
});
