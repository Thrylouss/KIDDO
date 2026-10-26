import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TarbiyachiDashboardPage from "@/app/tarbiyachi/dashboard/page";
import { api } from "@/lib/api";
import {
  getDemoAttendance,
  saveDemoAttendance,
  clearDemoAttendance,
} from "@/lib/demo-data";

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
  useAuth: () => ({ user: { name: "Maftuna Xolmatova", role: "teacher" } }),
}));

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:              true,
  getDemoAttendance:    vi.fn(),
  saveDemoAttendance:   vi.fn(),
  clearDemoAttendance:  vi.fn(),
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

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(mockDashboard);
  vi.mocked(getDemoAttendance).mockReturnValue(null); // no saved data by default
});

// Helper: wait until the initialization useEffect has completed.
// IMPORTANT: toggle buttons use `statuses[id] ?? child.status`, so they show the correct
// text even before statuses are initialized. stat-present is derived solely from statuses,
// so "2" only appears after setStatuses({1:"present",2:"present",3:"absent"}) runs.
async function renderAndWait() {
  render(<TarbiyachiDashboardPage />);
  await waitFor(() => {
    expect(screen.getByTestId("stat-present")).toHaveTextContent("2");
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("TarbiyachiDashboardPage — Demo Davomat", () => {

  describe("Render", () => {
    it("bolalar ro'yxatini ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getByText("Azizbek Karimov")).toBeTruthy();
      expect(screen.getByText("Malika Yusupova")).toBeTruthy();
      expect(screen.getByText("Sardor Toshmatov")).toBeTruthy();
    });

    it("dastlabki holatlarni to'g'ri ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("toggle-1")).toHaveTextContent("Keldi");
      expect(screen.getByTestId("toggle-2")).toHaveTextContent("Keldi");
      expect(screen.getByTestId("toggle-3")).toHaveTextContent("Kelmadi");
    });

    it("dastlabki hisoblagichlarni ko'rsatadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("stat-present")).toHaveTextContent("2");
      expect(screen.getByTestId("stat-absent")).toHaveTextContent("1");
      expect(screen.getByTestId("stat-total")).toHaveTextContent("3");
    });

    it("dastlab 'Saqlanmadi' holati ko'rsatiladi", async () => {
      await renderAndWait();
      // save-status-idle appears after initialization useEffect sets saveStatus="idle"
      await waitFor(() => expect(screen.getByTestId("save-status-idle")).toBeTruthy());
      expect(screen.queryByTestId("save-status-saved")).toBeNull();
    });
  });

  describe("Toggle", () => {
    it("present bolani absent qiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      await waitFor(() =>
        expect(screen.getByTestId("toggle-1")).toHaveTextContent("Kelmadi"),
      );
    });

    it("absent bolani present qiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-3"));
      await waitFor(() =>
        expect(screen.getByTestId("toggle-3")).toHaveTextContent("Keldi"),
      );
    });

    it("toggle paytida hisoblagichlar yangilanadi", async () => {
      await renderAndWait();
      expect(screen.getByTestId("stat-present")).toHaveTextContent("2");
      expect(screen.getByTestId("stat-absent")).toHaveTextContent("1");

      fireEvent.click(screen.getByTestId("toggle-1")); // present → absent

      await waitFor(() => {
        expect(screen.getByTestId("stat-present")).toHaveTextContent("1");
        expect(screen.getByTestId("stat-absent")).toHaveTextContent("2");
      });
    });

    it("toggle paytida localStorage ga saqlaydi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      await waitFor(() => expect(vi.mocked(saveDemoAttendance)).toHaveBeenCalledOnce());
      const [date, saved] = vi.mocked(saveDemoAttendance).mock.calls[0] as [string, Record<number, string>];
      expect(date).toBe("2026-10-27");
      expect(saved[1]).toBe("absent");
    });

    it("toggle dan keyin 'Saqlangan' holati ko'rsatiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      await waitFor(() => expect(screen.getByTestId("save-status-saved")).toBeTruthy());
      expect(screen.queryByTestId("save-status-idle")).toBeNull();
    });
  });

  describe("Barchasini keldi deb belgilash", () => {
    it("barcha bolalarni present qiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Barchasini keldi deb belgilash"));

      await waitFor(() => {
        expect(screen.getByTestId("toggle-1")).toHaveTextContent("Keldi");
        expect(screen.getByTestId("toggle-2")).toHaveTextContent("Keldi");
        expect(screen.getByTestId("toggle-3")).toHaveTextContent("Keldi");
      });
    });

    it("present hisoblagichini jami bolalarga tenglashtiradi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Barchasini keldi deb belgilash"));

      await waitFor(() => {
        expect(screen.getByTestId("stat-present")).toHaveTextContent("3");
        expect(screen.getByTestId("stat-absent")).toHaveTextContent("0");
      });
    });

    it("localStorage ga saqlaydi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByText("Barchasini keldi deb belgilash"));
      await waitFor(() => expect(vi.mocked(saveDemoAttendance)).toHaveBeenCalledOnce());
      const [, saved] = vi.mocked(saveDemoAttendance).mock.calls[0] as [string, Record<number, string>];
      expect(Object.values(saved).every(s => s === "present")).toBe(true);
    });
  });

  describe("O'zgarishlarni bekor qilish", () => {
    it("dastlabki holatlarga qaytaradi", async () => {
      await renderAndWait();

      fireEvent.click(screen.getByTestId("toggle-1")); // present → absent
      await waitFor(() =>
        expect(screen.getByTestId("toggle-1")).toHaveTextContent("Kelmadi"),
      );

      fireEvent.click(screen.getByText("O'zgarishlarni bekor qilish"));

      await waitFor(() => {
        expect(screen.getByTestId("toggle-1")).toHaveTextContent("Keldi");
        expect(screen.getByTestId("toggle-3")).toHaveTextContent("Kelmadi");
      });
    });

    it("localStorage tozalanadi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      await waitFor(() => expect(vi.mocked(saveDemoAttendance)).toHaveBeenCalled());
      fireEvent.click(screen.getByText("O'zgarishlarni bekor qilish"));
      await waitFor(() => expect(vi.mocked(clearDemoAttendance)).toHaveBeenCalledWith("2026-10-27"));
    });

    it("reset dan keyin 'Saqlanmadi' ko'rsatiladi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      await waitFor(() => expect(screen.getByTestId("save-status-saved")).toBeTruthy());
      fireEvent.click(screen.getByText("O'zgarishlarni bekor qilish"));
      await waitFor(() => expect(screen.getByTestId("save-status-idle")).toBeTruthy());
      expect(screen.queryByTestId("save-status-saved")).toBeNull();
    });
  });

  describe("localStorage yuklash", () => {
    it("sahifa yuklanganda localStorage dan o'qiydi", async () => {
      const saved: Record<number, "present" | "absent"> = { 1: "absent", 2: "absent", 3: "present" };
      vi.mocked(getDemoAttendance).mockReturnValue(saved);

      render(<TarbiyachiDashboardPage />);
      // wait for save-status-saved which appears after statuses are loaded from localStorage
      await waitFor(() => expect(screen.getByTestId("save-status-saved")).toBeTruthy());

      expect(screen.getByTestId("toggle-1")).toHaveTextContent("Kelmadi");
      expect(screen.getByTestId("toggle-3")).toHaveTextContent("Keldi");
    });

    it("localStorage dan yuklanganda 'Saqlangan' ko'rsatiladi", async () => {
      vi.mocked(getDemoAttendance).mockReturnValue({ 1: "present", 2: "present", 3: "absent" });

      render(<TarbiyachiDashboardPage />);
      await waitFor(() => screen.getByTestId("save-status-saved"));

      expect(screen.getByTestId("save-status-saved")).toBeTruthy();
    });
  });

  describe("Demo xavfsizligi", () => {
    it("demo rejimda api.post chaqirilmaydi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-1"));
      fireEvent.click(screen.getByText("Barchasini keldi deb belgilash"));
      fireEvent.click(screen.getByText("O'zgarishlarni bekor qilish"));
      expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    });

    it("demo rejimda api.put chaqirilmaydi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-2"));
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    });

    it("demo rejimda api.patch chaqirilmaydi", async () => {
      await renderAndWait();
      fireEvent.click(screen.getByTestId("toggle-2"));
      expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
    });
  });
});
