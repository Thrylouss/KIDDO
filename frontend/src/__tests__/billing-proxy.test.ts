// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config, loopbackRedirectTarget } from "@/proxy";
import { BILLING_ENABLED } from "@/lib/features";

const req = (path: string, host = "127.0.0.1:3001") =>
  new NextRequest(`http://${host}${path}`, { headers: { host } });

afterEach(() => vi.unstubAllEnvs());

describe("Billing proxy (BILLING_ENABLED=false)", () => {
  it("MVP'da billing o'chiq", () => expect(BILLING_ENABLED).toBe(false));

  it.each(["/admin/tariflar", "/admin/obunalar", "/admin/tolovlar/5", "/admin/invoices", "/admin/payments", "/admin/subscriptions"])(
    "%s → mavjud bo'lmagan yo'lga rewrite (404)",
    (path) => {
      const res = proxy(req(path));
      expect(new URL(res.headers.get("x-middleware-rewrite") ?? "http://x/").pathname).toBe("/_kiddo/bolim-ochirilgan");
    },
  );

  it.each(["/", "/login", "/bogcha/tolovlar", "/admin/tolovlarX", "/admin/dashboard"])("%s — o'zgarishsiz", (path) => {
    const res = proxy(req(path));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("matcher sahifalarni qamraydi, Next resurslari va fayllarni emas", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ["/", "/login", "/admin/tariflar", "/bogcha/dashboard"]) expect(re.test(p)).toBe(true);
    for (const p of ["/_next/static/chunks/a.js", "/_next/image", "/landing/rahbar-dashboard.jpg", "/favicon.ico", "/manifest.json"]) {
      expect(re.test(p)).toBe(false);
    }
  });
});

describe("Lokal muhit: sahifa API bilan bir xil loopback host'da ochiladi", () => {
  const API = "http://127.0.0.1:8001/api";

  it.each([
    ["localhost:3001", "/login", "http://127.0.0.1:3001/login"],
    ["localhost:3001", "/bogcha/dashboard?tab=1", "http://127.0.0.1:3001/bogcha/dashboard?tab=1"],
    ["[::1]:3001", "/", "http://127.0.0.1:3001/"],
    ["LOCALHOST:3001", "/", "http://127.0.0.1:3001/"],
  ])("%s%s → %s", (host, path, target) => expect(loopbackRedirectTarget(host, API, path)).toBe(target));

  it.each([
    ["127.0.0.1:3001", API],                              // allaqachon to'g'ri host
    ["kiddo.uz", "https://api.kiddo.uz/api"],             // production domeni
    ["localhost:3000", "https://api.kiddo.uz/api"],       // API loopback emas
    ["192.168.1.5:3001", API],                            // tarmoqdagi IP — tegilmaydi
    ["localhost:3001", undefined],
    [null, API],
  ])("%s (API %s) — yo'naltirilmaydi", (host, api) => expect(loopbackRedirectTarget(host, api, "/login")).toBeNull());

  it("QA stek (API localhost'da) — 127.0.0.1 dan localhost'ga", () => {
    expect(loopbackRedirectTarget("127.0.0.1:3000", "http://localhost:8000/api", "/login")).toBe("http://localhost:3000/login");
  });

  it("production rejimida yo'naltirilmaydi (halqa xavfi yo'q)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", API);
    vi.stubEnv("NODE_ENV", "production");
    const res = proxy(req("/login", "localhost:3001"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("proxy: localhost:3001 → 307 127.0.0.1:3001", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", API);
    const res = proxy(req("/login?x=1", "localhost:3001"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://127.0.0.1:3001/login?x=1");
  });
});
