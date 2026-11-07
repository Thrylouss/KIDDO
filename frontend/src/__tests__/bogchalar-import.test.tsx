import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BogchaImportPage from "@/app/admin/bogchalar/import/page";
import { uploadFile } from "@/lib/api";
import uz from "@/i18n/uz";

const t = uz.bogcha_import;

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  uploadFile:   vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const row = (n: number, status: "ok" | "warning" | "error", extra: Record<string, unknown> = {}) => ({
  row: n, name: `${n}-sonli DMTT`, number: String(n), address: null, mfy: "Navro'z MFY", capacity: 100,
  director_name: "Testova Anora", director_phone: "+998901112233",
  source: { "Muassasa nomi": `${n}-sonli DMTT`, "Rahbari (F.I.SH)": "Testova  Anora " },
  derived: { number: "name", mfy: "address" }, missing: [], errors: [], warnings: [], status, ...extra,
});

const COLUMNS = [
  { field: "name", label: "Muassasa nomi", required: true, header: "Muassasa nomi" },
  { field: "official_code", label: "Rasmiy kod", required: false, header: null },
  { field: "capacity", label: "Quvvati", required: false, header: "Quvvati" },
];

// Xatoli qatori bor fayl — import to'liq bloklanadi
const preview = {
  rows: [
    row(2, "ok"),
    row(3, "warning", { warnings: ["Shu nomli bog'cha bazada bor (#5)."],
      issues: [{ level: "warning", field: "name", column: "Muassasa nomi", message: "Shu nomli bog'cha bazada bor (#5)." }] }),
    row(4, "error",   { errors: ["Bu raqamli bog'cha allaqachon mavjud (#7: 4-sonli DMTT)."], capacity: null, missing: ["capacity"],
      issues: [{ level: "error", field: "number", column: "Raqami", message: "Bu raqamli bog'cha allaqachon mavjud (#7: 4-sonli DMTT)." }] }),
  ],
  summary: { total: 3, ok: 1, warning: 1, error: 1 },
  columns: COLUMNS,
  can_import: false,
};

// Xatosiz fayl — tanlab import qilish mumkin
const cleanPreview = {
  rows: [preview.rows[0], preview.rows[1], row(4, "ok")],
  summary: { total: 3, ok: 2, warning: 1, error: 0 },
  columns: COLUMNS,
  can_import: true,
};

async function loadPreview() {
  render(<BogchaImportPage />);
  const file = new File(["x"], "dmtt.xlsx");
  fireEvent.change(screen.getByLabelText(new RegExp(t.fayl.replace(/[.()]/g, "\\$&"))), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: t.korib_chiqish }));
  await screen.findByTestId("import-row-2");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadFile).mockResolvedValue({ data: preview });
});

describe("Bog'chalarni Excel orqali import", () => {
  it("preview tuman va faylni yuboradi, bazaga yozuvchi so'rov yubormaydi", async () => {
    await loadPreview();

    const form = vi.mocked(uploadFile).mock.calls[0][1] as FormData;
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toBe("/v1/super-admin/organizations/import/preview");
    expect(form.get("district")).toBe("Bo'stonliq tumani");
    expect(form.get("type")).toBe("davlat");               // standart tur — reyestr DMTT lari
    expect(form.get("file")).toBeInstanceOf(File);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    // Fayldagi «Turi» bo'sh bo'lsa — standart tur ko'rsatiladi
    expect(screen.getAllByText(new RegExp(`${uz.bogchalar.turi_davlat} \\(${t.standart}\\)`)).length).toBeGreaterThan(0);

    expect(screen.getByTestId("import-total")).toHaveTextContent("3");
    expect(screen.getByTestId("import-error")).toHaveTextContent("1");
    expect(screen.getAllByText(/allaqachon mavjud/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.login_yoq).length).toBeGreaterThan(0);
  });

  it("asl qiymatlar, ajratilgan va yetishmayotgan maydonlar alohida ko'rsatiladi", async () => {
    await loadPreview();

    // Asl qiymat probellari bilan, o'zgartirilmasdan
    expect(screen.getByTestId("source-2")).toHaveTextContent("«Testova  Anora »", { normalizeWhitespace: false });
    expect(screen.getAllByText(t.nomdan).length).toBe(3);
    expect(screen.getAllByText(t.manzildan).length).toBe(3);
    expect(screen.getByTestId("missing-4")).toHaveTextContent(`${t.faylda_yoq}: ${t.quvvati}`);
  });

  it("xato bo'lsa import to'liq bloklanadi: qator, ustun va sabab ko'rsatiladi; qayta yuklash mumkin", async () => {
    await loadPreview();

    const blocked = screen.getByTestId("import-blocked");
    expect(blocked).toHaveTextContent(t.bloklangan);
    expect(screen.getByTestId("issue-4-number")).toHaveTextContent("4-qator · «Raqami» — Bu raqamli bog'cha allaqachon mavjud");
    expect(screen.getByTestId("select-4")).toBeDisabled();
    expect(screen.getByRole("button", { name: `${t.import_qilish} (1)` })).toBeDisabled();

    // Majburiy va ixtiyoriy ustunlar, faylda yo'q ustun
    expect(screen.getByTestId("col-name")).toHaveTextContent(`${t.majburiy}`);
    expect(screen.getByTestId("col-official_code")).toHaveTextContent(`${t.ixtiyoriy}`);
    expect(screen.getByTestId("col-official_code")).toHaveTextContent(t.faylda_topilmadi);

    // Tuzatilgan faylni yuklash — preview qaytadan
    fireEvent.click(screen.getByRole("button", { name: t.qayta_yuklash }));
    expect(screen.getByRole("button", { name: t.korib_chiqish })).toBeInTheDocument();
  });

  it("xatosiz faylda ogohlantirishli qator faqat qo'lda tasdiqlanadi", async () => {
    vi.mocked(uploadFile).mockResolvedValue({ data: cleanPreview });
    await loadPreview();

    expect(screen.queryByTestId("import-blocked")).toBeNull();
    expect(screen.getByTestId("select-2")).toBeChecked();
    expect(screen.getByTestId("select-3")).not.toBeChecked();
    expect(screen.getByRole("button", { name: `${t.import_qilish} (2)` })).toBeEnabled();

    fireEvent.click(screen.getByTestId("select-3"));
    expect(screen.getByRole("button", { name: `${t.import_qilish} (3)` })).toBeEnabled();
  });

  it("tasdiqlangandan keyin faylni qayta va faqat tanlangan qator raqamlarini yuboradi; natija preview bilan mos", async () => {
    vi.mocked(uploadFile).mockResolvedValueOnce({ data: cleanPreview });
    await loadPreview();
    vi.mocked(uploadFile).mockResolvedValueOnce({ data: { created: [{ id: 1 }, { id: 2 }], summary: { total: 3, created: 2, skipped: 1, errors: 0 } } });

    fireEvent.click(screen.getByTestId("select-4"));   // 4-qatorni chiqarib tashlaymiz
    fireEvent.click(screen.getByTestId("select-3"));
    fireEvent.click(screen.getByRole("button", { name: `${t.import_qilish} (2)` }));
    // Modal ichidagi tasdiq tugmasi
    const buttons = screen.getAllByRole("button", { name: t.import_qilish });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
    const [path, form] = vi.mocked(uploadFile).mock.calls[1] as [string, FormData];
    expect(path).toBe("/v1/super-admin/organizations/import");
    expect(form.get("district")).toBe("Bo'stonliq tumani");
    expect(form.get("file")).toBeInstanceOf(File);
    expect(form.getAll("rows[]")).toEqual(["2", "3"]);
    expect(form.getAll("confirmed_rows[]")).toEqual(["3"]);

    expect(await screen.findByTestId("import-result")).toHaveTextContent(`${t.natija_jami}: 3 · 2 ${t.yaratildi} · 1 ${t.otkazildi}`);
  });

  it("fayl tanlanmasa xabar ko'rsatadi", async () => {
    render(<BogchaImportPage />);
    fireEvent.click(screen.getByRole("button", { name: t.korib_chiqish }));
    expect(await screen.findByRole("alert")).toHaveTextContent(t.fayl_tanlang);
    expect(uploadFile).not.toHaveBeenCalled();
  });
});
