import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import OtaOnalarPage from "@/app/bogcha/ota-onalar/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false ─────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const PARENTS = [
  {
    id: 1, user_id: 20, organization_id: 1, first_name: "Mohira", last_name: "Yusupova",
    phone: "+998901234102", relation_type: "ona",
    children: [{ id: 2, first_name: "Malika", last_name: "Yusupova", pivot: { relation_type: "ona", is_primary: true } }],
  },
];

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

const CHILDREN = [{ id: 2, first_name: "Malika", last_name: "Yusupova" }, { id: 3, first_name: "Sardor", last_name: "Karimov" }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (path: string) => ({ data: path === "/v1/admin/children" ? CHILDREN : PARENTS }));
});

/** Faqat ota-onalar ro'yxati so'rovlari (forma ochilganda bolalar ro'yxati ham yuklanadi). */
const parentLoads = () => vi.mocked(api.get).mock.calls.filter(([p]) => p === "/v1/admin/parents").length;

async function openForm() {
  render(<OtaOnalarPage />);
  await screen.findByText("Yusupova Mohira");
  fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.ota_onalar.qoshish) }));
  await screen.findByRole("option", { name: "Karimov Sardor" });
}

function fillForm() {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.ismi}`)),     { target: { value: "Dilnoza" } });
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.familiyasi}`)), { target: { value: "Karimova" } });
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.login}`)),    { target: { value: "dilnoza.k" } });
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.telefon}`)),  { target: { value: "+998907001122" } });
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.qarindoshlik}`)), { target: { value: "ona" } });
  fireEvent.change(document.getElementById("parent-child")!, { target: { value: "3" } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
}

describe("Bog'cha — ota-onalar ro'yxati", () => {
  it("qarindoshlik ustunini ko'rsatadi", async () => {
    render(<OtaOnalarPage />);
    const row = (await screen.findByText("Yusupova Mohira")).closest("tr")!;
    expect(within(row).getByText(uz.ota_onalar.rel_ona)).toBeInTheDocument();
  });
});

describe("Bog'cha — ota-ona qo'shish", () => {
  it("muvaffaqiyat: login, bola va qarindoshlik yuboriladi, parol yuborilmaydi; vaqtinchalik parol bir marta ko'rsatiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {}, account: { username: "dilnoza.k", temporary_password: "Qw3eRt5yUp7a" } });
    await openForm();
    expect(screen.queryByLabelText(new RegExp(`^${uz.ota_onalar.parol}`))).toBeNull();
    fillForm();
    submit();

    expect(await screen.findByRole("status")).toHaveTextContent(uz.ota_onalar.qoshildi);
    expect(api.post).toHaveBeenCalledWith("/v1/admin/parents", {
      first_name: "Dilnoza", last_name: "Karimova", username: "dilnoza.k", phone: "+998907001122",
      relation_type: "ona", child_id: 3,
    });
    expect(screen.getByTestId("temp-login")).toHaveTextContent("dilnoza.k");
    expect(screen.getByTestId("temp-password")).toHaveTextContent("Qw3eRt5yUp7a");
    expect(parentLoads()).toBe(2);
    expect(screen.queryByRole("button", { name: uz.common.saqlash })).toBeNull();
  });

  it("parolni tiklash: tasdiqdan keyin vaqtinchalik parol ko'rsatiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { temporary_password: "Zx9cVb2nMk4p" } });
    render(<OtaOnalarPage />);
    const row = (await screen.findByText("Yusupova Mohira")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: uz.common.parolni_tiklash }));
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.parol_yangilash }));

    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Zx9cVb2nMk4p");
    expect(api.post).toHaveBeenCalledWith("/v1/admin/parents/1/reset-password", {});
  });

  it("422: maydon xatolari ko'rsatiladi, modal ochiq qoladi", async () => {
    vi.mocked(api.post).mockRejectedValue(apiError(422, {
      message: "Kiritilgan ma'lumotlar noto'g'ri.",
      errors: { phone: ["Bu telefon raqami band."], username: ["Bu login band. Boshqa login tanlang."] },
    }));
    await openForm();
    fillForm();
    submit();

    expect(await screen.findByText("Bu telefon raqami band.")).toBeInTheDocument();
    expect(screen.getByText("Bu login band. Boshqa login tanlang.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(uz.auth.validatsiya_xatosi);
    expect(screen.getByRole("button", { name: uz.common.saqlash })).toBeInTheDocument();
    expect(parentLoads()).toBe(1);
  });

  it.each([
    [403, {},                               uz.common.ruxsat_yoq],
    [404, { message: "Ma'lumot topilmadi." }, "Ma'lumot topilmadi."],
    [500, {},                               uz.auth.server_xatosi],
  ])("%i javobi to'g'ri xabar bilan ko'rsatiladi", async (status, data, message) => {
    vi.mocked(api.post).mockRejectedValue(apiError(status, data));
    await openForm();
    fillForm();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("tarmoq xatosi → tarmoq xabari", async () => {
    vi.mocked(api.post).mockRejectedValue(new TypeError("Failed to fetch"));
    await openForm();
    fillForm();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.tarmoq_xatosi);
  });

  it("takroriy yuborish bloklanadi", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((r) => { resolve = r; }));
    await openForm();
    fillForm();

    submit();
    fireEvent.submit(document.getElementById("parent-form")!);
    fireEvent.submit(document.getElementById("parent-form")!);

    expect(api.post).toHaveBeenCalledTimes(1);
    resolve({ data: {} });
    await screen.findByRole("status");
  });
});
