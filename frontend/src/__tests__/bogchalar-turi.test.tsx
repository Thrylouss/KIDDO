import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BogchalarPage from "@/app/admin/bogchalar/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  impersonation: { start: vi.fn() },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { name: "Super Admin", role: "super_admin" } }) }));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const org = (id: number, name: string, is_demo: boolean) => ({
  id, name, is_demo, phone: null, address: null, is_active: true, created_at: "2026-11-05T00:00:00Z",
  admin: null, subscription: null, children_count: 0, groups_count: 0, teachers_count: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    const turi = new URLSearchParams(path.split("?")[1]).get("turi");
    const data = turi === "demo" ? [org(29, "Test bog'chasi (DEV)", true)] : [org(1, "1-sonli DMTT", false)];
    return { data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length } };
  });
});

const orgCalls = () => vi.mocked(api.get).mock.calls.map(([p]) => String(p)).filter((p) => p.startsWith("/v1/super-admin/organizations?"));

describe("Bog'chalar ro'yxati — haqiqiy va test (DEV) tashkilotlar", () => {
  it("standart holatda faqat haqiqiy tashkilotlar so'raladi, DEV belgisi yo'q", async () => {
    render(<BogchalarPage />);
    expect((await screen.findAllByText("1-sonli DMTT")).length).toBeGreaterThan(0);
    expect(orgCalls()[0]).toContain("turi=real");
    expect(screen.queryByText(uz.super_admin.dev_belgi)).not.toBeInTheDocument();
  });

  it("«Test (DEV)» filtri demo tashkilotlarni DEV belgisi bilan ko'rsatadi", async () => {
    render(<BogchalarPage />);
    await screen.findAllByText("1-sonli DMTT");

    // Ma'lumot turi (haqiqiy / test) — «Qo'shimcha filtrlar» ichida
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.bogchalar.qoshimcha_filtr) }));
    fireEvent.change(screen.getByTestId("filter-turi"), { target: { value: "demo" } });

    expect((await screen.findAllByText("Test bog'chasi (DEV)")).length).toBeGreaterThan(0);
    await waitFor(() => expect(orgCalls().at(-1)).toContain("turi=demo"));
    expect(screen.getAllByText(uz.super_admin.dev_belgi).length).toBeGreaterThan(0);
  });
});
