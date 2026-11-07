import { NextResponse, type NextRequest } from "next/server";
import { BILLING_ENABLED } from "@/lib/features";

const BILLING_PATH = /^\/admin\/(tariflar|obunalar|tolovlar|invoices|payments|subscriptions)(\/|$)/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Lokal muhitda sahifa API bilan bir xil loopback host'da ochilishi kerak: masalan, API 127.0.0.1:8001 da,
 * sahifa esa localhost:3001 da ochilsa — CORS (FRONTEND_URL) rad etadi va `kiddo_token` cookie
 * (SameSite=Strict, 127.0.0.1 host'ida) «boshqa sayt» bo'lib yuborilmaydi. Shunday holatda
 * API host'iga yo'naltirish manzilini qaytaradi; aks holda null (production domenlariga ta'sir qilmaydi).
 */
export function loopbackRedirectTarget(hostHeader: string | null, apiUrl: string | undefined, pathAndQuery: string): string | null {
  if (!hostHeader || !apiUrl) return null;
  let api: URL;
  try {
    api = new URL(apiUrl);
  } catch {
    return null;
  }
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(hostHeader.trim().toLowerCase());
  if (!match) return null;
  const [, hostname, port] = match;
  const apiHost = api.hostname.toLowerCase();
  if (!LOOPBACK.has(hostname) || !LOOPBACK.has(apiHost) || hostname === apiHost) return null;
  return `${api.protocol}//${apiHost}${port ? `:${port}` : ""}${pathAndQuery}`;
}

export function proxy(request: NextRequest) {
  // Faqat development (lokal dev/QA steklari): `next start` Location'ni 127.0.0.1↔localhost uchun baribir nisbiy
  // qiladi — production rejimida yo'naltirish halqaga aylanmasligi uchun o'chiq.
  // Host sarlavhasi ishlatiladi: NextURL 127.0.0.1 ni «localhost» ga normallashtiradi.
  const target = process.env.NODE_ENV !== "production" && loopbackRedirectTarget(
    request.headers.get("host"),
    process.env.NEXT_PUBLIC_API_URL,
    request.nextUrl.pathname + request.nextUrl.search,
  );
  // NextResponse.redirect emas: Next 127.0.0.1 va localhost'ni bir xil origin deb, Location'ni nisbiy («/login»)
  // qilib qo'yadi — localhost'da cheksiz yo'naltirish bo'lardi. Location qo'lda, to'liq manzil bilan.
  if (target) return new NextResponse(null, { status: 307, headers: { Location: target } });

  // BILLING_ENABLED=false: billing sahifalari render boshlanishidan oldin haqiqiy 404 (HTTP status) qaytaradi.
  // (Layout'dagi notFound() — BillingGate — oqimli javobda 200 bilan «yumshoq 404» beradi; u ikkinchi himoya.)
  // Mavjud bo'lmagan ichki yo'lga rewrite → Next.js standart 404 sahifasi va 404 status.
  if (!BILLING_ENABLED && BILLING_PATH.test(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/_kiddo/bolim-ochirilgan", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Faqat sahifalar: Next ichki resurslari va fayllar (rasm, favicon, manifest) proxy'dan o'tmaydi
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
