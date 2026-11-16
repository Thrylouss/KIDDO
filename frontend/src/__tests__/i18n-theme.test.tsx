import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import uzDict from "@/i18n/uz";
import ru from "@/i18n/ru";
import en from "@/i18n/en";
import t, { getLocale, setLocale, intlLocale, readStoredLocale, plural } from "@/i18n";
import { PreferencesProvider, useLocale } from "@/contexts/PreferencesContext";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import InterfaceSettings from "@/components/settings/InterfaceSettings";
import { THEME_STORAGE_KEY, resolveTheme } from "@/lib/theme";
import { formatUzDate, formatDuration } from "@/lib/dates";

type Node = Record<string, unknown>;
function leaves(o: unknown, prefix = ""): string[] {
  if (typeof o === "string") return [prefix];
  if (o === null || typeof o !== "object") return [];
  return Object.entries(o as Node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}
// Massivlardagi texnik qiymatlar (ikonka kaliti, holat) tarjima qilinmaydi — ataylab O'zbekchaga fallback
const TECHNICAL = /^landing\.(imk\.\d+\.kalit|ota_bandlar\.\d+\.holat)$/;

afterEach(() => {
  act(() => setLocale("uz"));
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("i18n lug'atlari", () => {
  const uzKeys = leaves(uzDict).filter((k) => !TECHNICAL.test(k));
  for (const [name, dict] of [["ru", ru], ["en", en]] as const) {
    it(`${name}: barcha uz kalitlari tarjima qilingan`, () => {
      const have = new Set(leaves(dict));
      expect(uzKeys.filter((k) => !have.has(k))).toEqual([]);
    });
    it(`${name}: ortiqcha (uz'da yo'q) kalit yo'q`, () => {
      const all = new Set(leaves(uzDict));
      expect(leaves(dict).filter((k) => !all.has(k))).toEqual([]);
    });
  }
});

describe("Til almashtirish (Proxy)", () => {
  it("standart — O'zbekcha, almashtirilganda joriy til qaytadi, sahifa qayta yuklanmaydi", () => {
    expect(getLocale()).toBe("uz");
    expect(t.common.saqlash).toBe("Saqlash");
    setLocale("ru");
    expect(t.common.saqlash).toBe("Сохранить");
    expect(t.demo_arizalar.status.new).toBe("Новая заявка");
    expect(document.documentElement.lang).toBe("ru");
    setLocale("en");
    expect(t.common.saqlash).toBe("Save");
    expect(intlLocale()).toBe("en-GB");
  });

  it("massiv elementlari va texnik qiymatlar: tarjima + O'zbekchaga fallback", () => {
    setLocale("en");
    expect(t.landing.imk[0].nom).toBe("Children database and profiles");
    expect(t.landing.imk[0].kalit).toBe("bolalar");
    expect(t.landing.ota_bandlar[6].holat).toBe("rejada");
  });

  it("tanlov localStorage'da saqlanadi va qayta o'qiladi", () => {
    setLocale("ru");
    expect(localStorage.getItem("kiddo.locale")).toBe("ru");
    expect(readStoredLocale()).toBe("ru");
  });

  it("ko'plik shakllari: ru 1/2/5/21, en 1/2, uz o'zgarishsiz", () => {
    expect(`1 ${plural(1, t.bogchalar.natija)}`).toBe("1 ta natija");
    setLocale("ru");
    expect([1, 2, 5, 11, 21, 22].map((n) => `${n} ${plural(n, t.bogchalar.natija)}`))
      .toEqual(["1 результат", "2 результата", "5 результатов", "11 результатов", "21 результат", "22 результата"]);
    expect(`3 ${plural(3, t.super_admin.qolgan_kun)}`).toBe("3 дня осталось");
    setLocale("en");
    expect(`1 ${plural(1, t.bogchalar.natija)}`).toBe("1 result");
    expect(`7 ${plural(7, t.demo_arizalar.urinishlar)}`).toBe("7 attempts");
  });

  it("sana va davomiylik tilga moslashadi", () => {
    expect(formatUzDate("2026-10-28")).toBe("28 oktabr 2026");
    expect(formatDuration("13:00", "15:30")).toBe("2 soat 30 daqiqa");
    setLocale("en");
    expect(formatUzDate("2026-10-28")).toBe("28 October 2026");
    expect(formatDuration("13:00", "15:30")).toBe("2 h 30 min");
  });
});

describe("Header va Sozlamalar — til/mavzu sinxron", () => {
  beforeEach(() => localStorage.clear());

  // Sahifa komponentlari singari — provider ichida render qilinadi
  function Probe() { useLocale(); return <p data-testid="probe">{t.common.saqlash}</p>; }

  function Harness() {
    return (
      <PreferencesProvider>
        <QuickPreferences />
        <InterfaceSettings />
        <Probe />
      </PreferencesProvider>
    );
  }

  it("Sozlamalarda til tanlansa butun interfeys yangilanadi va header'dagi belgi o'zgaradi", () => {
    render(<Harness />);
    expect(screen.getByTestId("probe")).toHaveTextContent("Saqlash");
    act(() => { fireEvent.click(screen.getByLabelText("Русский")); });
    expect(screen.getByTestId("probe")).toHaveTextContent("Сохранить");
    expect(screen.getByRole("button", { name: "Выбрать язык" })).toHaveTextContent("RU");
    expect(screen.getByText("Интерфейс")).toBeInTheDocument();
  });

  it("header menyusidan mavzu tanlansa Sozlamalardagi radio va <html data-theme> sinxron", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: uzDict.interfeys.mavzu_tanlash }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: uzDict.interfeys.qorongi }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-pref")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByLabelText(uzDict.interfeys.qorongi)).toBeChecked();

    fireEvent.click(screen.getByLabelText(uzDict.interfeys.yorug));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("Tizim rejimi qurilma sozlamasiga qarab hal qilinadi", () => {
    expect(["light", "dark"]).toContain(resolveTheme("system"));
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("saqlangan til birinchi yuklashda qo'llanadi", () => {
    localStorage.setItem("kiddo.locale", "en");
    render(<Harness />);
    expect(screen.getByTestId("probe")).toHaveTextContent("Save");
  });
});
