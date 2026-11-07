import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import DavomatPage from "@/app/bogcha/davomat/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO true: backendga so'rov ketmasligi va soxta saqlash bo'lmasligi kerak

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: true }));

describe("Bog'cha — davomat sahifasi (demo)", () => {
  it("demo ogohlantirishi, API chaqirilmaydi, saqlash tugmasi yo'q", () => {
    render(<DavomatPage />);

    expect(screen.getByRole("note")).toHaveTextContent(uz.davomat.demo_admin);
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: uz.davomat.saqlash })).toBeNull();
  });
});
