import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BogchalarPage from "@/app/admin/bogchalar/page";
import OrgDetailPage from "@/app/admin/bogchalar/[id]/page";
import OrgFormModal from "@/components/organizations/OrgFormModal";
import OrgStatusDialog from "@/components/organizations/OrgStatusDialog";
import OrgDeleteDialog from "@/components/organizations/OrgDeleteDialog";
import OrgBulkStatusDialog from "@/components/organizations/OrgBulkStatusDialog";
import { api, downloadFile } from "@/lib/api";
import { filtersFromParams, filtersToQuery, DEFAULT_FILTERS, normalizeUzPhone, orgAddress } from "@/lib/organizations";
import uz from "@/i18n/uz";
import type { OrganizationSummary } from "@/types";

const t = uz.bogchalar;
const push = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  downloadFile: vi.fn(),
  impersonation: { start: vi.fn() },
}));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useParams: () => ({ id: "7" }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/components/organizations/AdminAccountCard", () => ({ default: () => <div data-testid="admin-card" /> }));

const org = (over: Partial<OrganizationSummary> = {}): OrganizationSummary => ({
  id: 7, name: "12-sonli DMTT", type: "davlat", phone: "+998711234567", address: null, region: "Toshkent viloyati",
  district: "Bo'stonliq tumani", mfy: "Markaz MFY", street: null, is_active: true, status: "active", created_at: "2026-11-01T10:00:00Z",
  director_name: "Aliyeva Malika", director_phone: "+998901112233", admin: null, subscription: null,
  children_count: 40, groups_count: 3, teachers_count: 4, official_code: "K-12", ...over,
});

const STATS = { total: 30, davlat: 28, xususiy: 2, turi_yoq: 0, active: 27, inactive: 1, suspended: 1, archived: 1, recent: [] };

const calls = () => vi.mocked(api.get).mock.calls.map(([p]) => String(p));
const listCalls = () => calls().filter((p) => p.startsWith("/v1/super-admin/organizations?"));
const qs = (p: string) => new URLSearchParams(p.split("?")[1]);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/admin/bogchalar");
  try { localStorage.clear(); } catch { /* */ }
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith("/v1/super-admin/organizations/stats")) return { data: STATS };
    if (path.startsWith("/v1/super-admin/organizations/filter-options")) return { data: { districts: ["Bo'stonliq tumani", "Chilonzor tumani"], regions: [], mfys: [] } };
    if (path.startsWith("/v1/super-admin/organizations?")) {
      const page = Number(qs(path).get("page") ?? 1);
      return { data: [org(), org({ id: 8, name: "Quyoshcha", type: "xususiy", status: "suspended", is_active: false, suspended_until: "2026-12-01T00:00:00Z" })],
        meta: { current_page: page, last_page: 3, per_page: Number(qs(path).get("per_page") ?? 20), total: 45 } };
    }
    return { data: [] };
  });
});

describe("lib/organizations", () => {
  it("filtrlar URL ↔ holat, noto'g'ri qiymatlar tozalanadi", () => {
    const f = filtersFromParams(new URLSearchParams("type=xususiy&status=archived&per_page=50&page=2&district=X&type2=1"));
    expect(f).toMatchObject({ type: "xususiy", status: "archived", per_page: 50, page: 2, district: "X" });
    expect(filtersFromParams(new URLSearchParams("type=aralash&status=yoq&per_page=33"))).toMatchObject({ type: "", status: "", per_page: 20 });
    expect(filtersToQuery({ ...DEFAULT_FILTERS, type: "davlat" }).toString()).toBe("type=davlat");
    expect(filtersToQuery(DEFAULT_FILTERS, { forApi: true }).toString()).toContain("turi=real");
  });

  it("telefon va manzil", () => {
    expect(normalizeUzPhone("90 111 22 33")).toBe("+998901112233");
    expect(normalizeUzPhone("+998 (71) 123-45-67")).toBe("+998711234567");
    expect(normalizeUzPhone("123")).toBeNull();
    expect(orgAddress(org())).toBe("Toshkent viloyati, Bo'stonliq tumani, Markaz MFY");
  });
});

describe("Bog'chalar sahifasi", () => {
  it("sarlavha, statistika (real), jadval ustunlari, turi va holat", async () => {
    render(<BogchalarPage />);
    expect(screen.getByRole("heading", { name: t.sarlavha })).toBeInTheDocument();
    expect(screen.getByText(t.tavsif)).toBeInTheDocument();
    expect(await screen.findByText("12-sonli DMTT")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId("stat-davlat")).getByText("28")).toBeInTheDocument());

    const table = screen.getByTestId("org-table");
    for (const col of [t.col_nomi, t.col_turi, t.col_masul, t.col_telefon, t.col_manzil, t.col_tuman_mfy, t.col_bolalar, t.col_guruhlar, t.col_tarbiyachilar, t.col_holat, t.col_sana]) {
      expect(within(table).getAllByText(col).length).toBeGreaterThan(0);
    }
    expect(within(table).getByText(t.turi_xususiy)).toBeInTheDocument();
    expect(within(table).getByText(t.holat_suspended)).toBeInTheDocument();
    expect(within(table).getByText(/01\.12\.2026/)).toBeInTheDocument();
    expect(within(table).getAllByRole("link", { name: "+998 71 123 45 67" })[0]).toHaveAttribute("href", "tel:+998711234567");
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(listCalls()[0]).toContain("turi=real");
  });

  it("statistika kartasi filtr qo'llaydi; bir nechta filtr birga; tozalash", async () => {
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");

    fireEvent.click(screen.getByTestId("stat-suspended"));
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("status")).toBe("suspended"));
    fireEvent.change(screen.getByLabelText(t.turi), { target: { value: "xususiy" } });
    fireEvent.change(screen.getByLabelText(t.filtr_tuman), { target: { value: "Chilonzor tumani" } });
    await waitFor(() => {
      const q = qs(listCalls().at(-1)!);
      expect([q.get("status"), q.get("type"), q.get("district"), q.get("page")]).toEqual(["suspended", "xususiy", "Chilonzor tumani", "1"]);
    });
    expect(window.location.search).toContain("status=suspended");

    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.filtr_tozalash) }));
    await waitFor(() => {
      const q = qs(listCalls().at(-1)!);
      expect([q.get("status"), q.get("type"), q.get("district")]).toEqual([null, null, null]);
    });
  });

  it("qidiruv backend'ga debounce bilan yuboriladi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");
    const before = listCalls().length;
    fireEvent.change(screen.getByLabelText(t.qidiruv), { target: { value: "dil" } });
    fireEvent.change(screen.getByLabelText(t.qidiruv), { target: { value: "dilnoza" } });
    expect(listCalls().length).toBe(before);
    await act(async () => { vi.advanceTimersByTime(400); });
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("search")).toBe("dilnoza"));
    expect(listCalls().filter((c) => c.includes("search=")).length).toBe(1);
    vi.useRealTimers();
  });

  it("saralash (sarlavha va tanlov), pagination va sahifadagi soni", async () => {
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");

    fireEvent.click(within(screen.getByTestId("org-table")).getByRole("button", { name: new RegExp(t.col_bolalar) }));
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("sort")).toBe("children_count"));
    fireEvent.change(screen.getByLabelText(t.saralash), { target: { value: "name_desc" } });
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("sort")).toBe("name_desc"));

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("page")).toBe("3"));
    fireEvent.change(screen.getByDisplayValue("20"), { target: { value: "50" } });
    await waitFor(() => {
      const q = qs(listCalls().at(-1)!);
      expect([q.get("per_page"), q.get("page")]).toEqual(["50", "1"]);
    });
  });

  it("jadval ↔ kartochka bir xil ma'lumot, tanlov saqlanadi", async () => {
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");
    const before = listCalls().length;
    fireEvent.click(screen.getByRole("button", { name: t.kartochka }));
    const cards = screen.getByTestId("org-cards");
    expect(within(cards).getByText("Quyoshcha")).toBeInTheDocument();
    expect(within(cards).getAllByText(t.batafsil + " →").length).toBe(2);
    expect(listCalls().length).toBe(before);            // qayta so'rov yo'q
    expect(localStorage.getItem("kiddo.bogchalar.view")).toBe("cards");
  });

  it("tanlanganlarni va filtrlanganlarni Excel'ga eksport", async () => {
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");
    fireEvent.click(screen.getByLabelText(`${t.tanlash}: Quyoshcha`));
    fireEvent.click(screen.getByRole("button", { name: t.eksport_tanlangan }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
    expect(String(vi.mocked(downloadFile).mock.calls[0][0])).toMatch(/\/export\?.*ids=8/);

    fireEvent.click(screen.getByRole("button", { name: t.eksport }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(2));
    const url = String(vi.mocked(downloadFile).mock.calls[1][0]);
    expect(url).not.toContain("ids=");
    expect(url).not.toContain("page=");
  });

  it("bo'sh, filtr natijasiz va xato holatlari", async () => {
    vi.mocked(api.get).mockImplementation(async (p: string) =>
      p.includes("/stats") ? { data: STATS } : p.includes("filter-options") ? { data: [] } : { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    const { unmount } = render(<BogchalarPage />);
    expect(await screen.findByText(t.bosh)).toBeInTheDocument();
    unmount();

    window.history.replaceState(null, "", "/admin/bogchalar?type=xususiy");
    const r2 = render(<BogchalarPage />);
    expect(await screen.findByText(t.topilmadi)).toBeInTheDocument();
    r2.unmount();

    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error("x"), { status: 500, data: {} }));
    render(<BogchalarPage />);
    expect(await screen.findByText(uz.common.yuklash_xatosi)).toBeInTheDocument();
  });
});

describe("Bog'cha formasi (wizard)", () => {
  it("majburiy maydonlar, qadamlar, rahbar akkaunti va bir martalik parol", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 31, admin: { id: 5, name: "Aliyeva", username: "dmtt31", temporary_password: "Abc123xyZ789" } } });
    const onSaved = vi.fn(), onOpen = vi.fn();
    render(<OrgFormModal open onClose={() => {}} onSaved={onSaved} onOpenProfile={onOpen} />);

    fireEvent.submit(document.getElementById("org-form")!);
    expect(await screen.findAllByText(t.f_majburiy)).toHaveLength(2);         // nomi + turi
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Bog'cha nomi/), { target: { value: "31-sonli DMTT" } });
    fireEvent.click(screen.getByLabelText(t.turi_davlat));
    fireEvent.change(screen.getByLabelText(t.f_telefon), { target: { value: "12" } });
    fireEvent.submit(document.getElementById("org-form")!);
    expect(await screen.findByText(t.f_telefon_xato)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.f_telefon), { target: { value: "71 123 45 67" } });

    for (let i = 0; i < 4; i++) fireEvent.submit(document.getElementById("org-form")!);
    fireEvent.click(screen.getByLabelText(new RegExp(t.f_akkaunt_yaratish)));
    fireEvent.change(screen.getByLabelText(new RegExp(t.f_login)), { target: { value: "DMTT31" } });
    fireEvent.click(screen.getByRole("button", { name: t.yaratish }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/v1/super-admin/organizations");
    expect(body).toMatchObject({ name: "31-sonli DMTT", type: "davlat", phone: "+998711234567", admin_username: "dmtt31" });
    expect(body).not.toHaveProperty("children_count");

    expect(await screen.findByTestId("org-created")).toHaveTextContent("Abc123xyZ789");
    expect(onSaved).toHaveBeenCalledWith(31);
    fireEvent.click(screen.getByRole("button", { name: t.profilga_otish }));
    expect(onOpen).toHaveBeenCalledWith(31);
  });

  it("server xatosi tegishli qadamga qaytaradi", async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error("x"), { status: 422, data: { errors: { official_code: ["Bu rasmiy kod boshqa bog'chaga biriktirilgan."] } } }));
    render(<OrgFormModal open onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Bog'cha nomi/), { target: { value: "Bog'cha" } });
    fireEvent.click(screen.getByLabelText(t.turi_xususiy));
    fireEvent.change(screen.getByLabelText(t.f_kod), { target: { value: "K-1" } });
    for (let i = 0; i < 4; i++) fireEvent.submit(document.getElementById("org-form")!);
    fireEvent.click(screen.getByRole("button", { name: t.yaratish }));
    expect(await screen.findByText("Bu rasmiy kod boshqa bog'chaga biriktirilgan.")).toBeInTheDocument();
    expect(screen.getByLabelText(t.f_kod)).toHaveValue("K-1");                    // 1-qadamga qaytdi
  });

  it("tahrirlash: oldindan to'ldirilgan, PUT, akkaunt qadami yo'q", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: org() });
    const onSaved = vi.fn();
    render(<OrgFormModal open org={org()} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByLabelText(/Bog'cha nomi/)).toHaveValue("12-sonli DMTT");
    expect(screen.queryByText(t.qadam_akkaunt)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Bog'cha nomi/), { target: { value: "12-sonli DMTT (yangi)" } });
    for (let i = 0; i < 3; i++) fireEvent.submit(document.getElementById("org-form")!);
    fireEvent.click(screen.getByRole("button", { name: t.saqlash }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/super-admin/organizations/7", expect.objectContaining({ name: "12-sonli DMTT (yangi)", type: "davlat" })));
    expect(onSaved).toHaveBeenCalledWith(7);
  });
});

describe("Holat va o'chirish dialoglari", () => {
  it("to'xtatish: sabab majburiy, muddat bilan PATCH", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: org({ status: "suspended", is_active: false }) });
    const onChanged = vi.fn();
    render(<OrgStatusDialog org={org()} onClose={() => {}} onChanged={onChanged} />);
    expect(screen.getByLabelText(new RegExp(t.holat_suspended))).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: t.holat_tasdiq }));
    expect(await screen.findByText(t.sabab_majburiy)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(new RegExp(t.sabab)), { target: { value: "Hujjatlar tekshirilmoqda" } });
    fireEvent.change(screen.getByLabelText(t.muddat), { target: { value: "2030-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: t.holat_tasdiq }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/v1/super-admin/organizations/7/status",
      { status: "suspended", reason: "Hujjatlar tekshirilmoqda", suspended_until: "2030-01-15T00:00:00" }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("arxivlash va faollashtirish variantlari", () => {
    render(<OrgStatusDialog org={org({ status: "archived", is_active: false })} onClose={() => {}} onChanged={() => {}} />);
    const radio = (v: string) => document.querySelector<HTMLInputElement>(`input[name="org-status"][value="${v}"]`);
    expect(radio("active")).toBeChecked();      // arxivdan — faollashtirish taklif
    expect(radio("archived")).toBeNull();       // joriy holat ro'yxatda yo'q
    expect(radio("suspended")).not.toBeNull();
    expect(screen.getByText(t.holat_izoh_active)).toBeInTheDocument();
  });

  it("o'chirish: nom aynan kiritilmaguncha tugma o'chiq; bog'langan ma'lumot → arxivlash taklifi", async () => {
    vi.mocked(api.delete).mockRejectedValue(Object.assign(new Error("x"), { status: 422,
      data: { message: "Bu bog'chaga bog'langan ma'lumotlar bor, uni o'chirib bo'lmaydi. O'rniga arxivlang.", data: { linked: { bolalar: 40 } } } }));
    const onArchive = vi.fn();
    render(<OrgDeleteDialog org={org()} onClose={() => {}} onDeleted={() => {}} onArchive={onArchive} />);
    const btn = screen.getByRole("button", { name: t.ochir_tugma });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.ochir_tasdiq_label), { target: { value: "12-sonli dmtt" } });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/v1/super-admin/organizations/7", { body: { confirm_name: "12-sonli dmtt" } }));
    expect(await screen.findByText(/O'rniga arxivlang/)).toBeInTheDocument();
    expect(screen.getByText(`${t.st_bolalar}: 40`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.arxivlash_tavsiya }));
    expect(onArchive).toHaveBeenCalled();
  });
});

describe("Bog'cha batafsil sahifasi", () => {
  const detail = { ...org({ status: "suspended", is_active: false, status_reason: "Tekshiruv", suspended_until: "2026-12-01T00:00:00Z" }),
    admins: [], groups_count: 3, children_count: 40, teacher_profiles_count: 4, parent_profiles_count: 35,
    bugungi_davomat: { sana: "2026-11-06", jami: 40, keldi: 33, kelmadi: 4, sababli: 2, belgilanmagan: 1 } };

  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/bogchalar/7");
    vi.mocked(api.get).mockImplementation(async (p: string) => {
      if (p === "/v1/super-admin/organizations/7") return { data: detail };
      if (p.includes("/groups")) return { data: [{ id: 1, name: "Quyoshcha", age_category: "3-4 yosh", capacity: 20, is_active: true, children_count: 18, teachers: ["Karimova D."] }] };
      if (p.includes("/children-summary")) return { data: { jami: 42, faol: 40, nofaol: 2, jins: { ogil: 21, qiz: 19 }, guruhlar: [{ group: "Quyoshcha", count: 18 }], yosh: [{ age: 4, count: 18 }] } };
      if (p.includes("/status-history")) return { data: [{ id: 1, from_status: "active", to_status: "suspended", from_label: "Faol", to_label: "Vaqtincha to'xtatilgan", reason: "Tekshiruv", suspended_until: null, changed_by: "Super Admin", created_at: "2026-11-06T10:00:00Z" }] };
      return { data: [] };
    });
  });

  it("header, real statistika, holat banneri va tablar", async () => {
    render(<OrgDetailPage />);
    expect(await screen.findByRole("heading", { name: "12-sonli DMTT" })).toBeInTheDocument();
    expect(screen.getByTestId("status-banner")).toHaveTextContent("Tekshiruv");
    expect(screen.getByText("33/40")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByTestId("org-attendance")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: t.tab_guruhlar }));
    expect(await screen.findByText("Karimova D.")).toBeInTheDocument();
    expect(window.location.hash).toBe("#guruhlar");

    fireEvent.click(screen.getByRole("tab", { name: t.tab_bolalar }));
    expect(await screen.findByText(t.maxfiylik)).toBeInTheDocument();
    expect(screen.getByText("19")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: t.tab_tarix }));
    expect(await screen.findByTestId("status-history")).toHaveTextContent("Tekshiruv");

    fireEvent.click(screen.getByRole("tab", { name: t.tab_akkaunt }));
    expect(screen.getByTestId("admin-card")).toBeInTheDocument();
  });

  it("tab ma'lumoti yuklanmasa — xato va qayta urinish", async () => {
    vi.mocked(api.get).mockImplementation(async (p: string) => {
      if (p === "/v1/super-admin/organizations/7") return { data: detail };
      throw Object.assign(new Error("x"), { status: 500, data: {} });
    });
    render(<OrgDetailPage />);
    await screen.findByRole("heading", { name: "12-sonli DMTT" });
    fireEvent.click(screen.getByRole("tab", { name: t.tab_tarbiyachilar }));
    expect(await screen.findByRole("button", { name: uz.common.qayta_urinish })).toBeInTheDocument();
  });

  it("bog'cha topilmasa — xato holati", async () => {
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error("x"), { status: 404, data: { message: "Topilmadi." } }));
    render(<OrgDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Topilmadi.");
  });
});

describe("Yakuniy audit qo'shimchalari", () => {
  it("ko'rinish URL'da saqlanadi va filtrlar almashganda yo'qolmaydi", async () => {
    window.history.replaceState(null, "", "/admin/bogchalar?view=cards&type=xususiy");
    render(<BogchalarPage />);
    expect(await screen.findByTestId("org-cards")).toBeInTheDocument();
    await waitFor(() => expect(qs(listCalls().at(-1)!).get("type")).toBe("xususiy"));
    fireEvent.click(screen.getByRole("button", { name: t.jadval }));
    await waitFor(() => expect(window.location.search).not.toContain("view=cards"));
    expect(window.location.search).toContain("type=xususiy");                           // filtr saqlandi
    fireEvent.click(screen.getByRole("button", { name: t.kartochka }));
    await waitFor(() => expect(window.location.search).toContain("view=cards"));
  });

  it("viloyat, MFY va guruhlar soni filtrlari server'ga yuboriladi; URL'dan tiklansa panel ochiq", async () => {
    window.history.replaceState(null, "", "/admin/bogchalar?groups_min=2");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");
    expect(screen.getByLabelText(t.filtr_guruh_min)).toHaveValue(2);
    fireEvent.change(screen.getByLabelText(t.f_viloyat), { target: { value: "Toshkent viloyati" } });
    fireEvent.change(screen.getByLabelText(t.f_mfy), { target: { value: "Markaz" } });
    await act(async () => { vi.advanceTimersByTime(400); });
    fireEvent.change(screen.getByLabelText(t.filtr_guruh_max), { target: { value: "5" } });
    await waitFor(() => {
      const q = qs(listCalls().at(-1)!);
      expect([q.get("region"), q.get("mfy"), q.get("groups_min"), q.get("groups_max")]).toEqual(["Toshkent viloyati", "Markaz", "2", "5"]);
    });
    vi.useRealTimers();
  });

  it("jadvalda tuman va MFY, kartochkada raqam", async () => {
    vi.mocked(api.get).mockImplementation(async (p: string) =>
      p.includes("/stats") ? { data: STATS } : p.includes("filter-options") ? { data: { districts: [], regions: [], mfys: [] } }
        : { data: [org({ number: "12" })], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } });
    render(<BogchalarPage />);
    const table = await screen.findByTestId("org-table");
    expect(within(table).getByText(t.col_tuman_mfy)).toBeInTheDocument();
    expect(within(table).getByText("Markaz MFY")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.kartochka }));
    expect(within(screen.getByTestId("org-cards")).getByText(/№ 12/)).toBeInTheDocument();
    // Mobil: kartochkalar ro'yxati aniq bitta ustundan boshlanadi (kontent kengligi bilan cho'zilmaydi)
    expect(screen.getByTestId("org-cards").className).toMatch(/(^|\s)grid-cols-1(\s|$)/);
  });

  it("ommaviy arxivlash: sabab majburiy, tanlanganlar yuboriladi, o'chirish amali yo'q", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { changed: [7], skipped: [8] } });
    const onDone = vi.fn();
    render(<OrgBulkStatusDialog action="archived" ids={[7, 8]} onClose={() => {}} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: `${t.ommaviy_arxiv} (2)` }));
    expect(await screen.findByText(t.sabab_majburiy)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(new RegExp(t.sabab)), { target: { value: "Mavsum yakunlandi" } });
    fireEvent.click(screen.getByRole("button", { name: `${t.ommaviy_arxiv} (2)` }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/super-admin/organizations/bulk-status",
      { ids: [7, 8], status: "archived", reason: "Mavsum yakunlandi" }));
    expect(onDone).toHaveBeenCalledWith({ changed: [7], skipped: [8] });
  });

  it("sahifada tanlov paneli: arxivlash va tiklash bor, ommaviy o'chirish yo'q", async () => {
    render(<BogchalarPage />);
    await screen.findByText("12-sonli DMTT");
    fireEvent.click(screen.getByLabelText(`${t.tanlash}: Quyoshcha`));
    expect(screen.getByRole("button", { name: t.ommaviy_arxiv })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.ommaviy_tiklash })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /o'chirish/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.ommaviy_tiklash }));
    expect(await screen.findByText(t.ommaviy_sarlavha_tiklash)).toBeInTheDocument();
  });
});
