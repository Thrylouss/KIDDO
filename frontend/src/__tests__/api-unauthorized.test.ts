import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import { api, setUnauthorizedHandler } from "@/lib/api";

// ── Mocks — IS_DEMO false, haqiqiy fetch o'rniga soxta javoblar ───────────────

vi.mock("@/lib/demo-data", () => ({
  IS_DEMO:           false,
  handleDemoRequest: vi.fn(),
}));

const fetchMock = vi.fn();

function respond(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => body,
  });
}

let handler: Mock<() => void>;
let unregister: () => void;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  handler    = vi.fn<() => void>();
  unregister = setUnauthorizedHandler(handler);
});

afterEach(() => {
  unregister();
  vi.unstubAllGlobals();
});

// ── Sessiya tugashi (401) ──────────────────────────────────────────────────────

describe("api — 401 javobi", () => {
  it("autentifikatsiyalangan so'rovda 401 → handler bir marta chaqiriladi va xato tashlanadi", async () => {
    respond(401, { message: "Tizimga kirishingiz kerak." });

    await expect(api.get("/v1/admin/children")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("query parametrli yo'lda ham 401 handlerni chaqiradi", async () => {
    respond(401);

    await expect(api.get("/v1/super-admin/organizations?page=2")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(["/v1/login", "/v1/logout", "/v1/me"])(
    "%s uchun 401 handlerni chaqirmaydi (chaqiruvchi o'zi hal qiladi)",
    async (path) => {
      respond(401, { message: "Telefon raqami yoki parol noto'g'ri." });

      const call = path === "/v1/me" ? api.get(path) : api.post(path, {});
      await expect(call).rejects.toMatchObject({ status: 401 });
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each([403, 404, 422, 429, 500])("%i javobi logoutga aylanmaydi", async (status) => {
    respond(status);

    await expect(api.get("/v1/admin/children")).rejects.toMatchObject({ status });
    expect(handler).not.toHaveBeenCalled();
  });

  it("muvaffaqiyatli javobda handler chaqirilmaydi", async () => {
    respond(200, { data: [] });

    await expect(api.get("/v1/admin/children")).resolves.toEqual({ data: [] });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ro'yxatdan o'chirilgan handler chaqirilmaydi", async () => {
    unregister();
    respond(401);

    await expect(api.get("/v1/admin/children")).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });
});
