import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import SuperAdminSidebar from "@/components/SuperAdminSidebar";
import BogchaSidebar from "@/components/BogchaSidebar";
import TarbiyachiSidebar from "@/components/TarbiyachiSidebar";
import Topbar from "@/components/Topbar";
import { impersonation } from "@/lib/api";
import uz from "@/i18n/uz";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const logout = vi.fn();
let role = "super_admin";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Test Foydalanuvchi", role }, logout }),
}));

vi.mock("@/lib/api", () => ({
  impersonation: { active: vi.fn(), end: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// jsdom navigatsiyani bajarmaydi — window.location ni oddiy obyekt bilan almashtiramiz
const START_URL = "http://localhost/admin/dashboard";

beforeEach(() => {
  vi.clearAllMocks();
  role = "super_admin";
  vi.mocked(impersonation.active).mockReturnValue(false);
  vi.stubGlobal("location", { href: START_URL });
});

afterEach(() => vi.unstubAllGlobals());

function clickLogout() {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.auth.chiqish) }));
}

// ── Oddiy logout ───────────────────────────────────────────────────────────────

describe.each([
  ["SuperAdminSidebar", SuperAdminSidebar, "super_admin"],
  ["BogchaSidebar",     BogchaSidebar,     "admin"],
  ["TarbiyachiSidebar", TarbiyachiSidebar, "teacher"],
] as const)("%s — logout", (_name, Sidebar, userRole) => {
  beforeEach(() => { role = userRole; });

  it("muvaffaqiyatli logout → /login ga o'tadi", async () => {
    logout.mockResolvedValue(undefined);
    render(<Sidebar />);

    clickLogout();

    await waitFor(() => expect(window.location.href).toBe("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("logout API xatosi → xato ko'rsatiladi, sahifada qoladi", async () => {
    logout.mockRejectedValue(Object.assign(new Error("Server xatosi"), { status: 500 }));
    render(<Sidebar />);

    clickLogout();

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.chiqish_xatosi);
    expect(window.location.href).toBe(START_URL);
  });

  it("qayta urinish muvaffaqiyatli bo'lsa xato yo'qoladi va /login ga o'tadi", async () => {
    logout.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(undefined);
    render(<Sidebar />);

    clickLogout();
    await screen.findByRole("alert");

    clickLogout();

    await waitFor(() => expect(window.location.href).toBe("/login"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(logout).toHaveBeenCalledTimes(2);
  });
});

// ── Impersonatsiyadan chiqish ──────────────────────────────────────────────────

describe("Rol nomlari va tarbiyachi menyusi", () => {
  it.each([
    ["teacher", "Tarbiyachi"],
    ["admin",   "Admin"],
    ["parent",  "Ota-ona"],
  ])("Topbar %s rolini o'zbekcha ko'rsatadi", (userRole, label) => {
    role = userRole;
    render(<Topbar onMenuClick={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(userRole)).toBeNull();
  });

  it("BogchaSidebar admin rolini xom qiymatsiz ko'rsatadi", () => {
    role = "admin";
    render(<BogchaSidebar />);
    expect(screen.getByText(uz.foydalanuvchilar.rol_admin)).toBeInTheDocument();
  });

  it("tarbiyachi menyusida «Davomat» faol havola, «Tez kunda» emas", () => {
    role = "teacher";
    render(<TarbiyachiSidebar />);

    const link = screen.getByRole("link", { name: new RegExp(uz.nav.davomat) });
    expect(link).toHaveAttribute("href", "/tarbiyachi/davomat");
    expect(link).not.toHaveTextContent(uz.common.tez_kunda);
  });

  it.each([
    ["teacher", TarbiyachiSidebar, "/tarbiyachi/kundalik", "/tarbiyachi/xabarlar"],
    ["admin",   BogchaSidebar,     "/bogcha/kundalik",     "/bogcha/xabarlar"],
  ] as const)("%s menyusida «Kundalik faoliyat» ishlaydigan havola", (userRole, Sidebar, href, messagesHref) => {
    role = userRole;
    render(<Sidebar />);

    const link = screen.getByRole("link", { name: new RegExp(uz.nav.kundalik) });
    expect(link).toHaveAttribute("href", href);
    expect(link).not.toHaveTextContent(uz.common.tez_kunda);
    // Xabarlar tarbiyachi va bog'cha admini uchun ishlaydi
    const messages = screen.queryByRole("link", { name: new RegExp(uz.nav.xabarlar) });
    if (messagesHref) expect(messages).toHaveAttribute("href", messagesHref);
    else expect(messages).toBeNull();
  });
});

describe("BogchaSidebar — impersonatsiyadan chiqish", () => {
  it("logout qilmaydi, faqat impersonatsiyani tugatadi", async () => {
    role = "super_admin";
    vi.mocked(impersonation.active).mockReturnValue(true);
    render(<BogchaSidebar />);

    clickLogout();

    await waitFor(() => expect(window.location.href).toBe("/admin/bogchalar"));
    expect(impersonation.end).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });
});
