import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DailyManager from "@/components/daily/DailyManager";
import BogchaKundalikPage from "@/app/bogcha/kundalik/page";
import TarbiyachiKundalikPage from "@/app/tarbiyachi/kundalik/page";
import { api } from "@/lib/api";
import type { DailyDay } from "@/types";
import uz from "@/i18n/uz";

// ── MOCK API — bu testlar real backend integratsiyasi EMAS ────────────────────
// Javob shakli 2a backend kontraktiga (GET/PUT/DELETE /v1/{teacher|admin}/daily) mos qilib yozilgan.

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

function makeDay(over: Partial<DailyDay> = {}): DailyDay {
  return {
    groups: [{ id: 7, name: "Quyosh" }, { id: 8, name: "Oy" }],
    group: { id: 7, name: "Quyosh" },
    date: "2026-10-28",
    editable: true,
    editable_from: "2026-10-26",
    meal_types: ["nonushta", "tushlik", "peshinlik", "kechki_ovqat"],
    children: [
      { id: 1, first_name: "Ali",    last_name: "Valiyev",  attendance: "present", meals: [], sleep: null },
      { id: 2, first_name: "Vali",   last_name: "Aliyev",   attendance: "absent",  meals: [], sleep: null },
      { id: 3, first_name: "Malika", last_name: "Karimova", attendance: "excused", meals: [], sleep: null },
      { id: 4, first_name: "Bobur",  last_name: "Usmonov",  attendance: null,      meals: [], sleep: null },
      { id: 5, first_name: "Zuhra",  last_name: "Rasulova", attendance: "present", meals: [],
        sleep: { id: 50, started_at: "13:00", ended_at: null, note: null, is_sleeping: true, status_text: "Hali uxlayapti" } },
    ],
    activities: [{ id: 90, title: "Rasm chizish", direction: "tasviriy", description: "Kuz manzarasi", result: null,
      starts_at: "10:00", ends_at: "10:30", duration_minutes: 30, participants: [{ id: 1, first_name: "Ali", last_name: "Valiyev" }] }],
    ...over,
  };
}

function apiError(status: number, data: unknown = {}) {
  return Object.assign(new Error("xato"), { status, data });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "";
  vi.mocked(api.get).mockResolvedValue(makeDay());
});

function fillTime(value = "12:30") {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.kundalik.vaqt}`)), { target: { value } });
}

async function renderManager(tab?: string, basePath: "/v1/teacher/daily" | "/v1/admin/daily" = "/v1/teacher/daily") {
  render(<DailyManager basePath={basePath} noGroupsText="Guruh yo'q" />);
  await screen.findByRole("tablist");
  if (tab) fireEvent.click(screen.getByRole("tab", { name: tab }));
}

// ── Yuklash holatlari va umumiy hisobot ──────────────────────────────────────

describe("Kundalik — yuklash va umumiy ko'rinish", () => {
  it("GET basePath; umumiy hisobotda statistika va davomat holatlari", async () => {
    await renderManager();

    expect(api.get).toHaveBeenCalledWith("/v1/teacher/daily");
    const stats = screen.getByText(uz.kundalik.keldi_soni).closest("div")!;
    expect(within(stats).getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText(uz.kundalik.sababli).length).toBeGreaterThan(0);
    expect(screen.getAllByText(uz.kundalik.belgilanmagan).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hali uxlayapti/).length).toBeGreaterThan(0);
  });

  it("guruh va sana o'zgarsa parametrlar bilan qayta yuklanadi", async () => {
    await renderManager(undefined, "/v1/admin/daily");

    fireEvent.change(screen.getByLabelText(uz.kundalik.guruh), { target: { value: "8" } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/v1/admin/daily?group_id=8"));

    fireEvent.change(screen.getByLabelText(uz.kundalik.sana), { target: { value: "2026-10-27" } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/v1/admin/daily?date=2026-10-27&group_id=8"));
  });

  it("403 — server xabari va qayta urinish", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(apiError(403, { message: "Tarbiyachi profili faol emas." })).mockResolvedValueOnce(makeDay());
    render(<DailyManager basePath="/v1/teacher/daily" noGroupsText="Guruh yo'q" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tarbiyachi profili faol emas.");
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));
    expect(await screen.findByRole("tablist")).toBeInTheDocument();
  });

  it("tarmoq xatosi — o'zbekcha xabar", async () => {
    vi.mocked(api.get).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DailyManager basePath="/v1/teacher/daily" noGroupsText="Guruh yo'q" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.tarmoq_xatosi);
  });

  it("guruh yo'q — bo'sh holat matni", async () => {
    vi.mocked(api.get).mockResolvedValue(makeDay({ groups: [], group: null, children: [], activities: [] }));
    render(<DailyManager basePath="/v1/teacher/daily" noGroupsText="Guruh yo'q" />);
    expect(await screen.findByText("Guruh yo'q")).toBeInTheDocument();
  });

  it("menyudan #uyqu bilan kelinsa uyqu bo'limi ochiladi", async () => {
    window.location.hash = "#uyqu";
    await renderManager();
    expect(screen.getByRole("tab", { name: uz.kundalik.tab_uyqu })).toHaveAttribute("aria-selected", "true");
  });
});

// ── Ovqatlanish ──────────────────────────────────────────────────────────────

describe("Kundalik — ovqatlanish", () => {
  it("faqat «Keldi» bolalar tanlanadi; Kelmadi, Sababli, Belgilanmagan — o'chirilgan", async () => {
    await renderManager(uz.kundalik.tab_ovqat);

    const box = (name: string) => within(screen.getByText(name).closest("label")!).getByRole("checkbox");
    expect(box("Valiyev Ali")).toBeChecked();
    expect(box("Rasulova Zuhra")).toBeChecked();
    for (const name of ["Aliyev Vali", "Karimova Malika", "Usmonov Bobur"]) {
      expect(box(name)).toBeDisabled();
      expect(box(name)).not.toBeChecked();
    }
  });

  it("saqlash: PUT faqat «Keldi» bolalar bilan, keyin xabar va yangilangan ma'lumot", async () => {
    const saved = makeDay({
      children: makeDay().children.map((c) => c.id === 1
        ? { ...c, meals: [{ id: 11, meal_type: "tushlik" as const, served_at: "12:30", ate: true, note: "Hammasini yedi" }] }
        : c),
    });
    vi.mocked(api.put).mockResolvedValue(saved);
    await renderManager(uz.kundalik.tab_ovqat);

    fireEvent.change(screen.getByLabelText(uz.kundalik.ovqat_turi), { target: { value: "tushlik" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.kundalik.vaqt}`)), { target: { value: "12:30" } });
    fireEvent.change(screen.getByLabelText(uz.kundalik.izoh), { target: { value: "Hammasini yedi" } });
    fireEvent.click(within(screen.getByText("Rasulova Zuhra").closest("label")!).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.ovqat_saqlandi);
    expect(api.put).toHaveBeenCalledWith("/v1/teacher/daily/meals", {
      date: "2026-10-28", group_id: 7, meal_type: "tushlik", served_at: "12:30",
      records: [{ child_id: 1, ate: true, note: "Hammasini yedi" }],
    });
    expect(screen.getByText(/Tushlik · 12:30 · Hammasini yedi/)).toBeInTheDocument();
  });

  it("hech kim tanlanmasa so'rov yuborilmaydi", async () => {
    await renderManager(uz.kundalik.tab_ovqat);
    for (const name of ["Valiyev Ali", "Rasulova Zuhra"]) {
      fireEvent.click(within(screen.getByText(name).closest("label")!).getByRole("checkbox"));
    }
    fillTime();
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.kundalik.tanlov_bosh);
    expect(api.put).not.toHaveBeenCalled();
  });

  it("server biznes qoidasi (422 errors.records) va maydon xatosi ko'rsatiladi", async () => {
    const rule = "Valiyev Ali bu kuni davomatda «Kelmadi» deb belgilangan — ovqatlanish yoki uyqu yozib bo'lmaydi.";
    vi.mocked(api.put).mockRejectedValue(apiError(422, { errors: { records: [rule], served_at: ["Vaqt noto'g'ri."] } }));
    await renderManager(uz.kundalik.tab_ovqat);
    fillTime();
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(rule);
    expect(alert).toHaveTextContent(uz.auth.validatsiya_xatosi);
    expect(screen.getByText("Vaqt noto'g'ri.")).toBeInTheDocument();
  });

  it("takroriy bosish bitta so'rov yuboradi", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.put).mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderManager(uz.kundalik.tab_ovqat);
    fillTime();

    const btn = screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(api.put).toHaveBeenCalledTimes(1);
    resolve(makeDay());
    await screen.findByRole("status");
  });

  it("davomat keyin o'zgargan bolaning mavjud yozuvi saqlanadi va faqat tasdiq bilan o'chiriladi", async () => {
    const day = makeDay({
      children: makeDay().children.map((c) => c.id === 2
        ? { ...c, meals: [{ id: 22, meal_type: "nonushta" as const, served_at: "08:30", ate: true, note: null }] }
        : c),
    });
    vi.mocked(api.get).mockResolvedValue(day);
    vi.mocked(api.delete).mockResolvedValue(makeDay());
    await renderManager(uz.kundalik.tab_ovqat);

    expect(screen.getByText(uz.kundalik.davomat_ozgargan)).toBeInTheDocument();
    expect(screen.getByText(/Nonushta · 08:30/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: `${uz.common.ochirish}: Aliyev Vali, ${uz.kundalik.tur_nonushta}` }));
    expect(screen.getByText(uz.kundalik.ovqat_ochirish_tasdiq)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: uz.common.bekor_qilish }));
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: `${uz.common.ochirish}: Aliyev Vali, ${uz.kundalik.tur_nonushta}` }));
    const buttons = screen.getAllByRole("button", { name: uz.common.ochirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.ovqat_ochirildi);
    expect(api.delete).toHaveBeenCalledWith("/v1/teacher/daily/meals/22");
  });

  it("muddat o'tgan sana — faqat ko'rish, saqlash va o'chirish yo'q", async () => {
    vi.mocked(api.get).mockResolvedValue(makeDay({
      editable: false,
      children: makeDay().children.map((c) => c.id === 1
        ? { ...c, meals: [{ id: 11, meal_type: "tushlik" as const, served_at: "12:30", ate: true, note: null }] }
        : c),
    }));
    await renderManager(uz.kundalik.tab_ovqat);

    expect(screen.getByRole("note")).toHaveTextContent(uz.kundalik.faqat_korish);
    expect(screen.getByRole("button", { name: uz.kundalik.ovqat_saqlash })).toBeDisabled();
    expect(screen.queryByRole("button", { name: new RegExp(`^${uz.common.ochirish}`) })).toBeNull();
  });
});

// ── Uyqu ─────────────────────────────────────────────────────────────────────

describe("Kundalik — uyqu", () => {
  it("«Hali uxlayapti» ko'rsatiladi; faqat «Keldi» bolalarda maydonlar bor", async () => {
    await renderManager(uz.kundalik.tab_uyqu);

    expect(screen.getAllByText(uz.kundalik.hali_uxlayapti).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(`${uz.kundalik.boshlanish}: Valiyev Ali`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`${uz.kundalik.boshlanish}: Aliyev Vali`)).toBeNull();
    expect(screen.queryByLabelText(`${uz.kundalik.boshlanish}: Usmonov Bobur`)).toBeNull();
    expect((screen.getByLabelText(`${uz.kundalik.boshlanish}: Rasulova Zuhra`) as HTMLInputElement).value).toBe("13:00");
  });

  it("uyg'onish vaqti uxlashdan oldin yoki teng bo'lsa so'rov yuborilmaydi", async () => {
    await renderManager(uz.kundalik.tab_uyqu);
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.boshlanish}: Valiyev Ali`), { target: { value: "13:00" } });
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.tugash}: Valiyev Ali`), { target: { value: "13:00" } });
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.uyqu_saqlash }));

    expect(await screen.findByText(uz.kundalik.tugash_xato)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("o'zgarish bo'lmasa xabar; o'zgarganlar yuboriladi (bo'sh tugash — null)", async () => {
    vi.mocked(api.put).mockResolvedValue(makeDay());
    await renderManager(uz.kundalik.tab_uyqu);

    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.uyqu_saqlash }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uz.kundalik.ozgarish_yoq);

    fireEvent.change(screen.getByLabelText(`${uz.kundalik.boshlanish}: Valiyev Ali`), { target: { value: "13:10" } });
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.tugash}: Rasulova Zuhra`), { target: { value: "15:00" } });
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.uyqu_saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.uyqu_saqlandi);
    expect(api.put).toHaveBeenCalledWith("/v1/teacher/daily/sleep", {
      date: "2026-10-28", group_id: 7,
      records: [
        { child_id: 1, started_at: "13:10", ended_at: null, note: null },
        { child_id: 5, started_at: "13:00", ended_at: "15:00", note: null },
      ],
    });
  });

  it("belgilanmaganlarga uxlash vaqtini qo'yish faqat bo'sh «Keldi» qatorlarni to'ldiradi", async () => {
    await renderManager(uz.kundalik.tab_uyqu);
    fireEvent.change(screen.getByLabelText(uz.kundalik.hammaga_boshlanish), { target: { value: "12:50" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.tasdiqlash }));

    expect((screen.getByLabelText(`${uz.kundalik.boshlanish}: Valiyev Ali`) as HTMLInputElement).value).toBe("12:50");
    expect((screen.getByLabelText(`${uz.kundalik.boshlanish}: Rasulova Zuhra`) as HTMLInputElement).value).toBe("13:00");
  });

  it("server maydon xatosi (records.0.ended_at) tegishli bola qatorida", async () => {
    vi.mocked(api.put).mockRejectedValue(apiError(422, { errors: { "records.0.ended_at": ["Bugungi sana uchun hali kelmagan vaqtni kiritib bo'lmaydi."] } }));
    await renderManager(uz.kundalik.tab_uyqu);
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.boshlanish}: Valiyev Ali`), { target: { value: "13:10" } });
    fireEvent.change(screen.getByLabelText(`${uz.kundalik.tugash}: Valiyev Ali`), { target: { value: "23:00" } });
    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.uyqu_saqlash }));

    const row = (await screen.findByText("Bugungi sana uchun hali kelmagan vaqtni kiritib bo'lmaydi.")).closest("li")!;
    expect(within(row).getByText("Valiyev Ali")).toBeInTheDocument();
  });

  it("uyqu yozuvini o'chirish tasdiq bilan", async () => {
    vi.mocked(api.delete).mockResolvedValue(makeDay());
    await renderManager(uz.kundalik.tab_uyqu);
    fireEvent.click(screen.getByRole("button", { name: `${uz.kundalik.uyqu_ochirish}: Rasulova Zuhra` }));
    const buttons = screen.getAllByRole("button", { name: uz.common.ochirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.uyqu_ochirildi);
    expect(api.delete).toHaveBeenCalledWith("/v1/teacher/daily/sleep/50");
  });
});

// ── Mashg'ulotlar ────────────────────────────────────────────────────────────

describe("Kundalik — mashg'ulotlar", () => {
  it("qo'shish: POST sana va guruh bilan", async () => {
    vi.mocked(api.post).mockResolvedValue(makeDay());
    await renderManager(uz.kundalik.tab_mashgulot, "/v1/admin/daily");

    fireEvent.click(screen.getByRole("button", { name: uz.kundalik.mashgulot_qoshish }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.kundalik.nomi}`)), { target: { value: "  Musiqa  " } });
    fireEvent.change(screen.getByLabelText(uz.kundalik.boshlanish_vaqti), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.mashgulot_qoshildi);
    // Yangi mashg'ulotda standart holatda barcha «Keldi» bolalar (Ali, Zuhra) ishtirokchi
    expect(api.post).toHaveBeenCalledWith("/v1/admin/daily/activities", {
      date: "2026-10-28", group_id: 7, title: "Musiqa", direction: null, starts_at: "11:00", ends_at: null,
      description: null, result: null, child_ids: [1, 5],
    });
  });

  it("tahrirlash: PUT, 422 maydon xatosi forma ichida", async () => {
    vi.mocked(api.put).mockRejectedValueOnce(apiError(422, { errors: { title: ["Nomi juda uzun."] } })).mockResolvedValueOnce(makeDay());
    await renderManager(uz.kundalik.tab_mashgulot);

    fireEvent.click(screen.getByRole("button", { name: `${uz.common.tahrirlash}: Rasm chizish` }));
    expect((screen.getByLabelText(new RegExp(`^${uz.kundalik.nomi}`)) as HTMLInputElement).value).toBe("Rasm chizish");
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    expect(await screen.findByText("Nomi juda uzun.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.mashgulot_yangilandi);
    expect(api.put).toHaveBeenLastCalledWith("/v1/teacher/daily/activities/90", {
      title: "Rasm chizish", direction: "tasviriy", starts_at: "10:00", ends_at: "10:30",
      description: "Kuz manzarasi", result: null, child_ids: [1],
    });
  });

  it("o'chirish tasdiq bilan; bo'sh holat matni", async () => {
    vi.mocked(api.delete).mockResolvedValue(makeDay({ activities: [] }));
    await renderManager(uz.kundalik.tab_mashgulot);

    fireEvent.click(screen.getByRole("button", { name: `${uz.common.ochirish}: Rasm chizish` }));
    const buttons = screen.getAllByRole("button", { name: uz.common.ochirish });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("status")).toHaveTextContent(uz.kundalik.mashgulot_ochirildi);
    expect(api.delete).toHaveBeenCalledWith("/v1/teacher/daily/activities/90");
    expect(screen.getByText(uz.kundalik.mashgulot_yoq)).toBeInTheDocument();
  });
});

// ── Sahifalar ────────────────────────────────────────────────────────────────

describe("Kundalik sahifalari", () => {
  it("bog'cha sahifasi admin API ni, tarbiyachi sahifasi teacher API ni chaqiradi", async () => {
    render(<BogchaKundalikPage />);
    await screen.findByRole("tablist");
    expect(api.get).toHaveBeenCalledWith("/v1/admin/daily");
    expect(screen.getByText(uz.kundalik.tavsif_admin)).toBeInTheDocument();
  });

  it("tarbiyachi sahifasi", async () => {
    render(<TarbiyachiKundalikPage />);
    await screen.findByRole("tablist");
    expect(api.get).toHaveBeenCalledWith("/v1/teacher/daily");
  });
});

describe("Kundalik — uyqu davomiyligi va umumiy uyg'onish vaqti", () => {
  it("hali uxlayotganlarga bir xil uyg'onish vaqti qo'yiladi va davomiylik ko'rinadi", async () => {
    await renderManager(uz.kundalik.tab_uyqu);

    fireEvent.change(screen.getByLabelText(uz.kundalik.hammaga_tugash), { target: { value: "15:30" } });
    fireEvent.click(screen.getByRole("button", { name: `${uz.common.tasdiqlash}: ${uz.kundalik.hammaga_tugash}` }));

    // Zuhra (13:00 da uxlagan) — 15:30; Ali (uxlash vaqti yo'q) — o'zgarmaydi
    expect((screen.getByLabelText(`${uz.kundalik.tugash}: Rasulova Zuhra`) as HTMLInputElement).value).toBe("15:30");
    expect((screen.getByLabelText(`${uz.kundalik.tugash}: Valiyev Ali`) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(`${uz.kundalik.davomiylik}: 2 soat 30 daqiqa`)).toBeInTheDocument();
  });

  it("«Ikkinchi tushlik» nomi ishlatiladi", async () => {
    await renderManager(uz.kundalik.tab_ovqat);
    expect(within(screen.getByLabelText(uz.kundalik.ovqat_turi)).getByRole("option", { name: "Ikkinchi tushlik" })).toHaveAttribute("value", "peshinlik");
  });
});
