import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import HisobotlarPage from "@/app/admin/hisobotlar/page";
import BogchaSozlamalarPage from "@/app/bogcha/sozlamalar/page";
import TolovlarPage from "@/app/bogcha/tolovlar/page";
import NotificationBell from "@/components/NotificationBell";
import PhotoGallery from "@/components/photos/PhotoGallery";
import SendNotificationModal from "@/components/organizations/SendNotificationModal";
import { api, impersonation, uploadFile } from "@/lib/api";
import uz from "@/i18n/uz";

// MVP rejimi: billing o'chiq (standart features.ts), impersonatsiya yo'q
let authUser: Record<string, unknown> = { id: 2, name: "Rahbar", role: "admin", username: "dmtt1" };
const updateUser = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  uploadFile: vi.fn(),
  impersonation: { active: vi.fn(() => false), start: vi.fn(), end: vi.fn() },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authUser, updateUser }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(impersonation.active).mockReturnValue(false);
  authUser = { id: 2, name: "Rahbar", role: "admin", username: "dmtt1" };
});

const calls = (fn: unknown) => vi.mocked(fn as (...a: unknown[]) => unknown).mock.calls.map(([p]) => String(p));

describe("Super Admin hisobotlari (MVP: billing o'chiq)", () => {
  it("faqat tashkilotlar va foydalanuvchilar tablari; billing ko'rsatkichlari va tariflar so'rovi yo'q", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => (url.includes("reports/organizations") ? {
      period: { from: "2026-11-01", to: "2026-11-05" },
      counts: { total: 28, active: 28, inactive: 0, new_in_period: 0, with_unpaid_invoices: 0, with_expired_subs: 0 },
      plan_distribution: [], growth_series: [{ period: "2026-11", label: "Nov 2026", count: 28 }],
    } : {
      period: { from: "2026-11-01", to: "2026-11-05" }, counts: { total: 10, active: 10, inactive: 0, new_in_period: 1 },
      by_role: { super_admin: 1, admin: 3, teacher: 4, parent: 2 }, by_organization: [],
    }));
    render(<HisobotlarPage />);

    expect(await screen.findByText(uz.super_admin.faol_bogchalar)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uz.super_admin.tashkilot_hisoboti })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uz.super_admin.foydalanuvchi_hisoboti })).toBeInTheDocument();
    for (const label of [uz.super_admin.daromad_hisoboti, uz.super_admin.obuna_hisoboti]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    expect(screen.queryByText(uz.super_admin.tollanmagan_invoice_bor)).toBeNull();
    expect(calls(api.get).some((u) => u.includes("/plans") || u.includes("reports/overview"))).toBe(false);
  });
});

describe("Bildirishnomalar qo'ng'irog'i", () => {
  it("rahbar: o'qilmaganlar soni, ro'yxat va o'qilgan deb belgilash", async () => {
    vi.mocked(api.get).mockResolvedValue({ unread_count: 2, data: [
      { id: 7, title: "Yig'ilish", message: "Ertaga 10:00", type: "info", read_at: null, created_at: "2026-11-05T09:00:00Z" },
      { id: 6, title: "Eslatma", message: "Hujjatlar", type: "info", read_at: "2026-11-04T09:00:00Z", created_at: "2026-11-04T09:00:00Z" },
    ] });
    vi.mocked(api.patch).mockResolvedValue({});
    render(<NotificationBell />);

    expect(await screen.findByTestId("bell-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: uz.bildirishnoma.ochish }));
    fireEvent.click(screen.getByText("Yig'ilish"));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/admin/notifications/7/read"));
    fireEvent.click(screen.getByText(uz.bildirishnoma.barchasi));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/admin/notifications/read-all"));
  });

  it("tarbiyachida qo'ng'iroq yo'q (bo'sh tugma qolmaydi); Super Admin — xabarlar sahifasiga havola", () => {
    authUser = { id: 3, name: "T", role: "teacher" };
    const { container, unmount } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(api.get).not.toHaveBeenCalled();
    unmount();

    authUser = { id: 4, name: "SA", role: "super_admin" };
    render(<NotificationBell />);
    expect(screen.getByRole("link", { name: uz.bildirishnoma.sarlavha })).toHaveAttribute("href", "/admin/xabarlar");
  });
});

describe("Sozlamalar", () => {
  it("rahbar: bog'cha ma'lumotlari va parolni almashtirish", async () => {
    vi.mocked(api.get).mockResolvedValue({ bogcha: { name: "1-sonli DMTT", number: "1", district: "Bo'stonliq tumani", mfy: "Kichiksoy MFY",
      address: "Obod ko'chasi", capacity: 180, director_name: "Rahbar F.", director_phone: null, phone: null } });
    vi.mocked(api.put).mockResolvedValue({ user: { id: 2, role: "admin", must_change_password: false } });
    render(<BogchaSozlamalarPage />);

    expect(await screen.findByTestId("bogcha-info")).toHaveTextContent("Kichiksoy MFY");
    expect(screen.getByText("dmtt1")).toBeInTheDocument();

    fireEvent.change(document.getElementById("settings-current")!, { target: { value: "Eski-parol-1" } });
    fireEvent.change(document.getElementById("settings-new")!, { target: { value: "Yangi-parol-1" } });
    fireEvent.change(document.getElementById("settings-confirm")!, { target: { value: "boshqa" } });
    fireEvent.click(screen.getByRole("button", { name: uz.parol_almashtirish.saqlash }));
    expect(screen.getByText(uz.parol_almashtirish.mos_emas)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.change(document.getElementById("settings-confirm")!, { target: { value: "Yangi-parol-1" } });
    fireEvent.click(screen.getByRole("button", { name: uz.parol_almashtirish.saqlash }));
    expect(await screen.findByRole("status")).toHaveTextContent(uz.sozlamalar.saqlandi);
    expect(api.put).toHaveBeenCalledWith("/v1/me/password", { current_password: "Eski-parol-1", password: "Yangi-parol-1", password_confirmation: "Yangi-parol-1" });
    expect(updateUser).toHaveBeenCalled();
  });
});

describe("To'lovlar (rahbar)", () => {
  const overview = (paid: boolean) => ({
    month: "2026-11",
    summary: { jami: 2, tolagan: paid ? 1 : 0, tolanmagan: paid ? 1 : 2, summa: paid ? 450000 : 0 },
    groups: [{ id: 1, name: "Quyoshcha" }],
    children: [
      { id: 10, first_name: "Ali", last_name: "Karimov", group: { id: 1, name: "Quyoshcha" },
        payment: paid ? { id: 1, month: "2026-11", amount: 450000, paid_at: "2026-11-03", note: null } : null },
      { id: 11, first_name: "Malika", last_name: "Saidova", group: { id: 1, name: "Quyoshcha" }, payment: null },
    ],
  });

  it("holat, qayd etish (PUT) va bekor qilish (DELETE)", async () => {
    vi.mocked(api.get).mockResolvedValue(overview(true));
    vi.mocked(api.put).mockResolvedValue({});
    vi.mocked(api.delete).mockResolvedValue({});
    render(<TolovlarPage />);

    const paidRow = await screen.findByTestId("pay-row-10");
    expect(within(paidRow).getByText(uz.tolov.tolangan_badge)).toBeInTheDocument();
    expect(screen.getByTestId("pay-tolagan")).toHaveTextContent("1");

    fireEvent.click(within(screen.getByTestId("pay-row-11")).getByRole("button", { name: uz.tolov.qayd_etish }));
    expect(document.getElementById("payment-amount")).toHaveValue(450000); // oldingi summa taklif qilinadi
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/admin/payments",
      expect.objectContaining({ child_id: 11, month: expect.stringMatching(/^\d{4}-\d{2}$/), amount: 450000 })));
    expect(await screen.findByRole("status")).toHaveTextContent(uz.tolov.saqlandi);

    fireEvent.click(within(screen.getByTestId("pay-row-10")).getByRole("button", { name: uz.tolov.bekor }));
    const confirm = screen.getAllByRole("button", { name: uz.tolov.bekor });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(expect.stringMatching(/^\/v1\/admin\/payments\/10\/\d{4}-\d{2}$/)));
  });

  it("Super Admin impersonatsiyada faqat ko'radi — amal tugmalari yo'q", async () => {
    // Ko'rish rejimi — impersonation.start() yozadigan sessionStorage kaliti orqali (useReadOnly)
    vi.mocked(impersonation.active).mockReturnValue(true);
    sessionStorage.setItem("impersonated_org_id", "1");
    vi.mocked(api.get).mockResolvedValue(overview(true));
    render(<TolovlarPage />);
    await screen.findByTestId("pay-row-10");
    await waitFor(() => expect(screen.queryByRole("button", { name: uz.tolov.qayd_etish })).toBeNull());
    expect(screen.queryByRole("button", { name: uz.tolov.bekor })).toBeNull();
    sessionStorage.removeItem("impersonated_org_id");
  });

  it("yuklash xatosi → qayta urinish", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("x")).mockResolvedValue(overview(false));
    render(<TolovlarPage />);
    fireEvent.click(await screen.findByRole("button", { name: uz.common.qayta_urinish }));
    expect(await screen.findByTestId("pay-row-11")).toBeInTheDocument();
  });
});

describe("Fotogalereya", () => {
  const page = (photos: unknown[]) => ({ data: photos, meta: { current_page: 1, last_page: 1, total: photos.length }, groups: [{ id: 5, name: "Kamalak" }] });

  it("bo'sh holat → yuklash (multipart) → ro'yxat yangilanadi", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([])).mockResolvedValue(page([
      { id: 1, url: "http://api/v1/teacher/photos/1/file", caption: "Bayram", taken_on: "2026-11-05", group: { id: 5, name: "Kamalak" }, uploaded_by: "T", can_delete: true },
    ]));
    vi.mocked(uploadFile).mockResolvedValue({});
    render(<PhotoGallery basePath="/v1/teacher" description="d" />);

    expect(await screen.findByText(uz.foto.bosh)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: uz.foto.yuklash })[0]);
    // bitta guruh — avtomatik tanlanadi; fayl tanlanmasa xabar
    const submit = screen.getAllByRole("button", { name: uz.foto.yuklash });
    fireEvent.click(submit[submit.length - 1]);
    expect(await screen.findByText(uz.foto.fayl_tanlang)).toBeInTheDocument();

    fireEvent.change(document.getElementById("photo-file")!, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    fireEvent.click(submit[submit.length - 1]);
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
    const [path, form] = vi.mocked(uploadFile).mock.calls[0] as [string, FormData];
    expect(path).toBe("/v1/teacher/photos");
    expect(form.get("group_id")).toBe("5");
    expect(form.get("photo")).toBeInstanceOf(File);
    expect(await screen.findByTestId("photo-grid")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(uz.foto.yuklandi);
  });

  it("tarbiyachi boshqa birov yuklagan rasmni o'chira olmaydi", async () => {
    vi.mocked(api.get).mockResolvedValue(page([
      { id: 2, url: "u", caption: "Rahbar rasmi", taken_on: "2026-11-05", group: { id: 5, name: "Kamalak" }, uploaded_by: "R", can_delete: false },
    ]));
    render(<PhotoGallery basePath="/v1/teacher" description="d" />);
    fireEvent.click(await screen.findByRole("button", { name: "Rahbar rasmi" }));
    expect(screen.queryByRole("button", { name: uz.foto.ochirish })).toBeNull();
  });
});

describe("Super Admin → bog'chaga xabar", () => {
  it("bog'cha ID bilan POST qiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const onSent = vi.fn();
    render(<SendNotificationModal orgId={12} open onClose={vi.fn()} onSent={onSent} />);
    fireEvent.change(document.getElementById("notif-title")!, { target: { value: "Tekshiruv" } });
    fireEvent.change(document.getElementById("notif-message")!, { target: { value: "Ertaga" } });
    fireEvent.click(screen.getByRole("button", { name: uz.bildirishnoma.yuborish }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/super-admin/notifications",
      { title: "Tekshiruv", message: "Ertaga", type: "info", organization_id: 12 }));
    expect(onSent).toHaveBeenCalledWith(uz.bildirishnoma.yuborildi);
  });
});
