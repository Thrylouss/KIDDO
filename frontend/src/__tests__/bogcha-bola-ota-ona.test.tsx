import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ChildParentsModal from "@/components/ChildParentsModal";
import { api } from "@/lib/api";
import type { Child } from "@/types";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false ─────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const CHILD: Child = {
  id: 2, organization_id: 1, group_id: null, first_name: "Malika", last_name: "Yusupova",
  birth_date: "2021-04-12", gender: "ayol", is_active: true,
};

const LINKED = {
  id: 1, user_id: 20, organization_id: 1, first_name: "Mohira", last_name: "Yusupova",
  phone: "+998901234102", relation_type: "ona",
  children: [{ id: 2, first_name: "Malika", last_name: "Yusupova", pivot: { relation_type: "ona", is_primary: true } }],
};
const FREE = {
  id: 3, user_id: 22, organization_id: 1, first_name: "Sarvar", last_name: "Yusupov",
  phone: "+998901234103", relation_type: "ota", children: [],
};

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [LINKED, FREE] });
});

async function renderModal() {
  render(<ChildParentsModal child={CHILD} onClose={vi.fn()} />);
  await screen.findByText(uz.bolalar.boglangan_ota_onalar);
}

function chooseAndAsk(parentId = "3", relation = "ota", primary = false) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.bolalar.ota_ona}`), { selector: "input, select, textarea" }), { target: { value: parentId } });
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.ota_onalar.qarindoshlik}`), { selector: "input, select, textarea" }), { target: { value: relation } });
  if (primary) fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: uz.bolalar.boglash }));
}

describe("Bolaga ota-ona bog'lash", () => {
  it("bog'langan ota-onani pivot ma'lumoti bilan ko'rsatadi, tanlov ro'yxatida faqat bog'lanmaganlar", async () => {
    await renderModal();

    const linkedList = screen.getByText(uz.bolalar.boglangan_ota_onalar).parentElement!;
    expect(within(linkedList).getByText("Yusupova Mohira")).toBeInTheDocument();
    expect(within(linkedList).getByText(uz.bolalar.asosiy_vakil)).toBeInTheDocument();

    const options = within(screen.getByLabelText(new RegExp(`^${uz.bolalar.ota_ona}`), { selector: "input, select, textarea" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([uz.common.tanlang, "Yusupov Sarvar · +998901234103"]);
    expect(screen.getByText(uz.bolalar.asosiy_vakil_izoh)).toBeInTheDocument();
  });

  it("bog'lashdan oldin tasdiq so'raladi; tasdiqdan keyin yuboriladi va ro'yxat yangilanadi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await renderModal();
    chooseAndAsk("3", "ota", true);

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByText(uz.bolalar.boglash_tasdiq)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.common.tasdiqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.bolalar.boglandi);
    expect(api.post).toHaveBeenCalledWith("/v1/admin/children/2/parents", {
      parent_profile_id: 3, relation_type: "ota", is_primary: true,
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("tasdiqni bekor qilsa so'rov yuborilmaydi", async () => {
    await renderModal();
    chooseAndAsk();

    fireEvent.click(screen.getByRole("button", { name: uz.common.bekor_qilish }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: uz.bolalar.boglash })).toBeInTheDocument();
  });

  it.each([
    [404, { message: "Ota-ona topilmadi." }, "Ota-ona topilmadi."],
    [403, {},                               uz.common.ruxsat_yoq],
    [422, { errors: { relation_type: ["Noto'g'ri qiymat."] } }, uz.auth.validatsiya_xatosi],
  ])("bog'lash %i → xato xabari", async (status, data, message) => {
    vi.mocked(api.post).mockRejectedValue(apiError(status, data));
    await renderModal();
    chooseAndAsk();
    fireEvent.click(screen.getByRole("button", { name: uz.common.tasdiqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("takroriy tasdiqlash bitta so'rov yuboradi", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderModal();
    chooseAndAsk();

    const confirm = screen.getByRole("button", { name: uz.common.tasdiqlash });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(api.post).toHaveBeenCalledTimes(1);
    resolve({ data: {} });
    await screen.findByRole("status");
  });
});

describe("Bog'lanishni olib tashlash", () => {
  it("tasdiqdan keyin DELETE yuboriladi va ro'yxat yangilanadi", async () => {
    vi.mocked(api.delete).mockResolvedValue({ message: "ok" });
    await renderModal();

    fireEvent.click(screen.getByRole("button", { name: uz.bolalar.olib_tashlash }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText(uz.bolalar.olib_tashlash_tasdiq)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.common.tasdiqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.bolalar.olib_tashlandi);
    expect(api.delete).toHaveBeenCalledWith("/v1/admin/children/2/parents/1");
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("tarmoq xatosi → xabar, ro'yxat o'zgarmaydi", async () => {
    vi.mocked(api.delete).mockRejectedValue(new TypeError("Failed to fetch"));
    await renderModal();

    fireEvent.click(screen.getByRole("button", { name: uz.bolalar.olib_tashlash }));
    fireEvent.click(screen.getByRole("button", { name: uz.common.tasdiqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.tarmoq_xatosi);
    expect(screen.getByText("Yusupova Mohira")).toBeInTheDocument();
  });
});

describe("Yuklash holatlari", () => {
  it("ro'yxat yuklanmasa xato va qayta urinish", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce({ data: [LINKED, FREE] });
    render(<ChildParentsModal child={CHILD} onClose={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.server_xatosi);
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));

    await waitFor(() => expect(screen.getByText(uz.bolalar.boglangan_ota_onalar)).toBeInTheDocument());
  });

  it("barcha ota-onalar allaqachon bog'langan bo'lsa aniq xabar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [LINKED] });
    await renderModal();

    expect(screen.getByText(uz.bolalar.hammasi_boglangan)).toBeInTheDocument();
    expect(screen.queryByText(uz.common.malumot_yoq)).toBeNull();
  });

  it("bog'chada ota-ona bo'lmasa yo'l-yo'riq ko'rsatiladi", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await renderModal();

    expect(screen.getByText(uz.bolalar.ota_ona_boglanmagan)).toBeInTheDocument();
    expect(screen.getByText(uz.bolalar.ota_ona_yoq)).toBeInTheDocument();
  });
});
