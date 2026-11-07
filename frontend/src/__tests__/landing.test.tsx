import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import uz from "@/i18n/uz";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/lib/demo-data", () => ({
  IS_DEMO: false, DEMO_USER: null, getDemoUser: vi.fn(), clearDemoRole: vi.fn(), setDemoRole: vi.fn(), handleDemoRequest: vi.fn(),
}));

let me: { status: number; body?: unknown };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  me = { status: 401, body: { message: "Tizimga kirishingiz kerak." } };
  fetchMock.mockImplementation((url: string) => {
    const r = new URL(url).pathname === "/api/v1/me" ? me : { status: 404 };
    return Promise.resolve({ ok: r.status < 300, status: r.status, json: async () => r.body ?? {} });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function renderLanding() {
  const { default: LandingPage } = await import("@/app/page");
  return render(<LandingPage />);
}

describe("Landing sahifa", () => {
  it("barcha bo'limlar va o'zbekcha sarlavhalar", async () => {
    const { container } = await renderLanding();
    for (const id of ["imkoniyatlar", "egasi", "rahbar", "tarbiyachi", "ota-onalar", "qanday-ishlaydi", "demo", "nima-uchun"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bog'changizni boshqarishning zamonaviy va oson usuli");
    for (const title of [
      "Bog'changiz ustidan to'liq nazorat",
      "Har bir jarayon — bitta boshqaruv panelida",
      "Tarbiyachining kundalik ishlari endi osonroq",
      "Farzandingiz bog'chadagi har bir kunidan xabardor bo'ling",
      "KIDDO'ni 14 kun davomida bepul sinab ko'ring",
    ]) expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    for (const f of uz.landing.imk) expect(screen.getByRole("heading", { name: f.nom })).toBeInTheDocument();
    expect(uz.landing.imk).toHaveLength(10);
    expect(uz.landing.qadamlar).toHaveLength(5);
    expect(screen.getByText(uz.landing.tarb_ruxsat)).toBeInTheDocument();
  });

  it("modullar «Mavjud», kelajakdagilari «Rejada» deb belgilangan", async () => {
    const { container } = await renderLanding();
    expect(container.querySelectorAll('#imkoniyatlar [data-holat="mavjud"]')).toHaveLength(10);
    expect(container.querySelector('#imkoniyatlar [data-holat="rejada"]')).not.toBeNull();
    // Kelish-ketish vaqti hali yo'q — ota-onalar bo'limida «Rejada»
    expect(container.querySelector('#ota-onalar [data-holat="rejada"]')?.closest("li")).toHaveTextContent("kelgan va ketgan vaqtini");
  });

  it("login CTA'lari /login ga, DEMO CTA'lari formaga olib boradi", async () => {
    const { container } = await renderLanding();
    const login = container.querySelectorAll('[data-cta="login"]');
    expect(login.length).toBeGreaterThanOrEqual(4);
    login.forEach((a) => expect(a.getAttribute("href")).toBe("/login"));
    const demo = container.querySelectorAll('[data-cta="demo"]');
    expect(demo.length).toBeGreaterThanOrEqual(4);
    demo.forEach((a) => expect(a.getAttribute("href")).toBe("#demo"));
    expect(screen.getAllByText("14 kun bepul sinab ko'rish").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("#demo form")).not.toBeNull();
    expect(screen.getByRole("button", { name: "14 kunlik bepul DEMO olish" })).toBeInTheDocument();
  });

  it("dashboard vizuallari haqiqiy skrinshotlar; mobil ilova — «Ilova interfeysi namunasi»", async () => {
    const { container } = await renderLanding();
    const srcs = [...container.querySelectorAll("img")].map((i) => decodeURIComponent(i.getAttribute("src") ?? ""));
    for (const f of ["rahbar-dashboard", "rahbar-bolalar", "rahbar-tolovlar", "rahbar-davomat", "tarbiyachi-dashboard"]) {
      expect(srcs.some((s) => s.includes(`/landing/${f}.jpg`))).toBe(true);
    }
    expect(screen.getAllByText(uz.landing.skrinshot_izoh, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: new RegExp(uz.landing.namuna) }).length).toBeGreaterThan(0);
  });

  it("to'qima da'volar yo'q: do'kon havolalari, mijoz fikrlari yo'q; ilova holati ochiq aytilgan; 28 — demo ma'lumot", async () => {
    const { container } = await renderLanding();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/App Store|Google Play|Play Market|mijozlarimiz|fikr-mulohaza/i);
    expect(container.querySelector('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toBeNull();
    expect(screen.getByText(uz.landing.ota_holat)).toBeInTheDocument();
    expect(screen.getByTestId("demo-note")).toHaveTextContent("demo muhitda");
    expect(screen.getByTestId("demo-note")).toHaveTextContent("faol mijozlar yoki ulangan bog'chalar soni emas");
    expect(text).not.toMatch(/tarif|obuna/i); // billing yashirin
    expect(text).not.toMatch(/TELEGRAM_BOT_TOKEN/); // token/sozlama frontendda yo'q
  });

  it("aloqa ma'lumotlari berilmagan bo'lsa footer'da kontakt bloki yo'q", async () => {
    await renderLanding();
    expect(screen.queryByTestId("footer-contact")).toBeNull();
    expect(screen.queryByRole("link", { name: uz.landing.cta_boglanish })).toBeNull();
  });

  it("aloqa ma'lumotlari faqat konfiguratsiyadan (NEXT_PUBLIC_CONTACT_*) olinadi", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "info@example.uz");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_TELEGRAM", "@kiddo_test");
    await renderLanding();
    const footer = screen.getByTestId("footer-contact");
    expect(footer.querySelector('a[href="mailto:info@example.uz"]')).not.toBeNull();
    expect(footer.querySelector('a[href="https://t.me/kiddo_test"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: uz.landing.cta_boglanish })).toHaveAttribute("href", "mailto:info@example.uz");
  });
});

describe("Landing — tizimga kirgan foydalanuvchi yo'naltiriladi", () => {
  it.each([
    [{ role: "super_admin" }, "/admin/dashboard"],
    [{ role: "admin" }, "/bogcha"],
    [{ role: "teacher" }, "/tarbiyachi"],
    [{ role: "parent" }, "/ota-ona"],
    [{ role: "teacher", must_change_password: true }, "/parol-almashtirish"],
  ])("%o → %s", async (user, target) => {
    me = { status: 200, body: { user: { id: 1, name: "X", ...user } } };
    await renderLanding();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(target));
  });

  it("mehmon landing'da qoladi", async () => {
    await renderLanding();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });
});
