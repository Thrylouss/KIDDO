import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DavomatPage from "@/app/bogcha/davomat/page";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO false ─────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const DAY = {
  groups:        [{ id: 7, name: "Asal" }],
  group:         { id: 7, name: "Asal", age_category: null, capacity: null },
  date:          "2026-10-28",
  editable:      true,
  editable_from: "2026-09-28",
  children:      [{ id: 1, first_name: "Ali", last_name: "Valiyev", status: "absent", note: null }],
  summary:       { total: 1, present: 0, absent: 1, excused: 0, unmarked: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(DAY);
});

describe("Bog'cha — davomat sahifasi", () => {
  it("admin endpointidan yuklaydi va tuzatishni PUT /v1/admin/attendance ga yuboradi", async () => {
    vi.mocked(api.put).mockResolvedValue({ ...DAY, children: [{ ...DAY.children[0], status: "excused" }] });
    render(<DavomatPage />);

    await screen.findByText("Valiyev Ali");
    expect(api.get).toHaveBeenCalledWith("/v1/admin/attendance");

    fireEvent.click(screen.getByTestId("status-1-excused"));
    // «Sababli» — modalda sabab va izoh
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.sabab}`), { selector: "input, select, textarea" }), { target: { value: "oilaviy" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.izoh}`), { selector: "input, select, textarea" }), { target: { value: "Safarda" } });
    fireEvent.click(screen.getByRole("button", { name: uz.common.saqlash }));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    expect(await screen.findByRole("status")).toHaveTextContent(uz.davomat.saqlandi);
    expect(api.put).toHaveBeenCalledWith("/v1/admin/attendance", {
      date: "2026-10-28", group_id: 7, records: [{ child_id: 1, status: "excused", excuse_reason: "oilaviy", note: "Safarda" }],
    });
  });

  it("sana tanlansa date parametri bilan qayta yuklanadi", async () => {
    render(<DavomatPage />);
    await screen.findByText("Valiyev Ali");

    fireEvent.change(screen.getByLabelText(new RegExp(`^${uz.davomat.sana}`), { selector: "input, select, textarea" }), { target: { value: "2026-10-20" } });

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/v1/admin/attendance?date=2026-10-20"));
  });

  it("guruh yo'q bo'lsa yo'l-yo'riq", async () => {
    vi.mocked(api.get).mockResolvedValue({ ...DAY, groups: [], group: null, children: [], summary: null });
    render(<DavomatPage />);

    expect(await screen.findByText(uz.davomat.guruh_yoq_admin)).toBeInTheDocument();
  });

  it("yuklash xatosi → xabar va qayta urinish", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(Object.assign(new Error("x"), { status: 404, data: { message: "Guruh topilmadi." } }))
      .mockResolvedValueOnce(DAY);
    render(<DavomatPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Guruh topilmadi.");
    fireEvent.click(screen.getByRole("button", { name: uz.common.qayta_urinish }));
    expect(await screen.findByText("Valiyev Ali")).toBeInTheDocument();
  });
});
