import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import LoginPage from "@/app/login/page";
import LoginLayout from "@/app/login/layout";
import uz from "@/i18n/uz";

// ── Mocks — haqiqiy AuthProvider + api.ts, faqat fetch soxta ─────────────────

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:           false,
  DEMO_USER:         null,
  getDemoUser:       vi.fn(),
  setDemoRole:       vi.fn(),
  clearDemoRole:     vi.fn(),
  handleDemoRequest: vi.fn(),
}));

const router = { push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

type Reply = { status: number; body?: unknown };
let routes: Record<string, Reply>;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  routes = { "GET /api/v1/me": { status: 401, body: { message: "Tizimga kirishingiz kerak." } } };
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const r = routes[`${init.method} ${new URL(url).pathname}`] ?? { status: 404 };
    return Promise.resolve({ ok: r.status < 300, status: r.status, json: async () => r.body ?? {} });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function submit(login: string, password: string) {
  fireEvent.change(screen.getByLabelText(uz.auth.login_maydon), { target: { value: login } });
  fireEvent.change(document.querySelector('input[autocomplete="current-password"]')!, {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: uz.auth.kirish_btn }));
}

describe("Login sahifasi", () => {
  it("login 401 → xato xabari ko'rsatiladi, yo'naltirish yo'q", async () => {
    routes["POST /api/v1/login"] = { status: 401, body: { message: "Unauthenticated." } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("+998900000001", "notogri-parol");

    expect(await screen.findByText(uz.auth.xato_kirish)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("login 422 + raqamda ortiqcha raqam → format bo'yicha maslahat (so'rov baribir yuboriladi)", async () => {
    routes["POST /api/v1/login"] = { status: 422, body: { message: "Kiritilgan ma'lumotlar noto'g'ri." } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("+9989000000102", "parol-123456");

    expect(await screen.findByText(uz.auth.xato_telefon_format)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/v1/login") && init.method === "POST")).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("login 422 → xato xabari ko'rsatiladi", async () => {
    routes["POST /api/v1/login"] = { status: 422, body: { message: "Kiritilgan ma'lumotlar noto'g'ri." } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("+998900000001", "notogri-parol");

    expect(await screen.findByText(uz.auth.xato_kirish)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    [429, uz.auth.juda_kop_urinish],
    [500, uz.auth.server_xatosi],
    [503, uz.auth.server_xatosi],
  ])("login %i → mos xabar", async (status, message) => {
    routes["POST /api/v1/login"] = { status, body: { message: "Too Many Attempts." } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("+998900000001", "parol-123456");

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("username bilan kirish → «login» maydoni yuboriladi va rolga mos panelga yo'naltiriladi", async () => {
    routes["POST /api/v1/login"] = { status: 200, body: { user: { id: 7, name: "Test", role: "admin", username: "bogcha1", phone: null } } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("  bogcha1 ", "parol-123456");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/bogcha"));
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/v1/login") && init.method === "POST")!;
    expect(JSON.parse(call[1].body as string)).toEqual({ login: "bogcha1", password: "parol-123456" });
  });

  it("ota-ona web'ga kirmoqchi bo'lsa — sessiyasiz mobil ilova axborot sahifasiga yo'naltiriladi", async () => {
    routes["POST /api/v1/login"] = { status: 403, body: { message: "Ota-onalar KIDDO mobil ilovasidan foydalanadi.", code: "parent_mobile_only" } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("malika.ona", "Ona-parol-2026");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/ota-ona"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("vaqtinchalik parol bilan kirgan foydalanuvchi parol almashtirish sahifasiga yo'naltiriladi", async () => {
    routes["POST /api/v1/login"] = { status: 200, body: { user: { id: 8, name: "Yangi", role: "teacher", username: "tarb1", must_change_password: true } } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("tarb1", "Vaqtinchalik1");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/parol-almashtirish"));
    expect(router.push).not.toHaveBeenCalledWith("/tarbiyachi");
  });

  it("username noto'g'ri → telefon formati maslahatisiz umumiy xato", async () => {
    routes["POST /api/v1/login"] = { status: 422, body: { message: "Login yoki parol noto'g'ri." } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("tarbiyachi1", "notogri-parol");

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.xato_kirish);
    expect(screen.queryByText(uz.auth.xato_telefon_format)).not.toBeInTheDocument();
  });

  it("tarmoq uzilishi → tarmoq xabari", async () => {
    render(<LoginLayout><LoginPage /></LoginLayout>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // /v1/me
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    submit("+998900000001", "parol-123456");

    expect(await screen.findByText(uz.auth.tarmoq_xatosi)).toBeInTheDocument();
  });

  it.each([
    ["teacher", "/tarbiyachi"],
    ["admin",   "/bogcha"],
    ["parent",  "/ota-ona"],
  ])("allaqachon kirgan %s foydalanuvchi /login dan %s ga yo'naltiriladi", async (role, target) => {
    routes["GET /api/v1/me"] = { status: 200, body: { user: { id: 1, name: "Foydalanuvchi", role, phone: "+998900000001" } } };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(target));
  });

  it("sahifa ochilganda /v1/me 401 → redirect loop yo'q, faqat bitta so'rov", async () => {
    render(<LoginLayout><LoginPage /></LoginLayout>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    ["super_admin", "/admin/dashboard"],
    ["admin",       "/bogcha"],
    ["teacher",     "/tarbiyachi"],
    ["parent",      "/ota-ona"],
  ])("muvaffaqiyatli login (%s) → %s ga yo'naltiriladi va sahifa mavjud", async (role, target) => {
    routes["POST /api/v1/login"] = {
      status: 200,
      body: { user: { id: 1, name: "Foydalanuvchi", role, phone: "+998900000001" } },
    };
    render(<LoginLayout><LoginPage /></LoginLayout>);

    submit("+998900000001", "togri-parol");

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(target));
    // Yo'naltirish 404 ga olib bormasligi kerak
    expect(existsSync(resolve(__dirname, `../app${target}/page.tsx`))).toBe(true);
  });
});

describe("Login formasi xavfsizligi", () => {
  it("JS yuklanmasdan yuborilsa ham login/parol URL'ga tushmaydi (name yo'q, method=post)", () => {
    render(<LoginLayout><LoginPage /></LoginLayout>);
    const form = screen.getByLabelText(uz.auth.login_maydon).closest("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.querySelectorAll("input[name]")).toHaveLength(0);
  });
});
