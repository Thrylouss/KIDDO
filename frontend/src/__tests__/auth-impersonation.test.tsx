import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { api, impersonation } from "@/lib/api";

// Haqiqiy AuthProvider + api.ts; faqat fetch soxta
vi.mock("@/lib/demo-data", () => ({
  IS_DEMO: false, DEMO_USER: null, getDemoUser: vi.fn(), setDemoRole: vi.fn(), clearDemoRole: vi.fn(), handleDemoRequest: vi.fn(),
}));

type Reply = { status: number; body?: unknown };
let routes: Record<string, Reply>;
const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  routes = {
    "GET /api/v1/me":      { status: 401, body: { message: "Tizimga kirishingiz kerak." } },
    "POST /api/v1/login":  { status: 200, body: { user: { id: 2, name: "Rahbar", role: "admin" } } },
    "POST /api/v1/logout": { status: 200, body: {} },
  };
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const r = routes[`${init.method} ${new URL(url).pathname}`] ?? { status: 404 };
    return Promise.resolve({ ok: r.status < 300, status: r.status, json: async () => r.body ?? {} });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="user">{user?.role ?? "none"}</p>
      <button onClick={() => login("rahbar1", "parol")}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

const headerOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)["X-Impersonated-Org"];

describe("Sessiya almashganda eski impersonatsiya konteksti o'tmaydi", () => {
  it("login oldingi Super Admin impersonatsiyasini tozalaydi — keyingi so'rovlarda X-Impersonated-Org yo'q", async () => {
    impersonation.start(7, "Eski bog'cha");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // /me

    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("admin"));

    expect(impersonation.active()).toBe(false);
    const loginCall = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/v1/login") && i.method === "POST")!;
    expect(headerOf(loginCall)).toBeUndefined();

    routes["GET /api/v1/admin/dashboard"] = { status: 200, body: {} };
    await api.get("/v1/admin/dashboard");
    expect(headerOf(fetchMock.mock.calls.at(-1)!)).toBeUndefined();
  });

  it("logout impersonatsiyani tozalaydi", async () => {
    routes["GET /api/v1/me"] = { status: 200, body: { user: { id: 4, name: "SA", role: "super_admin" } } };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("super_admin"));
    impersonation.start(7, "Bog'cha");

    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(impersonation.active()).toBe(false);
  });

  it("sessiya muddati tugasa (401) impersonatsiya ham tozalanadi", async () => {
    routes["GET /api/v1/me"] = { status: 200, body: { user: { id: 4, name: "SA", role: "super_admin" } } };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("super_admin"));
    impersonation.start(7, "Bog'cha");

    routes["GET /api/v1/admin/children"] = { status: 401, body: { message: "Tizimga kirishingiz kerak." } };
    await api.get("/v1/admin/children").catch(() => {});
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("none"));
    expect(impersonation.active()).toBe(false);
  });
});
