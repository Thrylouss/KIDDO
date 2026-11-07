import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import GuruhlarPage from "@/app/bogcha/guruhlar/page";
import TarbiyachilarPage from "@/app/bogcha/tarbiyachilar/page";
import OtaOnalarPage from "@/app/bogcha/ota-onalar/page";
import BolalarPage from "@/app/bogcha/bolalar/page";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false; API soxta (real backend integratsiyasi emas) ───────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const GROUPS = [
  { id: 7, organization_id: 1, name: "Quyosh", age_category: "3-4 yosh", capacity: 20, is_active: true, children_count: 2, teacher_profiles_count: 1 },
];
const TEACHERS = [
  { id: 3, user_id: 30, organization_id: 1, first_name: "Dilnoza", last_name: "Karimova", phone: "+998901110001", position: "Tarbiyachi", is_active: true, groups: [] },
];
const PARENTS = [
  { id: 4, user_id: 40, organization_id: 1, first_name: "Mohira", last_name: "Yusupova", phone: "+998901110002", relation_type: "ona", children: [], user: { id: 40, is_active: false } },
];
const CHILDREN = [
  { id: 5, organization_id: 1, group_id: 7, first_name: "Ali", last_name: "Valiyev", birth_date: "2021-04-12", gender: "erkak", is_active: true, group: { id: 7, name: "Quyosh" } },
];

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith("/v1/admin/groups"))   return { data: GROUPS };
    if (path.startsWith("/v1/admin/teachers")) return { data: TEACHERS };
    if (path.startsWith("/v1/admin/parents"))  return { data: PARENTS };
    if (path.startsWith("/v1/admin/children")) return { data: CHILDREN };
    return { data: [] };
  });
});

// ── Umumiy xato yordamchisi ───────────────────────────────────────────────────

describe("errorMessage — 422", () => {
  it("maydon xatolarisiz 422 da server xabarini qaytaradi, maydonli 422 da umumiy xabar", () => {
    expect(errorMessage(apiError(422, { message: "Guruhda bolalar bor." }))).toBe("Guruhda bolalar bor.");
    expect(errorMessage(apiError(422, { message: "x", errors: { a: ["b"] } }))).toBe(uz.auth.validatsiya_xatosi);
    expect(errorMessage(apiError(422))).toBe(uz.auth.validatsiya_xatosi);
  });
});

// ── Guruhlar ──────────────────────────────────────────────────────────────────

describe("Guruhlar — tahrirlash va o'chirish", () => {
  it("tahrirlash: forma to'ldirilgan holda ochiladi, PUT yuboriladi va xabar ko'rinadi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    render(<GuruhlarPage />);
    fireEvent.click(await screen.findByRole("button", { name: `${uz.common.tahrirlash}: Quyosh` }));

    const name = screen.getByLabelText(new RegExp(`^${uz.guruhlar.nomi}`)) as HTMLInputElement;
    expect(name.value).toBe("Quyosh");
    fireEvent.change(name, { target: { value: "Oy" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.guruhlar.yangilandi);
    expect(api.put).toHaveBeenCalledWith("/v1/admin/groups/7", { name: "Oy", age_category: "3-4 yosh", capacity: 20 });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("o'chirish tasdiqdan keyin yuboriladi; bekor qilinsa so'rov yo'q", async () => {
    vi.mocked(api.delete).mockResolvedValue({ message: "ok" });
    render(<GuruhlarPage />);

    fireEvent.click(await screen.findByRole("button", { name: `${uz.common.ochirish}: Quyosh` }));
    expect(screen.getByText(new RegExp(uz.guruhlar.ochirish_tasdiqi))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: uz.common.bekor_qilish }));
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: `${uz.common.ochirish}: Quyosh` }));
    fireEvent.click(screen.getByRole("button", { name: uz.common.ochirish }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.guruhlar.ochirildi);
    expect(api.delete).toHaveBeenCalledWith("/v1/admin/groups/7");
  });

  it("bolalari bor guruh: server xabari dialogda ko'rinadi, dialog ochiq qoladi", async () => {
    const message = "Guruhda bolalar bor. Avval ularni boshqa guruhga o'tkazing.";
    vi.mocked(api.delete).mockRejectedValue(apiError(422, { message }));
    render(<GuruhlarPage />);

    fireEvent.click(await screen.findByRole("button", { name: `${uz.common.ochirish}: Quyosh` }));
    fireEvent.click(screen.getByRole("button", { name: uz.common.ochirish }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: uz.common.ochirish })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("takroriy tasdiqlash bitta so'rov yuboradi", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.delete).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<GuruhlarPage />);

    fireEvent.click(await screen.findByRole("button", { name: `${uz.common.ochirish}: Quyosh` }));
    const confirm = screen.getByRole("button", { name: uz.common.ochirish });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(api.delete).toHaveBeenCalledTimes(1);
    resolve({});
    await screen.findByRole("status");
  });

  it("sig'im xatosi maydon ostida ko'rsatiladi", async () => {
    vi.mocked(api.put).mockRejectedValue(apiError(422, { errors: { capacity: ["Sig'im guruhdagi bolalar sonidan kam bo'lishi mumkin emas."] } }));
    render(<GuruhlarPage />);
    fireEvent.click(await screen.findByRole("button", { name: `${uz.common.tahrirlash}: Quyosh` }));
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByText("Sig'im guruhdagi bolalar sonidan kam bo'lishi mumkin emas.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(uz.auth.validatsiya_xatosi);
  });
});

// ── Tarbiyachilar ─────────────────────────────────────────────────────────────

describe("Tarbiyachilar — tahrirlash, faollik, parol", () => {
  async function renderRow() {
    render(<TarbiyachilarPage />);
    return (await screen.findByText("Karimova Dilnoza")).closest("tr")!;
  }

  it("tahrirlash formasida parol maydoni yo'q, PUT parolsiz yuboriladi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.tahrirlash }));

    expect(screen.queryByLabelText(new RegExp(`^${uz.tarbiyachilar.parol}`))).toBeNull();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.tarbiyachilar.telefon}`)), { target: { value: "+998901119999" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.tarbiyachilar.yangilandi);
    expect(api.put).toHaveBeenCalledWith("/v1/admin/teachers/3", {
      first_name: "Dilnoza", last_name: "Karimova", phone: "+998901119999", position: "Tarbiyachi",
    });
  });

  it("band telefon — maydon xatosi ko'rsatiladi, forma ochiq qoladi", async () => {
    vi.mocked(api.put).mockRejectedValue(apiError(422, { errors: { phone: ["Bu telefon raqami band."] } }));
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.tahrirlash }));
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByText("Bu telefon raqami band.")).toBeInTheDocument();
    expect(screen.getByText(uz.tarbiyachilar.tahrirlash)).toBeInTheDocument();
  });

  it("faolsizlantirish tasdiqdan keyin PATCH deactivate", async () => {
    vi.mocked(api.patch).mockResolvedValue({ message: "ok" });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.faolsizlantirish }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByText(uz.tarbiyachilar.faolsizlantirish_tasdiq)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: uz.common.faolsizlantirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.tarbiyachilar.faolsizlantirildi);
    expect(api.patch).toHaveBeenCalledWith("/v1/admin/teachers/3/deactivate");
  });

  it("parolni tiklash: tasdiqdan keyin tizim yaratgan vaqtinchalik parol bir marta ko'rsatiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ message: "ok", data: { temporary_password: "Ab3dEf5hJk7m" } });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.parolni_tiklash }));

    // Parol qo'lda kiritilmaydi — faqat tasdiq
    expect(screen.getByText(uz.akkaunt.parol_yangilash_tasdiq)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.parol_yangilash }));

    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Ab3dEf5hJk7m");
    expect(api.post).toHaveBeenCalledWith("/v1/admin/teachers/3/reset-password", {});
    expect(screen.getByRole("status")).toHaveTextContent(uz.common.parol_yangilandi);

    // Yopilgandan keyin parol qayta ko'rinmaydi
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.saqlab_oldim }));
    await waitFor(() => expect(screen.queryByText("Ab3dEf5hJk7m")).toBeNull());
  });
});

// ── Ota-onalar ────────────────────────────────────────────────────────────────

describe("Ota-onalar — holat, faollashtirish, tahrirlash", () => {
  async function renderRow() {
    render(<OtaOnalarPage />);
    return (await screen.findByText("Yusupova Mohira")).closest("tr")!;
  }

  it("holat users.is_active dan; nofaol ota-ona uchun «Faollashtirish»", async () => {
    vi.mocked(api.patch).mockResolvedValue({ message: "ok" });
    const row = await renderRow();
    expect(within(row).getByText(uz.common.nofaol)).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: uz.common.faollashtirish }));
    expect(screen.getByText(uz.ota_onalar.faollashtirish_tasdiq)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: uz.common.faollashtirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.ota_onalar.faollashtirildi);
    expect(api.patch).toHaveBeenCalledWith("/v1/admin/parents/4/activate");
  });

  it("tahrirlash: parolsiz PUT, qarindoshlik o'zgaradi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.tahrirlash }));

    expect(screen.queryByLabelText(new RegExp(`^${uz.ota_onalar.parol}`))).toBeNull();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.qarindoshlik}`)), { target: { value: "vasiy" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.ota_onalar.yangilandi);
    expect(api.put).toHaveBeenCalledWith("/v1/admin/parents/4", {
      first_name: "Mohira", last_name: "Yusupova", phone: "+998901110002", relation_type: "vasiy",
    });
  });

  it("server 403 — dialogda ruxsat xabari, ro'yxat qayta yuklanmaydi", async () => {
    vi.mocked(api.patch).mockRejectedValue(apiError(403));
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.faollashtirish }));
    const buttons = screen.getAllByRole("button", { name: uz.common.faollashtirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.common.ruxsat_yoq);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

// ── Bolalar ───────────────────────────────────────────────────────────────────

describe("Bolalar — tahrirlash va o'chirish", () => {
  async function renderRow() {
    render(<BolalarPage />);
    await screen.findAllByText("Valiyev Ali");
    return within(screen.getByRole("table")).getByText("Valiyev Ali").closest("tr")!;
  }

  it("tahrirlash: holatni «Nofaol» qilish PUT ga is_active=false bilan ketadi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.tahrirlash }));

    expect((screen.getByLabelText(new RegExp(`^${uz.bolalar.ismi}`)) as HTMLInputElement).value).toBe("Ali");
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.bolalar.holat}`)), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.bolalar.yangilandi);
    expect(api.put).toHaveBeenCalledWith("/v1/admin/children/5", {
      first_name: "Ali", last_name: "Valiyev", birth_date: "2021-04-12", gender: "erkak", group_id: 7, is_active: false,
    });
  });

  it("qo'shish formasida holat maydoni yo'q", async () => {
    render(<BolalarPage />);
    await screen.findAllByText("Valiyev Ali");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.bolalar.qoshish) }));

    expect(screen.getByText(uz.bolalar.qoshish, { selector: "h2, h3" })).toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(`^${uz.bolalar.holat}`))).toBeNull();
  });

  it("o'chirish tasdiqdan keyin DELETE va ro'yxat yangilanadi", async () => {
    vi.mocked(api.delete).mockResolvedValue({ message: "ok" });
    const row = await renderRow();
    fireEvent.click(within(row).getByRole("button", { name: uz.common.ochirish }));

    expect(screen.getByText(new RegExp(uz.bolalar.ochirish_izoh.slice(0, 30)))).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: uz.common.ochirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.bolalar.ochirildi);
    expect(api.delete).toHaveBeenCalledWith("/v1/admin/children/5");
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4)); // children + groups, ikki marta
  });
});
