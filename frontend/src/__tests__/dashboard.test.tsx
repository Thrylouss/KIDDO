import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DashboardPage from "@/app/admin/dashboard/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

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
    mrr: 4990000, arr: 59880000, monthly_revenue: 4500000, pending_revenue: 1200000,
    period_paid: 3500000, prev_period_paid: 2800000, total_paid: 45000000, total_refunded: 500000,
  },
  platforma: {
    jami_bolalar: 412,
    jami_guruhlar: 38,
    jami_tarbiyachilar: 51,
    bugungi_davomat: { sana: "2026-11-04", jami: 412, keldi: 300, kelmadi: 40, sababli: 10, belgilanmagan: 62 },
  },
};

const mockOrgs = {
  data: [
    {
      id: 1, name: "Yulduzcha Bog'cha", phone: "+998901234567", address: "Toshkent, Yunusobod",
      is_active: true, created_at: "2026-09-01T10:00:00Z", admin: null, subscription: null,
      children_count: 46, groups_count: 4, teachers_count: 5,
    },
    {
      id: 2, name: "Bahor Bog'cha", phone: null, address: null,
      is_active: false, created_at: "2026-09-10T10:00:00Z", admin: null, subscription: null,
      children_count: 0, groups_count: 0, teachers_count: 0,
    },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
};

function mockApi(overrides: { summary?: unknown; orgs?: unknown; fail?: "summary" | "orgs" } = {}) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith("/v1/super-admin/dashboard")) {
      return overrides.fail === "summary" ? Promise.reject(new Error("x")) : Promise.resolve(overrides.summary ?? mockSummary);
    }
    if (path.startsWith("/v1/super-admin/organizations")) {
      return overrides.fail === "orgs" ? Promise.reject(new Error("x")) : Promise.resolve(overrides.orgs ?? mockOrgs);
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

// ── Tests ──────────────────────────────────────────────────────────

describe("Super Admin platforma dashboardi", () => {
  it("sarlavhani ko'rsatadi", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("Platforma boshqaruv paneli")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Jami bolalar")).toBeInTheDocument());
  });

  it("6 ta KPI kartasini real agregatlardan ko'rsatadi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("412")).toBeInTheDocument());
    const kpi = (title: string) => screen.getByText(title).closest("div")!.parentElement!;
    expect(kpi("Jami bog'chalar")).toHaveTextContent("15");
    expect(kpi("Faol bog'chalar")).toHaveTextContent("12");
    expect(kpi("Nofaol bog'chalar")).toHaveTextContent("3");
    expect(kpi("Jami bolalar")).toHaveTextContent("412");
    expect(kpi("Jami guruhlar")).toHaveTextContent("38");
    expect(kpi("Jami tarbiyachilar")).toHaveTextContent("51");
  });

  it("obuna, tarif va to'lov ma'lumotlarini ko'rsatmaydi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("412")).toBeInTheDocument());
    expect(screen.queryByText(/MRR/)).toBeNull();
    expect(screen.queryByText(/Obuna/i)).toBeNull();
    expect(screen.queryByText(/Premium/)).toBeNull();
    expect(screen.queryByText(/UZS/)).toBeNull();
    const calls = vi.mocked(api.get).mock.calls.map((c) => c[0] as string);
    expect(calls.some((p) => /reports|recent|expiring|payments|invoices|plans/.test(p))).toBe(false);
  });

  it("bog'chalar holati taqsimotini ko'rsatadi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Bog'chalar holati")).toBeInTheDocument());
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("platforma bo'yicha bugungi davomat agregatini ko'rsatadi", async () => {
    render(<DashboardPage />);
    const block = await screen.findByTestId("platform-attendance");
    expect(block).toHaveTextContent("300");
    expect(block).toHaveTextContent("62");
    // 300 / (300+40+10)
    expect(screen.getByText("86%")).toBeInTheDocument();
  });

  it("yaqinda qo'shilgan bog'chalarni sanasi bilan ko'rsatadi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Yaqinda qo'shilgan bog'chalar")).toBeInTheDocument());
    expect(screen.getAllByText(/Qo'shilgan:/).length).toBe(2);
  });

  it("bog'chalar ro'yxatini sonlar va batafsil havola bilan ko'rsatadi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Toshkent, Yunusobod")).toBeInTheDocument());
    expect(screen.getByText("46")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Batafsil" }).map((a) => a.getAttribute("href"));
    expect(links).toContain("/admin/bogchalar/1");
    expect(links).toContain("/admin/bogchalar/2");
    expect(screen.getByText("2 ta bog'cha")).toBeInTheDocument();
  });

  it("holat filtri status parametrini yuboradi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Toshkent, Yunusobod")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Nofaol" }));
    await waitFor(() => {
      const calls = vi.mocked(api.get).mock.calls.map((c) => c[0] as string);
      expect(calls.some((p) => p.startsWith("/v1/super-admin/organizations") && p.includes("status=inactive"))).toBe(true);
    });
  });

  it("qidiruv search parametrini yuboradi", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Toshkent, Yunusobod")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/qidirish/i), { target: { value: "Yulduz" } });
    await waitFor(() => {
      const calls = vi.mocked(api.get).mock.calls.map((c) => c[0] as string);
      expect(calls.some((p) => p.includes("search=Yulduz"))).toBe(true);
    });
  });

  it("natija bo'lmasa bo'sh holatni ko'rsatadi", async () => {
    mockApi({ orgs: { data: [], meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 } } });
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Hali bog'cha ro'yxatdan o'tmagan")).toBeInTheDocument());
  });

  it("xatoda qayta urinish tugmasini ko'rsatadi", async () => {
    mockApi({ fail: "summary" });
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Qayta urinish")).toBeInTheDocument());
  });
});

describe("Dashboard — statistika qoidasi (arxivlanganlar alohida)", () => {
  it("hisob qoidasi, arxivlanganlar soni va to'xtatilganlar izohi ko'rsatiladi", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.startsWith("/v1/super-admin/dashboard")
        ? { ...mockSummary, jami_bogchalar: 4, faol_bogchalar: 2, nofaol_bogchalar: 2, faol_emas_bogchalar: 1, toxtatilgan_bogchalar: 1, arxiv_bogchalar: 3 }
        : mockOrgs);
    render(<DashboardPage />);
    expect(await screen.findByTestId("hisob-qoidasi")).toHaveTextContent(uz.super_admin.hisob_qoidasi);
    expect(screen.getByTestId("arxiv-izoh")).toHaveTextContent(`3 ${uz.super_admin.arxiv_izoh}`);
    expect(screen.getByText(`${uz.super_admin.toxtatilgan_soni}: 1`)).toBeInTheDocument();
  });
});
