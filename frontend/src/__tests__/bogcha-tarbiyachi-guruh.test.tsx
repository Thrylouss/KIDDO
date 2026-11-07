import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TeacherGroupsModal from "@/components/TeacherGroupsModal";
import TarbiyachilarPage from "@/app/bogcha/tarbiyachilar/page";
import { api } from "@/lib/api";
import type { TeacherProfile } from "@/types";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false ─────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const TEACHER: TeacherProfile = {
  id: 5, user_id: 50, organization_id: 1, first_name: "Maftuna", last_name: "Xolmatova",
  phone: "+998901110005", position: "Tarbiyachi", is_active: true,
  groups: [{ id: 10, name: "Kamalak" }],
};

const GROUPS = [
  { id: 10, name: "Kamalak" },
  { id: 11, name: "Quyoshcha" },
];

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) =>
    Promise.resolve(path === "/v1/admin/groups" ? { data: GROUPS } : { data: [TEACHER] }),
  );
});

describe("Tarbiyachiga guruh biriktirish (modal)", () => {
  it("o'z bog'chasi guruhlarini ko'rsatadi, mavjud biriktirish belgilangan", async () => {
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByLabelText("Kamalak")).toBeChecked();
    expect(screen.getByLabelText("Quyoshcha")).not.toBeChecked();
    expect(api.get).toHaveBeenCalledWith("/v1/admin/groups");
  });

  it("saqlash: PUT kontrakti va onSaved", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const onSaved = vi.fn();
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(await screen.findByLabelText("Quyoshcha"));
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith("/v1/admin/teachers/5/groups", { group_ids: [10, 11] });
  });

  it("hammasini olib tashlash bo'sh ro'yxat yuboradi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(await screen.findByLabelText("Kamalak"));
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/admin/teachers/5/groups", { group_ids: [] }));
  });

  it("ro'yxatda yo'q (boshqa bog'cha) guruh ID'si yuborilmaydi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    const foreign = { ...TEACHER, groups: [{ id: 10, name: "Kamalak" }, { id: 999, name: "Begona" }] };
    render(<TeacherGroupsModal teacher={foreign} onClose={vi.fn()} onSaved={vi.fn()} />);

    await screen.findByLabelText("Kamalak");
    expect(screen.queryByText("Begona")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/admin/teachers/5/groups", { group_ids: [10] }));
  });

  it.each([
    [404, { message: "Guruh topilmadi." }, "Guruh topilmadi."],
    [403, {},                             uz.common.ruxsat_yoq],
    [422, { errors: { group_ids: ["x"] } }, uz.auth.validatsiya_xatosi],
  ])("%i → xato xabari, onSaved chaqirilmaydi", async (status, data, message) => {
    vi.mocked(api.put).mockRejectedValue(apiError(status, data));
    const onSaved = vi.fn();
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={onSaved} />);

    await screen.findByLabelText("Kamalak");
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("takroriy bosish bitta so'rov yuboradi", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.put).mockReturnValue(new Promise((r) => { resolve = r; }));
    const onSaved = vi.fn();
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={onSaved} />);

    await screen.findByLabelText("Kamalak");
    const save = screen.getByRole("button", { name: uz.common.saqlash });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(api.put).toHaveBeenCalledTimes(1);
    resolve({ data: {} });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("guruhlar yuklanmasa xato va saqlash o'chiq", async () => {
    vi.mocked(api.get).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.tarmoq_xatosi);
    expect(screen.getByRole("button", { name: uz.common.saqlash })).toBeDisabled();
  });

  it("bog'chada guruh bo'lmasa xabar ko'rsatiladi", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByText(uz.tarbiyachilar.guruh_yoq)).toBeInTheDocument();
  });
});

describe("Tarbiyachilar sahifasi", () => {
  it("tarbiyachi qo'shish: parol maydoni yo'q, login bilan yuboriladi, vaqtinchalik parol bir marta ko'rsatiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 9 }, account: { username: "dilnoza.k", temporary_password: "Xy7kPq2mRt9w" } });
    render(<TarbiyachilarPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: new RegExp(uz.tarbiyachilar.qoshish) }))[0]);

    expect(screen.queryByLabelText(new RegExp(`^${uz.tarbiyachilar.parol}`))).toBeNull();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.tarbiyachilar.ismi}`)), { target: { value: "Dilnoza" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.tarbiyachilar.familiyasi}`)), { target: { value: "Karimova" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.tarbiyachilar.login}`)), { target: { value: "dilnoza.k" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Xy7kPq2mRt9w");
    expect(screen.getByTestId("temp-login")).toHaveTextContent("dilnoza.k");
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/v1/admin/teachers");
    expect(body).toMatchObject({ first_name: "Dilnoza", last_name: "Karimova", username: "dilnoza.k", phone: null });
    expect(body).not.toHaveProperty("password");
  });

  it("guruhlar saqlangach muvaffaqiyat xabari va ro'yxat yangilanadi", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    render(<TarbiyachilarPage />);

    fireEvent.click(await screen.findByRole("button", { name: uz.tarbiyachilar.guruhlar_btn }));
    await screen.findByLabelText("Quyoshcha");
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.tarbiyachilar.guruhlar_saqlandi);
    expect(vi.mocked(api.get).mock.calls.filter(([p]) => p === "/v1/admin/teachers")).toHaveLength(2);
  });
});
