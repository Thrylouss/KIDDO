import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import DemoRequestForm, { formatUzPhone, isValidUzPhone } from "@/components/landing/DemoRequestForm";
import uz from "@/i18n/uz";

const t = uz.landing;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown = { message: t.f_muvaffaqiyat }, status = 201) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body });

function fill() {
  const change = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
  change("demo-kindergarten_name", "Quyoshcha");
  fireEvent.click(screen.getByLabelText(t.f_xususiy));
  change("demo-region", "Toshkent shahri");
  change("demo-district", "Chilonzor tumani");
  change("demo-director_name", "Karimova Dilnoza");
  change("demo-phone", "90 123 45 67");
  change("demo-children_count", "120");
  fireEvent.click(document.getElementById("demo-consent")!);
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: t.demo_cta }));

describe("Telefon formati", () => {
  it.each([
    ["901234567", "+998 90 123 45 67"],
    ["+998 (90) 123-45-67", "+998 90 123 45 67"],
    ["998901234567", "+998 90 123 45 67"],
    ["9012", "+998 90 12"],
    ["", ""],
  ])("%s → %s", (input, out) => expect(formatUzPhone(input)).toBe(out));

  it("tekshiruv", () => {
    expect(isValidUzPhone("+998 90 123 45 67")).toBe(true);
    expect(isValidUzPhone("+998 90 123 45")).toBe(false);
  });
});

describe("DEMO ariza formasi", () => {
  it("barcha talab qilingan maydonlar bor", () => {
    render(<DemoRequestForm />);
    for (const label of [t.f_nomi, t.f_viloyat, t.f_tuman, t.f_manzil, t.f_rahbar, t.f_telefon, t.f_bolalar, t.f_guruhlar, t.f_izoh]) {
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    }
    expect(screen.getByLabelText(t.f_davlat)).toBeChecked();
    expect(screen.getByLabelText(new RegExp(t.f_rozilik.slice(0, 30)))).not.toBeChecked();
  });

  it("bo'sh forma yuborilmaydi — tushunarli xatolar", async () => {
    render(<DemoRequestForm />);
    submit();
    expect(await screen.findByTestId("demo-form-error")).toHaveTextContent(t.f_xato_tekshiring);
    expect(screen.getAllByText(t.f_majburiy).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(t.f_rozilik_xato)).toBeInTheDocument();
    expect(document.getElementById("demo-kindergarten_name")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("noto'g'ri telefon rad etiladi", async () => {
    render(<DemoRequestForm />);
    fill();
    fireEvent.change(document.getElementById("demo-phone")!, { target: { value: "90 12" } });
    submit();
    expect(await screen.findByText(t.f_telefon_xato)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muvaffaqiyatli yuborish: backendga to'g'ri ma'lumot, tasdiqlash xabari", async () => {
    fetchMock.mockReturnValue(ok());
    render(<DemoRequestForm />);
    fill();
    submit();

    expect(await screen.findByTestId("demo-success")).toHaveTextContent(
      "Arizangiz muvaffaqiyatli yuborildi! KIDDO jamoasi tez orada siz bilan bog'lanadi.",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/demo-requests$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      kindergarten_name: "Quyoshcha", kindergarten_type: "xususiy", region: "Toshkent shahri", district: "Chilonzor tumani",
      director_name: "Karimova Dilnoza", phone: "+998901234567", children_count: "120", groups_count: null, consent: true, website: "",
    });
  });

  it("yuborish davomida loading va takroriy bosish bloklanadi", async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<DemoRequestForm />);
    fill();
    submit();
    const btn = await screen.findByRole("button", { name: new RegExp(t.f_yuborilmoqda) });
    expect(btn).toBeDisabled();
    fireEvent.submit(btn.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, status: 201, json: async () => ({ message: t.f_muvaffaqiyat }) });
    expect(await screen.findByTestId("demo-success")).toBeInTheDocument();
  });

  it("server validatsiya xatolari maydonlar yonida ko'rsatiladi", async () => {
    fetchMock.mockReturnValue(ok({ message: "x", errors: { phone: ["Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67"] } }, 422));
    render(<DemoRequestForm />);
    fill();
    submit();
    expect(await screen.findByText("Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67")).toBeInTheDocument();
    expect(screen.queryByTestId("demo-success")).toBeNull();
  });

  it("tarmoq xatosi — kiritilgan ma'lumot saqlanib qoladi", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DemoRequestForm />);
    fill();
    submit();
    expect(await screen.findByTestId("demo-form-error")).toHaveTextContent(t.f_xato_umumiy);
    expect(document.getElementById("demo-kindergarten_name")).toHaveValue("Quyoshcha");
  });

  it("429 — juda ko'p urinish xabari", async () => {
    fetchMock.mockReturnValue(ok({ message: "Too Many Attempts." }, 429));
    render(<DemoRequestForm />);
    fill();
    submit();
    expect(await screen.findByTestId("demo-form-error")).toHaveTextContent(t.f_kop_urinish);
  });

  it("honeypot foydalanuvchiga ko'rinmaydi", () => {
    render(<DemoRequestForm />);
    expect(document.getElementById("demo-website")?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(document.getElementById("demo-website")).toHaveAttribute("tabindex", "-1");
  });
});
