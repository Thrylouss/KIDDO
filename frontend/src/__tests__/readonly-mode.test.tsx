import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BolalarPage from "@/app/bogcha/bolalar/page";
import GuruhlarPage from "@/app/bogcha/guruhlar/page";
import OtaOnalarPage from "@/app/bogcha/ota-onalar/page";
import TarbiyachilarPage from "@/app/bogcha/tarbiyachilar/page";
import BogchaXabarlarPage from "@/app/bogcha/xabarlar/page";
import AttendanceManager from "@/components/attendance/AttendanceManager";
import DailyManager from "@/components/daily/DailyManager";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

// Super Admin «faqat ko'rish» rejimi (impersonatsiya) — barcha bog'cha sahifalarida yagona useReadOnly()
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const GROUPS   = [{ id: 7, organization_id: 1, name: "Quyosh", age_category: "3-4 yosh", capacity: 20, is_active: true, children_count: 1, teacher_profiles_count: 1 }];
const TEACHERS = [{ id: 3, user_id: 30, organization_id: 1, first_name: "Dilnoza", last_name: "Karimova", phone: "+998901110001", position: "Tarbiyachi", is_active: true, groups: [] }];
const PARENTS  = [{ id: 4, user_id: 40, organization_id: 1, first_name: "Mohira", last_name: "Yusupova", phone: "+998901110002", relation_type: "ona", children: [], user: { id: 40, is_active: true } }];
const CHILDREN = [{ id: 5, organization_id: 1, group_id: 7, first_name: "Ali", last_name: "Valiyev", birth_date: "2021-04-12", gender: "erkak", is_active: true, group: { id: 7, name: "Quyosh" } }];
const ATT_DAY = {
  groups: [{ id: 7, name: "Quyosh" }], group: { id: 7, name: "Quyosh", age_category: null, capacity: null },
  date: "2026-10-28", editable: true, editable_from: "2026-09-28",
  children: [{ id: 1, first_name: "Ali", last_name: "Valiyev", status: null, note: null }],
  summary: { total: 1, present: 0, absent: 0, excused: 0, unmarked: 1 },
};
const DAILY_DAY = {
  groups: [{ id: 7, name: "Quyosh" }], group: { id: 7, name: "Quyosh" }, date: "2026-10-28", editable: true, editable_from: "2026-10-26",
  meal_types: ["nonushta"], children: [{ id: 1, first_name: "Ali", last_name: "Valiyev", attendance: "present", meals: [], sleep: null }],
  activities: [],
};

// impersonation.start() bilan bir xil kalit
function setReadOnly(on: boolean) {
  if (on) sessionStorage.setItem("impersonated_org_id", "1");
  else sessionStorage.removeItem("impersonated_org_id");
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.location.hash = "";
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith("/v1/admin/groups"))   return { data: GROUPS };
    if (path.startsWith("/v1/admin/teachers")) return { data: TEACHERS };
    if (path.startsWith("/v1/admin/parents"))  return { data: PARENTS };
    if (path.startsWith("/v1/admin/children")) return { data: CHILDREN };
    if (path.startsWith("/v1/admin/messages")) return { groups: [{ id: 7, name: "Quyosh" }], data: [] };
    if (path.startsWith("/v1/admin/attendance")) return ATT_DAY;
    if (path.startsWith("/v1/admin/daily")) return DAILY_DAY;
    return { data: [] };
  });
});

const btn = (name: string | RegExp) => screen.queryByRole("button", { name });

describe("Super Admin ko'rish rejimi — mutatsiya tugmalari ko'rsatilmaydi", () => {
  it("Bolalar: qo'shish/tahrirlash/o'chirish yo'q; ota-onalar ro'yxati ko'rinadi, bog'lash yo'q", async () => {
    setReadOnly(false);
    const { unmount } = render(<BolalarPage />);
    expect((await screen.findAllByText("Valiyev Ali", { exact: false })).length).toBeGreaterThan(0);
    expect(btn(new RegExp(uz.bolalar.qoshish))).not.toBeNull();
    expect(screen.getAllByRole("button", { name: uz.common.tahrirlash }).length).toBeGreaterThan(0);
    unmount();

    setReadOnly(true);
    render(<BolalarPage />);
    expect((await screen.findAllByText("Valiyev Ali", { exact: false })).length).toBeGreaterThan(0);
    await waitFor(() => expect(btn(new RegExp(uz.bolalar.qoshish))).toBeNull());
    expect(screen.queryAllByRole("button", { name: uz.common.tahrirlash })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: uz.common.ochirish })).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: uz.bolalar.ota_onalar_btn })[0]);
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.queryByText(uz.bolalar.ota_ona_boglash)).toBeNull());
    expect(btn(uz.bolalar.boglash)).toBeNull();
  });

  it("Guruhlar", async () => {
    setReadOnly(true);
    render(<GuruhlarPage />);
    expect(await screen.findByText("Quyosh")).toBeInTheDocument();
    await waitFor(() => expect(btn(new RegExp(uz.guruhlar.qoshish))).toBeNull());
    expect(btn(`${uz.common.tahrirlash}: Quyosh`)).toBeNull();
    expect(btn(`${uz.common.ochirish}: Quyosh`)).toBeNull();
  });

  it("Ota-onalar va tarbiyachilar", async () => {
    setReadOnly(true);
    const { unmount } = render(<OtaOnalarPage />);
    expect((await screen.findAllByText(/Yusupova/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(btn(new RegExp(uz.ota_onalar.qoshish))).toBeNull());
    for (const n of [uz.common.tahrirlash, uz.common.parolni_tiklash, uz.common.faolsizlantirish]) expect(btn(n)).toBeNull();
    unmount();

    render(<TarbiyachilarPage />);
    expect((await screen.findAllByText(/Karimova/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(btn(new RegExp(uz.tarbiyachilar.qoshish))).toBeNull());
    for (const n of [uz.tarbiyachilar.guruhlar_btn, uz.common.tahrirlash, uz.common.parolni_tiklash]) expect(btn(n)).toBeNull();
  });

  it("Davomat: belgilash tugmalari o'chiq, ko'rish rejimi izohi", async () => {
    setReadOnly(true);
    render(<AttendanceManager loadPath="/v1/admin/attendance" savePath="/v1/admin/attendance" noGroupsText="—" />);
    expect(await screen.findByText(uz.super_admin.faqat_korish)).toBeInTheDocument();
    for (const b of screen.getAllByRole("button", { name: uz.davomat.keldi })) expect(b).toBeDisabled();
    expect(screen.queryByText(uz.davomat.tahrir_muddati, { exact: false })).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("Davomat: oddiy rahbar uchun tahrirlash ochiq (huquqlar o'zgarmagan)", async () => {
    setReadOnly(false);
    render(<AttendanceManager loadPath="/v1/admin/attendance" savePath="/v1/admin/attendance" noGroupsText="—" />);
    const keldi = await screen.findAllByRole("button", { name: uz.davomat.keldi });
    expect(keldi[0]).not.toBeDisabled();
    expect(screen.queryByText(uz.super_admin.faqat_korish)).toBeNull();
  });

  it("Kundalik: barcha panellar faqat ko'rish", async () => {
    setReadOnly(true);
    render(<DailyManager basePath="/v1/admin/daily" noGroupsText="—" />);
    expect(await screen.findByText(uz.super_admin.faqat_korish)).toBeInTheDocument();
  });

  it("Xabarlar: yangi xabar formasi yo'q, tarix ko'rinadi", async () => {
    setReadOnly(true);
    render(<BogchaXabarlarPage />);
    expect(await screen.findByText(uz.xabarlar.tarix)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(uz.xabarlar.yangi)).toBeNull());
    expect(btn(uz.xabarlar.yuborish)).toBeNull();
  });
});
