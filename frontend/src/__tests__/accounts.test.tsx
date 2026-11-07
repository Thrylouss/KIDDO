import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import PasswordChangePage from "@/app/parol-almashtirish/page";
import AdminAccountCard from "@/components/organizations/AdminAccountCard";
import { api } from "@/lib/api";
import uz from "@/i18n/uz";
import type { OrganizationDetail } from "@/types";

const push = vi.fn();
const updateUser = vi.fn();
let authUser: Record<string, unknown> | null = { id: 5, name: "Rahbar", role: "admin", must_change_password: true };

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser, loading: false, updateUser, logout: vi.fn().mockResolvedValue(undefined) }),
}));

const apiError = (status: number, data: unknown) => Object.assign(new Error("x"), { status, data });

const org = (admins: OrganizationDetail["admins"] = []): OrganizationDetail => ({
  id: 7, name: "5-sonli DMTT", phone: null, address: null, number: "5", director_name: "Aliyeva Malika",
  is_active: true, created_at: "2026-11-05", admin: null, subscription: null, admins,
  groups_count: 0, children_count: 0, teacher_profiles_count: 0, parent_profiles_count: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { id: 5, name: "Rahbar", role: "admin", must_change_password: true };
});

describe("Birinchi kirishda parolni almashtirish", () => {
  const fill = (current: string, next: string, confirm: string) => {
    fireEvent.change(document.getElementById("current-password")!, { target: { value: current } });
    fireEvent.change(document.getElementById("new-password")!, { target: { value: next } });
    fireEvent.change(document.getElementById("confirm-password")!, { target: { value: confirm } });
    fireEvent.click(screen.getByRole("button", { name: uz.parol_almashtirish.saqlash }));
  };

  it("muvaffaqiyatli almashtirishdan keyin rol paneliga yo'naltiradi", async () => {
    vi.mocked(api.put).mockResolvedValue({ user: { id: 5, role: "admin", must_change_password: false } });
    render(<PasswordChangePage />);
    fill("Vaqtinchalik1", "Yangi-parol-1", "Yangi-parol-1");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/bogcha"));
    expect(api.put).toHaveBeenCalledWith("/v1/me/password", {
      current_password: "Vaqtinchalik1", password: "Yangi-parol-1", password_confirmation: "Yangi-parol-1",
    });
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ must_change_password: false }));
  });

  it("mos kelmaydigan takror va qisqa parol so'rovsiz rad etiladi", () => {
    render(<PasswordChangePage />);
    expect(screen.getByRole("heading", { name: uz.parol_almashtirish.sarlavha })).toBeInTheDocument();
    fill("Vaqtinchalik1", "Yangi-parol-1", "boshqa-parol");
    expect(screen.getByText(uz.parol_almashtirish.mos_emas)).toBeInTheDocument();
    fill("Vaqtinchalik1", "qisqa", "qisqa");
    expect(screen.getByText(uz.parol_almashtirish.qisqa)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("noto'g'ri joriy parol — maydon xatosi ko'rsatiladi", async () => {
    vi.mocked(api.put).mockRejectedValue(apiError(422, { errors: { current_password: ["Joriy parol noto'g'ri."] } }));
    render(<PasswordChangePage />);
    fill("xato", "Yangi-parol-1", "Yangi-parol-1");
    expect(await screen.findByText("Joriy parol noto'g'ri.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Super Admin: rahbar akkaunti", () => {
  it("rahbar yo'q — login taklif qilinadi, yaratilgach vaqtinchalik parol bir marta ko'rsatiladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { username: "dmtt5", temporary_password: "Kp4mXr7tWq2z" } });
    const onChanged = vi.fn();
    render(<AdminAccountCard org={org()} onChanged={onChanged} />);

    expect(screen.getByLabelText(new RegExp(`^${uz.akkaunt.login}`))).toHaveValue("dmtt5");
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.yaratish }));

    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Kp4mXr7tWq2z");
    expect(api.post).toHaveBeenCalledWith("/v1/super-admin/organizations/7/admin-account", { username: "dmtt5", name: null });
    expect(onChanged).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.saqlab_oldim }));
    await waitFor(() => expect(screen.queryByText("Kp4mXr7tWq2z")).toBeNull());
  });

  it("band login — maydon xatosi", async () => {
    vi.mocked(api.post).mockRejectedValue(apiError(422, { errors: { username: ["Bu login band. Boshqa login tanlang."] } }));
    render(<AdminAccountCard org={org()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.yaratish }));
    expect(await screen.findByText("Bu login band. Boshqa login tanlang.")).toBeInTheDocument();
  });

  it("rahbar bor — holati ko'rsatiladi, tasdiqdan keyin yangi vaqtinchalik parol", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { username: "quyosh123", temporary_password: "Zx8nBv3cMq5k" } });
    render(<AdminAccountCard org={org([{ id: 2, name: "Aliyeva Malika", username: "quyosh123", phone: null, email: null,
      is_active: true, must_change_password: true, last_login_at: null }])} onChanged={vi.fn()} />);

    expect(screen.getByText("quyosh123")).toBeInTheDocument();
    expect(screen.getByText(uz.akkaunt.almashtirilmagan)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: uz.akkaunt.parol_yangilash }));
    const buttons = screen.getAllByRole("button", { name: uz.akkaunt.parol_yangilash });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByTestId("temp-password")).toHaveTextContent("Zx8nBv3cMq5k");
    expect(api.post).toHaveBeenCalledWith("/v1/super-admin/organizations/7/reset-password", {});
  });
});
