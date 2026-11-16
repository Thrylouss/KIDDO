import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { setLocale } from "@/i18n";
import { PreferencesProvider, useLocale } from "@/contexts/PreferencesContext";
import QuickPreferences from "@/components/preferences/QuickPreferences";
import DemoRequestForm from "@/components/landing/DemoRequestForm";
import uz from "@/i18n/uz";
import ru from "@/i18n/ru";
import en from "@/i18n/en";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

/** Haqiqiy sahifa kabi: useLocale() ga obuna bo'lgan sahifa komponenti ichida forma. */
function Page() {
  useLocale();
  return <DemoRequestForm />;
}

afterEach(() => {
  act(() => setLocale("uz"));
  localStorage.clear();
});

function switchTo(name: string, menuLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: menuLabel }));
  fireEvent.click(screen.getByRole("menuitemradio", { name }));
}

describe("Til almashganda saqlanmagan forma ma'lumotlari yo'qolmaydi", () => {
  it("UZ → RU → EN: kiritilgan qiymatlar, tanlovlar va belgilar saqlanadi, yorliqlar tarjima qilinadi", () => {
    render(<PreferencesProvider><QuickPreferences /><Page /></PreferencesProvider>);

    const name = screen.getByLabelText(new RegExp(uz.landing.f_nomi)) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Quyoshcha" } });
    const region = screen.getByLabelText(new RegExp(uz.landing.f_viloyat)) as HTMLSelectElement;
    fireEvent.change(region, { target: { value: "Samarqand viloyati" } });
    const consent = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(consent);

    switchTo("Русский", uz.interfeys.til_tanlash);
    const nameRu = screen.getByLabelText(new RegExp(ru.landing!.f_nomi!)) as HTMLInputElement;
    expect(nameRu).toBe(name);                 // xuddi shu DOM element — remount bo'lmadi
    expect(nameRu.value).toBe("Quyoshcha");
    expect((screen.getByLabelText(new RegExp(ru.landing!.f_viloyat!)) as HTMLSelectElement).value).toBe("Samarqand viloyati");
    expect(screen.getByRole("option", { name: "Самаркандская область" })).toBeInTheDocument();
    expect(consent.checked).toBe(true);

    switchTo("English", ru.interfeys!.til_tanlash!);
    expect((screen.getByLabelText(new RegExp(en.landing!.f_nomi!)) as HTMLInputElement).value).toBe("Quyoshcha");
    expect(screen.getByRole("option", { name: "Samarkand region" })).toBeInTheDocument();
    expect(consent.checked).toBe(true);
  });

  it("mavzu almashganda ham forma holati saqlanadi", () => {
    render(<PreferencesProvider><QuickPreferences /><Page /></PreferencesProvider>);
    const name = screen.getByLabelText(new RegExp(uz.landing.f_nomi)) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Lola" } });
    switchTo(uz.interfeys.qorongi, uz.interfeys.mavzu_tanlash);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(name.value).toBe("Lola");
  });
});
