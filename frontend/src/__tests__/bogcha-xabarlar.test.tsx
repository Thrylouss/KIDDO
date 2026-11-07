import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import BogchaXabarlarPage from "@/app/bogcha/xabarlar/page";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false }));

const groups = [{ id: 5, name: "Quyosh" }, { id: 6, name: "Oy" }];
const children = [
  { id: 11, first_name: "Ali",  last_name: "Valiyev", is_active: true, group: { id: 5, name: "Quyosh" } },
  { id: 12, first_name: "Vali", last_name: "Aliyev",  is_active: true, group: { id: 6, name: "Oy" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/v1/admin/messages") return Promise.resolve({ groups, data: [] });
    if (url === "/v1/admin/children") return Promise.resolve({ data: children });
    return Promise.reject(new Error(`Unexpected: ${url}`));
  });
});

describe("Bog'cha admini — Xabarlar", () => {
  it("admin API'laridan guruhlar va bolalarni yuklaydi", async () => {
    render(<BogchaXabarlarPage />);
    await waitFor(() => expect(screen.getByText("Yangi xabar")).toBeInTheDocument());
    const calls = vi.mocked(api.get).mock.calls.map(([u]) => u);
    expect(calls).toEqual(expect.arrayContaining(["/v1/admin/messages", "/v1/admin/children"]));
    expect(calls.some((u) => String(u).startsWith("/v1/teacher"))).toBe(false);
  });

  it("guruhga xabarni /v1/admin/messages ga yuboradi va tarixga qo'shadi", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 1, audience: "group", group: { id: 6, name: "Oy" }, child: null, sender: "Admin", subject: null,
        body: "Ertaga bayram", created_at: "2026-11-04T09:00:00Z", recipients_count: 3, read_count: 0, recipients: [],
      },
    });
    render(<BogchaXabarlarPage />);
    await waitFor(() => expect(screen.getByText("Yangi xabar")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Kimga"), { target: { value: "group" } });
    fireEvent.change(screen.getByLabelText("Guruh"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText(/Xabar matni/), { target: { value: "Ertaga bayram" } });
    fireEvent.click(screen.getByRole("button", { name: "Yuborish" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/v1/admin/messages", expect.objectContaining({
      audience: "group", group_id: 6, body: "Ertaga bayram",
    })));
    expect(await screen.findByText("Xabar yuborildi.")).toBeInTheDocument();
    expect(screen.getByTestId("message-history")).toHaveTextContent("Ertaga bayram");
  });
});
