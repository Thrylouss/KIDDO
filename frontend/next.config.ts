import type { NextConfig } from "next";

/**
 * Barcha sahifa va statik fayllar uchun xavfsizlik headerlari (API'da ular Laravel SecureHeadersMiddleware orqali).
 * To'liq CSP ataylab qo'yilmagan: Next.js inline skriptlari uchun nonce kerak bo'ladi — bu yerda faqat
 * xavfsiz direktivalar (iframe, <base>, <object>) cheklangan.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HTTPS orqali ochilgandagina brauzer hisobga oladi; dev (http://127.0.0.1) ga ta'sir qilmaydi
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev stek (docker-compose.dev.yml) 127.0.0.1 da ishlaydi — Next dev resurslari faqat shu env orqali ochiladi.
  // O'rnatilmagan bo'lsa (QA dev server, production) — Next standart sozlamasi.
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
