import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import AttendanceSheet from "@/components/attendance/AttendanceSheet";
import type { AttendanceDay } from "@/types";
import uz from "@/i18n/uz";

const DAY: AttendanceDay = {
  groups:        [{ id: 7, name: "Asal" }],
  group:         { id: 7, name: "Asal", age_category: null, capacity: null },
  date:          "2026-10-28",
  editable:      true,
  editable_from: "2026-09-28",
  children: [
    { id: 1, first_name: "Ali",  last_name: "A", status: "present", note: null },
    { id: 2, first_name: "Bek",  last_name: "B", status: null,      note: null },
    { id: 3, first_name: "Gul",  last_name: "C", status: null,      note: null },
  ],
  summary: { total: 3, present: 1, absent: 0, excused: 0, unmarked: 2 },
};

function apiError(status: number) {
  return Object.assign(new Error("xato"), { status, data: {} });
}

describe("AttendanceSheet", () => {
  it("o'zgarish bo'lmasa saqlash o'chiq; o'zgarish soni ko'rsatiladi", () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: uz.davomat.saqlash })).toBeDisabled();
    fireEvent.click(screen.getByTestId("status-2-absent"));
    expect(screen.getByTestId("unsaved")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: uz.davomat.saqlash })).toBeEnabled();
  });

  it("«Belgilanmaganlarni Keldi» faqat belgilanmaganlarga ta'sir qiladi", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AttendanceSheet day={DAY} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: uz.davomat.barchasi_keldi }));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    await screen.findByRole("status");
    expect(onSave).toHaveBeenCalledWith([
      { child_id: 2, status: "present", note: null },
      { child_id: 3, status: "present", note: null },
    ]);
  });

  it.each([
    [403, uz.common.ruxsat_yoq],
    [422, uz.auth.validatsiya_xatosi],
  ])("saqlash %i → xato xabari", async (status, message) => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn().mockRejectedValue(apiError(status))} />);

    fireEvent.click(screen.getByTestId("status-2-absent"));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("tarmoq xatosi → tarmoq xabari", async () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))} />);

    fireEvent.click(screen.getByTestId("status-2-absent"));
    fireEvent.click(screen.getByRole("button", { name: uz.davomat.saqlash }));

    expect(await screen.findByRole("alert")).toHaveTextContent(uz.auth.tarmoq_xatosi);
  });

  it("takroriy bosish bitta so'rov yuboradi", async () => {
    let resolve!: () => void;
    const onSave = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    render(<AttendanceSheet day={DAY} onSave={onSave} />);

    fireEvent.click(screen.getByTestId("status-2-absent"));
    const save = screen.getByRole("button", { name: uz.davomat.saqlash });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    resolve();
    await screen.findByRole("status");
  });

  it("tahrirlab bo'lmaydigan kun: tugmalar o'chiq, saqlash yo'q", () => {
    render(<AttendanceSheet day={{ ...DAY, editable: false }} onSave={vi.fn()} />);

    expect(screen.getByRole("note")).toHaveTextContent(DAY.editable_from);
    expect(screen.getByTestId("status-2-present")).toBeDisabled();
    expect(screen.queryByRole("button", { name: uz.davomat.saqlash })).toBeNull();
  });

  it("birinchi render'dan keyingi darhol bosish yo'qolmaydi (effekt poygasi yo'q)", () => {
    render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);

    fireEvent.click(screen.getByTestId("status-1-absent"));

    expect(screen.getByTestId("status-1-absent")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("unsaved")).toHaveTextContent("1");
  });

  it("yangi server javobi (day) kelganda qoralama tiklanadi", () => {
    const { rerender } = render(<AttendanceSheet day={DAY} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId("status-2-absent"));

    rerender(<AttendanceSheet day={{ ...DAY, children: DAY.children.map((c) => ({ ...c, status: "present" as const })) }} onSave={vi.fn()} />);

    expect(screen.getByTestId("status-2-present")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("unsaved")).toBeNull();
  });

  it("bolalar bo'lmasa bo'sh holat", () => {
    render(<AttendanceSheet day={{ ...DAY, children: [] }} onSave={vi.fn()} />);
    expect(screen.getByText(uz.davomat.bola_yoq)).toBeInTheDocument();
  });
});
