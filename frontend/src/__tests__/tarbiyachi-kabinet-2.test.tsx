import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ChildPhotoUploader from "@/components/ChildPhotoUploader";
import ChildDailyHistory from "@/components/ChildDailyHistory";
import TarbiyachiXabarlarPage from "@/app/tarbiyachi/xabarlar/page";
import DailyManager from "@/components/daily/DailyManager";
import { api, uploadFile } from "@/lib/api";
import type { ChildHistory, DailyDay, SentMessage, TeacherChild } from "@/types";
import uz from "@/i18n/uz";

// ── MOCK API — bu testlar real backend integratsiyasi EMAS ────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
}));
vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}
const file = (type: string, size = 1000, name = "rasm.png") => new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "";
});

// ── Rasm yuklash ─────────────────────────────────────────────────────────────

describe("Bola rasmi — yuklash UI", () => {
  function renderUploader(photoUrl: string | null = null) {
    const onChange = vi.fn();
    render(<ChildPhotoUploader childId={5} firstName="Ali" lastName="Valiyev" photoUrl={photoUrl} basePath="/v1/teacher/children" onChange={onChange} />);
    return onChange;
  }

  it("rasm yo'q — bosh harflar va yuklash tugmasi; PNG yuklanadi", async () => {
    vi.mocked(uploadFile).mockResolvedValue({ photo_url: "http://127.0.0.1:8000/api/v1/teacher/children/5/photo?v=abc" });
    const onChange = renderUploader();
    expect(screen.getByRole("img", { name: "Valiyev Ali" })).toHaveTextContent("VA");

    fireEvent.change(screen.getByLabelText(uz.guruh.rasm_yuklash), { target: { files: [file("image/png")] } });

    expect(await screen.findByRole("status")).toHaveTextContent(uz.guruh.rasm_saqlandi);
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toBe("/v1/teacher/children/5/photo");
    expect((vi.mocked(uploadFile).mock.calls[0][1] as FormData).get("photo")).toBeInstanceOf(File);
    expect(onChange).toHaveBeenCalledWith("http://127.0.0.1:8000/api/v1/teacher/children/5/photo?v=abc");
  });

  it("noto'g'ri tur va katta hajm brauzerda rad etiladi", () => {
    renderUploader();
    fireEvent.change(screen.getByLabelText(uz.guruh.rasm_yuklash), { target: { files: [file("application/pdf", 10, "x.pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent(uz.guruh.rasm_turi_xato);

    fireEvent.change(screen.getByLabelText(uz.guruh.rasm_yuklash), { target: { files: [file("image/jpeg", 3 * 1024 * 1024)] } });
    expect(screen.getByRole("alert")).toHaveTextContent(uz.guruh.rasm_hajm_xato);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("server 422 maydon xatosi ko'rsatiladi", async () => {
    vi.mocked(uploadFile).mockRejectedValue(apiError(422, { errors: { photo: ["Rasm o'lchami noto'g'ri."] } }));
    renderUploader();
    fireEvent.change(screen.getByLabelText(uz.guruh.rasm_yuklash), { target: { files: [file("image/webp")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Rasm o'lchami noto'g'ri.");
  });

  it("rasm bor — almashtirish va tasdiq bilan o'chirish", async () => {
    vi.mocked(api.delete).mockResolvedValue({});
    const onChange = renderUploader("http://127.0.0.1:8000/api/v1/teacher/children/5/photo?v=abc");
    expect(screen.getByRole("button", { name: uz.guruh.rasm_almashtirish })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.guruh.rasm_ochirish }));
    expect(screen.getByText(uz.guruh.rasm_ochirish_tasdiq)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: uz.common.ochirish }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(api.delete).toHaveBeenCalledWith("/v1/teacher/children/5/photo");
  });
});

// ── Kundalik tarix ───────────────────────────────────────────────────────────

describe("Bola profili — kundalik tarix", () => {
  const HISTORY: ChildHistory = {
    from: "2026-10-15", to: "2026-10-28",
    days: [
      { date: "2026-10-28", attendance: "present", excuse_reason: null, note: null,
        meals: [{ meal_type: "tushlik", served_at: "12:30", ate: false, note: null }],
        sleep: { started_at: "13:00", ended_at: "15:00", note: null, is_sleeping: false, status_text: null },
        activities: [{ title: "Rasm", starts_at: "10:00" }] },
      { date: "2026-10-20", attendance: "excused", excuse_reason: "kasallik", note: "Isitma", meals: [], sleep: null, activities: [] },
    ],
  };

  it("kunlar, ovqatlanmagan holati, uyqu davomiyligi va sababli izoh", async () => {
    vi.mocked(api.get).mockResolvedValue(HISTORY);
    render(<ChildDailyHistory childId={5} />);

    const list = await screen.findByTestId("child-history");
    expect(api.get).toHaveBeenCalledWith("/v1/teacher/children/5/history");
    expect(list).toHaveTextContent("28 oktabr 2026");
    expect(list).toHaveTextContent("Tushlik 12:30 (ovqatlanmadi)");
    expect(list).toHaveTextContent("13:00–15:00 (2 soat)");
    expect(list).toHaveTextContent("Rasm");
    expect(list).toHaveTextContent(`${uz.davomat.sabab_kasallik}: Isitma`);
  });

  it("bo'sh va xato holatlari", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ ...HISTORY, days: [] });
    const { unmount } = render(<ChildDailyHistory childId={5} />);
    expect(await screen.findByText(uz.guruh.tarix_yoq)).toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(HISTORY);
    render(<ChildDailyHistory childId={5} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.server_xatosi);
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));
    expect(await screen.findByTestId("child-history")).toBeInTheDocument();
  });
});

// ── Xabarlar ─────────────────────────────────────────────────────────────────

const KIDS: TeacherChild[] = [
  { id: 1, first_name: "Ali", last_name: "Valiyev", middle_name: null, birth_date: "2022-03-15", gender: "erkak", is_active: true, photo_url: null, group: { id: 7, name: "Quyosh", age_category: null }, contact: null },
  { id: 2, first_name: "Vali", last_name: "Aliyev", middle_name: null, birth_date: "2022-03-15", gender: "erkak", is_active: true, photo_url: null, group: { id: 7, name: "Quyosh", age_category: null }, contact: null },
];
const SENT: SentMessage = {
  id: 10, audience: "group", group: { id: 7, name: "Quyosh" }, child: null, sender: "QA Tarbiyachi",
  subject: "Bayram", body: "Juma kuni bayram.", created_at: "2026-10-28T09:00:00+05:00",
  recipients_count: 2, read_count: 1,
  recipients: [{ name: "Valiyeva Mohira", child: "Valiyev Ali", read_at: "2026-10-28T10:00:00+05:00" }, { name: "Aliyev Sardor", child: "Aliyev Vali", read_at: null }],
};

describe("Xabarlar sahifasi", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path.startsWith("/v1/teacher/messages") ? { groups: [{ id: 7, name: "Quyosh" }], data: [SENT] } : { groups: [], data: KIDS });
  });

  it("tarix, o'qilgan holati va qabul qiluvchilar", async () => {
    render(<TarbiyachiXabarlarPage />);
    const history = await screen.findByTestId("message-history");
    expect(within(history).getByText(`1/2 ${uz.xabarlar.oqildi}`)).toBeInTheDocument();
    expect(screen.getByText(uz.xabarlar.izoh)).toBeInTheDocument();      // real-time yo'qligi ochiq aytilgan

    fireEvent.click(within(history).getByRole("button", { name: `${uz.xabarlar.qabul_qiluvchilar} (2)` }));
    expect(within(history).getByText(uz.xabarlar.oqilmagan)).toBeInTheDocument();
  });

  it("bitta bolaga: bola tanlanmasa va matn bo'sh bo'lsa yuborilmaydi", async () => {
    render(<TarbiyachiXabarlarPage />);
    await screen.findByTestId("message-history");
    fireEvent.click(screen.getByRole("button", { name: uz.xabarlar.yuborish }));

    expect(screen.getByText(uz.xabarlar.bola_majburiy)).toBeInTheDocument();
    expect(screen.getByText(uz.xabarlar.matn_majburiy)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("bitta bolaga yuborish — so'rov tanasi va tarixga qo'shilishi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...SENT, id: 11, audience: "child", child: { id: 1, first_name: "Ali", last_name: "Valiyev" }, read_count: 0, recipients_count: 1, body: "Ertaga kiyim olib keling." } });
    render(<TarbiyachiXabarlarPage />);
    await screen.findByTestId("message-history");

    fireEvent.change(screen.getByLabelText(uz.xabarlar.bola), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.xabarlar.matn}`)), { target: { value: "  Ertaga kiyim olib keling.  " } });
    fireEvent.click(screen.getByRole("button", { name: uz.xabarlar.yuborish }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.xabarlar.yuborildi);
    expect(api.post).toHaveBeenCalledWith("/v1/teacher/messages", {
      audience: "child", group_id: 7, child_id: 1, subject: null, body: "Ertaga kiyim olib keling.",
    });
    expect(within(screen.getByTestId("message-history")).getAllByRole("listitem")[0]).toHaveTextContent("Valiyev Ali");
  });

  it("butun guruhga; server 422 xabari (ota-ona yo'q)", async () => {
    vi.mocked(api.post).mockRejectedValue(apiError(422, { errors: { audience: ["Guruhdagi bolalarga hali faol ota-ona bog'lanmagan."] } }));
    render(<TarbiyachiXabarlarPage />);
    await screen.findByTestId("message-history");

    fireEvent.change(screen.getByLabelText(uz.xabarlar.kimga), { target: { value: "group" } });
    expect(screen.queryByLabelText(uz.xabarlar.bola)).toBeNull();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.xabarlar.matn}`)), { target: { value: "Salom" } });
    fireEvent.click(screen.getByRole("button", { name: uz.xabarlar.yuborish }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Guruhdagi bolalarga hali faol ota-ona bog'lanmagan.");
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ audience: "group", child_id: null });
  });
});

// ── Kundalik: ovqatlanmadi va mashg'ulot maydonlari ──────────────────────────

const DAY: DailyDay = {
  groups: [{ id: 7, name: "Quyosh" }],
  group: { id: 7, name: "Quyosh" },
  date: "2026-10-28", editable: true, editable_from: "2026-10-26",
  meal_types: ["nonushta", "ikkinchi_nonushta", "tushlik", "peshinlik", "kechki_ovqat"],
  children: [
    { id: 1, first_name: "Ali",  last_name: "Valiyev", attendance: "present", meals: [], sleep: null },
    { id: 2, first_name: "Vali", last_name: "Aliyev",  attendance: "absent",  meals: [], sleep: null },
  ],
  activities: [],
};

describe("Kundalik — kengaytirilgan", () => {
  async function open(tab: string) {
    vi.mocked(api.get).mockResolvedValue(DAY);
    render(<DailyManager basePath="/v1/teacher/daily" noGroupsText="-" />);
    await screen.findByRole("tablist");
    fireEvent.click(screen.getByRole("tab", { name: tab }));
  }

  it("bola bo'yicha «Ovqatlanmadi» va alohida izoh yuboriladi", async () => {
    vi.mocked(api.put).mockResolvedValue(DAY);
    await open(uz.kundalik.tab_ovqat);
    expect(within(screen.getByLabelText(uz.kundalik.ovqat_turi)).getByRole("option", { name: uz.kundalik.tur_ikkinchi_nonushta })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.kundalik.vaqt}`)), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.ovqatlandi}: Valiyev Ali`), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.bola_izohi}: Valiyev Ali`), { target: { value: "Ishtahasi yo'q" } });
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/v1/teacher/daily/meals", expect.objectContaining({
      records: [{ child_id: 1, ate: false, note: "Ishtahasi yo'q" }],
    })));
  });

  it("mashg'ulot: yo'nalish, tugash vaqti, davomiylik, faqat «Keldi» ishtirokchilar", async () => {
    vi.mocked(api.post).mockResolvedValue(DAY);
    await open(uz.kundalik.tab_mashgulot);
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.mashgulot_qoshish }));

    expect(screen.queryByText("Aliyev Vali")).toBeNull();                  // kelmagan bola ro'yxatda yo'q
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.kundalik.nomi}`)), { target: { value: "Ertak" } });
    fireEvent.change(screen.getByLabelText(uz.kundalik.yonalish), { target: { value: "nutq" } });
    fireEvent.change(screen.getByLabelText(uz.kundalik.boshlanish_vaqti), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText(uz.kundalik.tugash_vaqti), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    expect(screen.getByText(uz.kundalik.tugash_xato_mashgulot)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(uz.kundalik.tugash_vaqti), { target: { value: "10:45" } });
    expect(screen.getByText(`${uz.kundalik.davomiyligi}: 45 daqiqa`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(uz.kundalik.natija), { target: { value: "Yaxshi" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/teacher/daily/activities", {
      date: "2026-10-28", group_id: 7, title: "Ertak", direction: "nutq", starts_at: "10:00", ends_at: "10:45",
      description: null, result: "Yaxshi", child_ids: [1],
    }));
  });

  it("umumiy: ovqatlangan va mashg'ulotda qatnashganlar soni", async () => {
    vi.mocked(api.get).mockResolvedValue({
      ...DAY,
      children: [
        { ...DAY.children[0], meals: [{ id: 1, meal_type: "tushlik", served_at: "12:30", ate: false, note: null }] },
        DAY.children[1],
      ],
      activities: [{ id: 1, title: "Rasm", direction: null, description: null, result: null, starts_at: null, ends_at: null, duration_minutes: null,
        participants: [{ id: 1, first_name: "Ali", last_name: "Valiyev" }] }],
    });
    render(<DailyManager basePath="/v1/teacher/daily" noGroupsText="-" />);
    await screen.findByRole("tablist");

    expect(screen.getByText(uz.kundalik.ovqatlangan_soni).nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText(uz.kundalik.qatnashgan_soni).nextElementSibling).toHaveTextContent("1");
  });
});
