import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import OtaOnaLayout from "@/app/ota-ona/layout";
import OtaOnaPage from "@/app/ota-ona/page";
import uz from "@/i18n/uz";

// Ota-onalar uchun web panel yo'q: /ota-ona faqat KIDDO mobil ilovasi haqida axborot sahifasi.
// Haqiqiy AuthProvider + api.ts, faqat fetch soxta.
vi.mock("@/lib/demo-data", () => ({
  IS_DEMO: false, DEMO_USER: null, getDemoUser: vi.fn(), clearDemoRole: vi.fn(), handleDemoRequest: vi.fn(),
}));

type Reply = { status: number; body?: unknown };
let routes: Record<string, Reply>;
const fetchMock = vi.fn();
const PARENT = { id: 9, name: "Dilnoza Karimova", role: "parent", phone: "+998900000009" };

beforeEach(() => {
  vi.clearAllMocks();
  routes = {
    "GET /api/v1/me":      { status: 200, body: { user: PARENT } },
    "POST /api/v1/logout": { status: 200, body: {} },
  };
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const r = routes[`${init.method} ${new URL(url).pathname}`] ?? { status: 404 };
    return Promise.resolve({ ok: r.status < 300, status: r.status, json: async () => r.body ?? {} });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { href: "http://localhost/ota-ona", pathname: "/ota-ona", replace: vi.fn() });
});

afterEach(() => vi.unstubAllGlobals());

const requested = () => fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${new URL(String(url)).pathname}`);

const renderPage = () => render(<OtaOnaLayout><OtaOnaPage /></OtaOnaLayout>);

describe("/ota-ona — KIDDO mobil ilovasi haqida axborot sahifasi", () => {
  it("sarlavha, izoh, qo'shimcha ma'lumot va imkoniyatlar; farzand ma'lumotlari web'da yuklanmaydi", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Farzandingiz haqidagi barcha ma'lumotlar — KIDDO mobil ilovasida");
    expect(screen.getByText("Davomat, kundalik faoliyat, suratlar, xabarlar va to'lovlar haqidagi ma'lumotlarni KIDDO mobil ilovasi orqali kuzatishingiz mumkin.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Mobil ilova ishga tushirilishi va undan foydalanish bo'yicha ma'lumotni farzandingiz tarbiyachisi yoki bog'cha ma'muriyatidan olishingiz mumkin.");
    for (const f of [uz.mobil_ilova.imk_davomat, uz.mobil_ilova.imk_kundalik, uz.mobil_ilova.imk_suratlar, uz.mobil_ilova.imk_xabarlar, uz.mobil_ilova.imk_tolovlar]) {
      expect(screen.getAllByText(f).length).toBeGreaterThan(0);
    }

    await waitFor(() => expect(screen.getByRole("button", { name: uz.auth.chiqish })).toBeInTheDocument());
    expect(requested()).toEqual(["GET /api/v1/me"]);
    expect(requested().some((r) => r.includes("/parent/"))).toBe(false);
    expect(screen.queryByText(PARENT.name)).toBeNull();
  });

  it("do'kon havolalari sozlanmagan bo'lsa ko'rsatilmaydi (soxta havola yo'q)", () => {
    renderPage();
    expect(screen.queryByTestId("store-links")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("faqat rasmiy domendagi https havolalar ko'rsatiladi", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/uz/app/kiddo/id123");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_PLAY_URL", "https://play.google.com.evil.example/store/apps/details?id=uz.kiddo");
    renderPage();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("App Store");
    expect(links[0]).toHaveAttribute("href", "https://apps.apple.com/uz/app/kiddo/id123");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    vi.unstubAllEnvs();
  });

  it("eski web sessiyasi bo'lsa «Chiqish» sessiyani yakunlab /login ga o'tkazadi", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: uz.auth.chiqish }));

    await waitFor(() => expect(requested()).toContain("POST /api/v1/logout"));
    await waitFor(() => expect(window.location.href).toBe("/login"));
  });

  it.each([
    [{ role: "admin" }, "/bogcha"],
    [{ role: "teacher" }, "/tarbiyachi"],
    [{ role: "super_admin" }, "/admin/dashboard"],
  ])("boshqa rol %o o'z paneliga qaytariladi (%s)", async (u, target) => {
    routes["GET /api/v1/me"] = { status: 200, body: { user: { id: 2, name: "X", phone: "+998900000002", ...u } } };
    renderPage();
    await waitFor(() => expect(window.location.replace).toHaveBeenCalledWith(target));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("tizimga kirmagan (web login'dan yo'naltirilgan) ota-onaga kirish sahifasiga qaytish tugmasi", async () => {
    routes["GET /api/v1/me"] = { status: 401, body: { message: "Tizimga kirishingiz kerak." } };
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: uz.mobil_ilova.kirishga }));
    expect(window.location.href).toBe("/login");
    expect(requested()).not.toContain("POST /api/v1/logout");
  });
});
