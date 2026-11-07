import { render, renderHook, screen, waitFor, act } from "@testing-library/react";
import { useEffect } from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import TarbiyachiLayout from "@/app/tarbiyachi/layout";
import { api } from "@/lib/api";

// ── Mocks — haqiqiy AuthContext + api.ts, faqat fetch soxta ──────────────────

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:           false,
  DEMO_USER:         null,
  getDemoUser:       vi.fn(),
  clearDemoRole:     vi.fn(),
  handleDemoRequest: vi.fn(),
}));

const router = { push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter:   () => router,
  usePathname: () => "/tarbiyachi/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── Soxta backend ──────────────────────────────────────────────────────────────

type Reply = { status: number; body?: unknown } | Error;
let routes: Record<string, Reply>;
const fetchMock = vi.fn();

const TEACHER = { id: 7, name: "Maftuna Xolmatova", role: "teacher", phone: "+998900000007" };

function reply(r: Reply) {
  if (r instanceof Error) return Promise.reject(r);
  return Promise.resolve({
    ok:     r.status >= 200 && r.status < 300,
    status: r.status,
    json:   async () => r.body ?? {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  routes = { "GET /api/v1/me": { status: 200, body: { user: TEACHER } } };
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const key = `${init.method} ${new URL(url).pathname}`;
    return reply(routes[key] ?? { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

async function renderLoggedIn() {
  const hook = renderAuth();
  await waitFor(() => expect(hook.result.current.user?.name).toBe(TEACHER.name));
  return hook.result;
}

function logoutCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/v1/logout"));
}

// ── Logout ─────────────────────────────────────────────────────────────────────

describe("AuthContext.logout", () => {
  it("backend logout muvaffaqiyatli → foydalanuvchi tozalanadi", async () => {
    routes["POST /api/v1/logout"] = { status: 200, body: { message: "OK" } };
    const auth = await renderLoggedIn();

    await act(async () => { await auth.current.logout(); });

    expect(logoutCalls()).toHaveLength(1);
    expect(auth.current.user).toBeNull();
  });

  it("backend 500 → xato tashlanadi va foydalanuvchi tizimda qoladi", async () => {
    routes["POST /api/v1/logout"] = { status: 500, body: { message: "Server xatosi" } };
    const auth = await renderLoggedIn();

    await act(async () => {
      await expect(auth.current.logout()).rejects.toMatchObject({ status: 500 });
    });

    expect(auth.current.user?.name).toBe(TEACHER.name);
  });

  it("tarmoq uzilishi → xato tashlanadi va foydalanuvchi tizimda qoladi", async () => {
    routes["POST /api/v1/logout"] = new TypeError("Failed to fetch");
    const auth = await renderLoggedIn();

    await act(async () => {
      await expect(auth.current.logout()).rejects.toThrow("Failed to fetch");
    });

    expect(auth.current.user?.name).toBe(TEACHER.name);
  });

  it("backend 401 (sessiya allaqachon yo'q) → muvaffaqiyat deb hisoblanadi", async () => {
    routes["POST /api/v1/logout"] = { status: 401, body: { message: "Tizimga kirishingiz kerak." } };
    const auth = await renderLoggedIn();

    await act(async () => { await auth.current.logout(); });

    expect(auth.current.user).toBeNull();
  });
});

// ── Sessiya tugashi (401) ──────────────────────────────────────────────────────

describe("AuthContext — sessiya tugashi", () => {
  it("autentifikatsiyalangan so'rov 401 qaytarsa foydalanuvchi tozalanadi", async () => {
    routes["GET /api/v1/admin/children"] = { status: 401 };
    const auth = await renderLoggedIn();

    await act(async () => {
      await expect(api.get("/v1/admin/children")).rejects.toMatchObject({ status: 401 });
    });

    expect(auth.current.user).toBeNull();
  });

  it("403 javobi foydalanuvchini tizimdan chiqarmaydi", async () => {
    routes["GET /api/v1/super-admin/users"] = { status: 403 };
    const auth = await renderLoggedIn();

    await act(async () => {
      await expect(api.get("/v1/super-admin/users")).rejects.toMatchObject({ status: 403 });
    });

    expect(auth.current.user?.name).toBe(TEACHER.name);
  });

  it("/v1/me 401 → foydalanuvchi yo'q, qo'shimcha so'rov yoki loop yo'q", async () => {
    routes["GET /api/v1/me"] = { status: 401 };

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ── Layout guard orqali /login ga yo'naltirish ─────────────────────────────────

function ExpiredSessionPage() {
  useEffect(() => {
    // Ikkita parallel so'rov — redirect baribir bir marta bo'lishi kerak
    api.get("/v1/teacher/dashboard").catch(() => {});
    api.get("/v1/teacher/groups").catch(() => {});
  }, []);
  return <p>Sahifa</p>;
}

describe("Tarbiyachi layout — 401 dan keyin", () => {
  it("sessiya tugaganda /login ga bir marta yo'naltiradi", async () => {
    routes["GET /api/v1/teacher/dashboard"] = { status: 401 };
    routes["GET /api/v1/teacher/groups"]    = { status: 401 };

    render(<TarbiyachiLayout><ExpiredSessionPage /></TarbiyachiLayout>);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("sessiya amal qilsa yo'naltirish bo'lmaydi", async () => {
    routes["GET /api/v1/teacher/dashboard"] = { status: 200, body: {} };
    routes["GET /api/v1/teacher/groups"]    = { status: 200, body: {} };

    render(<TarbiyachiLayout><ExpiredSessionPage /></TarbiyachiLayout>);

    await screen.findByText("Sahifa");
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/v1/teacher/"))).toHaveLength(2),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});
