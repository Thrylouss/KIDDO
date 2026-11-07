import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import OtaOnalarPage from "@/app/bogcha/ota-onalar/page";
import ChildParentsModal from "@/components/ChildParentsModal";
import TeacherGroupsModal from "@/components/TeacherGroupsModal";
import { api } from "@/lib/api";
import type { Child, TeacherProfile } from "@/types";
import uz from "@/i18n/uz";

// ── Mocks — IS_DEMO true: yozish amallari bloklanishi kerak ──────────────────

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: true }));

const PARENT = {
  id: 1, user_id: 20, organization_id: 1, first_name: "Mohira", last_name: "Yusupova",
  phone: "+998901234102", relation_type: "ona",
  children: [{ id: 2, first_name: "Malika", last_name: "Yusupova", pivot: { relation_type: "ona", is_primary: false } }],
};

const FREE_PARENT = {
  id: 3, user_id: 22, organization_id: 1, first_name: "Sarvar", last_name: "Yusupov",
  phone: "+998901234103", relation_type: "ota", children: [],
};

const CHILD: Child = {
  id: 2, organization_id: 1, group_id: null, first_name: "Malika", last_name: "Yusupova",
  birth_date: "2021-04-12", gender: "ayol", is_active: true,
};

const TEACHER: TeacherProfile = {
  id: 5, user_id: 50, organization_id: 1, first_name: "Maftuna", last_name: "Xolmatova",
  phone: "+998901110005", position: "Tarbiyachi", is_active: true, groups: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) =>
    Promise.resolve(path === "/v1/admin/groups" ? { data: [{ id: 10, name: "Kamalak" }] } : { data: [PARENT, FREE_PARENT] }),
  );
});

describe("Demo rejim — admin yozish amallari", () => {
  it("ota-ona qo'shish: ogohlantirish, saqlash o'chiq, so'rov yo'q", async () => {
    render(<OtaOnalarPage />);
    await screen.findByText("Yusupova Mohira");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(uz.ota_onalar.qoshish) }));

    expect(screen.getByRole("note")).toHaveTextContent(uz.common.demo_saqlanmaydi);
    expect(screen.getByRole("button", { name: uz.common.saqlash })).toBeDisabled();
    fireEvent.submit(document.getElementById("parent-form")!);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("bolaga bog'lash va olib tashlash o'chiq", async () => {
    render(<ChildParentsModal child={CHILD} onClose={vi.fn()} />);
    await screen.findByText(uz.bolalar.boglangan_ota_onalar);

    expect(screen.getByRole("note")).toHaveTextContent(uz.common.demo_saqlanmaydi);
    expect(screen.getByRole("button", { name: uz.bolalar.olib_tashlash })).toBeDisabled();
    expect(screen.getByRole("button", { name: uz.bolalar.boglash })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("tarbiyachi guruhlari: saqlash o'chiq, so'rov yo'q", async () => {
    render(<TeacherGroupsModal teacher={TEACHER} onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByLabelText("Kamalak");

    expect(screen.getByRole("note")).toHaveTextContent(uz.common.demo_saqlanmaydi);
    const save = screen.getByRole("button", { name: uz.common.saqlash });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(api.put).not.toHaveBeenCalled();
  });
});
