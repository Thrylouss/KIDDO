import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/demo-data", () => ({ IS_DEMO: false, handleDemoRequest: vi.fn() }));

const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

describe("fetchAllPages", () => {
  it("barcha sahifalarni per_page=100 bilan yig'adi", async () => {
    fetchMock.mockImplementation((url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return json({ data: [{ id: page }], meta: { current_page: page, last_page: 3 } });
    });
    const { fetchAllPages } = await import("@/lib/api");
    expect(await fetchAllPages("/v1/super-admin/organizations?sort=name")).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toMatch(/\/v1\/super-admin\/organizations\?sort=name&per_page=100&page=1$/);
  });

  it("meta bo'lmasa bitta so'rov", async () => {
    fetchMock.mockImplementation(() => json({ data: [{ id: 1 }] }));
    const { fetchAllPages } = await import("@/lib/api");
    expect(await fetchAllPages("/v1/x")).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/x\?per_page=100&page=1$/);
  });
});
