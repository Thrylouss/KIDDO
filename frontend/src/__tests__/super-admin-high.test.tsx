import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import FaollikPage from "@/app/admin/faollik/page";
import XabarlarPage from "@/app/admin/xabarlar/page";
import BillingGate from "@/components/BillingGate";
import { pageWindow } from "@/components/ui/Pagination";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

vi.mock("@/lib/api", async () => {
  const get = vi.fn();
  return {
    api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    // Haqiqiy fetchAllPages mantiqi — mock qilingan api.get ustida
    fetchAllPages: async (path: string) => {
      const items: unknown[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await get(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
        items.push(...(res?.data ?? []));
        if (!res?.meta || res.meta.current_page >= res.meta.last_page) break;
      }
      return items;
    },
  };
});
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const orgs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, name: `Bog'cha ${from + i}` }));

/** 130 ta bog'cha: 2 sahifa × per_page=100 */
function orgPages(url: string) {
  const page = Number(new URLSearchParams(url.split("?")[1]).get("page") ?? 1);
  expect(url).toContain("per_page=100");
  return page === 1
    ? { data: orgs(1, 100), meta: { current_page: 1, last_page: 2, per_page: 100, total: 130 } }
    : { data: orgs(101, 130), meta: { current_page: 2, last_page: 2, per_page: 100, total: 130 } };
}

const calls = () => vi.mocked(api.get).mock.calls.map(([u]) => String(u));

beforeEach(() => vi.clearAllMocks());

describe("Pagination oynasi", () => {
  it.each([
    [1, 1, [1]],
    [1, 5, [1, 2, "…", 5]],
    [6, 20, [1, "…", 5, 6, 7, "…", 20]],
    [20, 20, [1, "…", 19, 20]],
  ])("joriy %i / %i", (cur, last, out) => expect(pageWindow(cur, last)).toEqual(out));
});

describe("BillingGate", () => {
  it("BILLING_ENABLED=false — 404 (notFound)", () => {
    expect(() => BillingGate({ children: null })).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe("Super Admin — Faollik", () => {
  it("filtr ro'yxatida barcha bog'chalar (2 sahifa), 6-sahifaga o'tish mumkin", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/organizations") ? orgPages(url)
        : { data: [{ id: 1, action: "auth.login", description: "Kirish", ip_address: null, created_at: "2026-11-06T10:00:00Z", user: null, organization: null }],
            meta: { current_page: 1, last_page: 9, per_page: 30, total: 260 } });
    render(<FaollikPage />);
    expect((await screen.findAllByText("Kirish")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole("option", { name: "Bog'cha 130" })).toBeInTheDocument());
    expect(screen.getAllByRole("option")).toHaveLength(131); // «Hammasi» + 130

    fireEvent.click(screen.getByRole("button", { name: "9" }));
    await waitFor(() => expect(calls().some((u) => u.includes("activity-logs") && u.includes("page=9"))).toBe(true));
  });

  it("API xatosida xato holati va «Qayta urinish»", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes("/organizations")) return orgPages(url);
      throw Object.assign(new Error("x"), { status: 500, data: {} });
    });
    render(<FaollikPage />);
    expect(await screen.findByTestId("faollik-error")).toHaveTextContent(uz.auth.server_xatosi);
    expect(screen.queryByText(uz.super_admin.faollik_yoq)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));
    await waitFor(() => expect(calls().filter((u) => u.includes("activity-logs")).length).toBe(2));
  });

  it("bo'sh holat", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/organizations") ? orgPages(url) : { data: [], meta: { current_page: 1, last_page: 1, per_page: 30, total: 0 } });
    render(<FaollikPage />);
    expect(await screen.findByText(uz.super_admin.faollik_yoq)).toBeInTheDocument();
  });
});

describe("Super Admin — Xabarlar", () => {
  const notif = (id: number) => ({ id, title: `Xabar ${id}`, message: "m", type: "info", is_read: false, created_at: "2026-11-06T10:00:00Z" });

  it("qabul qiluvchilar ro'yxatida 130 ta bog'chaning hammasi; bildirishnomalar sahifalanadi", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/organizations") ? orgPages(url)
        : { data: [notif(1)], unread_count: 3, meta: { current_page: url.includes("page=2") ? 2 : 1, last_page: 2, per_page: 50, total: 51 } });
    render(<XabarlarPage />);
    expect(await screen.findByText("Xabar 1")).toBeInTheDocument();
    expect(calls().find((u) => u.includes("/notifications"))).toContain("per_page=50&page=1");

    fireEvent.click(screen.getAllByRole("button", { name: uz.super_admin.xabar_yuborish })[0]);
    await waitFor(() => expect(screen.getByRole("option", { name: "Bog'cha 130" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Bog'cha 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.common.keyingi }));
    await waitFor(() => expect(calls().some((u) => u.includes("/notifications") && u.includes("page=2"))).toBe(true));
  });

  it("eski javob (meta'siz) ham ishlaydi; xato holati va bo'sh holat", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/organizations") ? { data: orgs(1, 3) } : { data: [], unread_count: 0 });
    const { unmount } = render(<XabarlarPage />);
    expect(await screen.findByText(uz.super_admin.xabar_yoq)).toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes("/organizations")) throw Object.assign(new Error("x"), { status: 500, data: {} });
      throw Object.assign(new Error("x"), { status: 403, data: {} });
    });
    render(<XabarlarPage />);
    expect(await screen.findByTestId("xabarlar-error")).toHaveTextContent(uz.common.ruxsat_yoq);
    expect(await screen.findByText(uz.common.bogchalar_yuklanmadi)).toBeInTheDocument();
  });

  it("«o'qildi» xatosi foydalanuvchiga ko'rsatiladi", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/organizations") ? orgPages(url) : { data: [notif(7)], unread_count: 1 });
    vi.mocked(api.patch).mockRejectedValue(Object.assign(new Error("x"), { status: 500, data: {} }));
    render(<XabarlarPage />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(uz.super_admin.o_qildi) }));
    expect(await screen.findByText(uz.auth.server_xatosi)).toBeInTheDocument();
  });
});
