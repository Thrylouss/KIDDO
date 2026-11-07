import { render, renderHook, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/app/login/page";
import LoginLayout from "@/app/login/layout";
import { api } from "@/lib/api";
import { clearDemoRole, setDemoRole, handleDemoRequest } from "@/lib/demo-data";

// ── Mocks — IS_DEMO true: backendga hech qanday so'rov ketmasligi kerak ──────

const DEMO_TEACHER = { id: 3, name: "Demo Tarbiyachi", role: "teacher", phone: "+998900000003" };

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:           true,
  DEMO_USER:         { id: 1, name: "Demo Admin", role: "admin" },
  getDemoUser:       vi.fn(() => DEMO_TEACHER),
  setDemoRole:       vi.fn(),
  clearDemoRole:     vi.fn(),
  handleDemoRequest: vi.fn(),
}));

const router = { push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

async function renderDemoAuth() {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user?.name).toBe(DEMO_TEACHER.name));
  return result;
}

describe("Demo rejim", () => {
  it("demo foydalanuvchi backendsiz yuklanadi", async () => {
    await renderDemoAuth();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logout demo rolini tozalaydi, backendga so'rov yubormaydi", async () => {
    const auth = await renderDemoAuth();

    await act(async () => { await auth.current.logout(); });

    expect(clearDemoRole).toHaveBeenCalledTimes(1);
    expect(auth.current.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API so'rovlari demo ma'lumotlardan olinadi va foydalanuvchini chiqarmaydi", async () => {
    vi.mocked(handleDemoRequest).mockResolvedValue({ data: [] } as never);
    const auth = await renderDemoAuth();

    await act(async () => {
      await expect(api.get("/v1/admin/children")).resolves.toEqual({ data: [] });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.current.user?.name).toBe(DEMO_TEACHER.name);
  });

  it("login sahifasidagi demo tugmasi rolni o'rnatadi va yo'naltiradi", async () => {
    render(<LoginLayout><LoginPage /></LoginLayout>);

    fireEvent.click(await screen.findByRole("button", { name: /Tarbiyachi/ }));

    expect(setDemoRole).toHaveBeenCalledWith("teacher");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/tarbiyachi"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
