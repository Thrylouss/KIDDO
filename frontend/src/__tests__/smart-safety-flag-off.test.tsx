import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PresentationPage from "@/app/smart-safety/page";
import uz from "@/i18n/uz";

vi.mock("@/lib/smart-safety/features", () => ({ SMART_SAFETY_DEMO: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/", useParams: () => ({}) }));

describe("Smart Safety feature flag o'chiq", () => {
  it("taqdimot sahifasi faqat «yoqilmagan» xabarini ko'rsatadi", () => {
    render(<PresentationPage />);
    expect(screen.getByRole("note")).toHaveTextContent(uz.ss.disabled);
    expect(screen.queryByTestId("simulator")).not.toBeInTheDocument();
  });

  it("flag standart holatda o'chiq (env berilmagan)", async () => {
    vi.doUnmock("@/lib/smart-safety/features");
    vi.resetModules();
    const mod = await import("@/lib/smart-safety/features");
    expect(mod.SMART_SAFETY_DEMO).toBe(false);
  });
});
