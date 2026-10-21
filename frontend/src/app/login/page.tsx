"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types";
import uz from "@/i18n/uz";

const ROLE_ROUTES: Record<Role, string> = {
  super_admin: "/admin",
  admin:       "/bogcha",
  teacher:     "/tarbiyachi",
  parent:      "/ota-ona",
};

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

const benefits = [
  { label: uz.login.benefit_1 },
  { label: uz.login.benefit_2 },
  { label: uz.login.benefit_3 },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [phone, setPhone]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(phone, password);
      router.push(ROLE_ROUTES[user.role] ?? "/");
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (process.env.NODE_ENV === "development") {
        console.error("[LOGIN]", status ?? "network error", err);
      }
      if      (status === 401 || status === 422) setError(uz.auth.xato_kirish);
      else if (status === 500)                  setError(uz.auth.server_xatosi);
      else                                      setError(uz.auth.tarmoq_xatosi);
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border border-[#EDE3E8] bg-white px-4 py-3 text-sm text-[#29232A] " +
    "placeholder:text-[#B8AAB2] outline-none transition-all duration-150 kiddo-input " +
    "focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15";

  return (
    <div className="min-h-screen flex bg-[#FFF9F5]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] bg-[#8E315D] relative overflow-hidden flex-shrink-0 p-12">
        {/* Dot grid decoration */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Blurred accent blobs */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95 5.66l-.707-.707M6.757 6.757l-.707-.707m12.02 0l-.707.707M6.757 17.243l-.707.707" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">KIDDO</span>
          </div>

          {/* Tagline */}
          <h1 className="text-3xl font-bold text-white leading-snug mb-3">
            {uz.login.tagline}
          </h1>
          <p className="text-[#F4C7D7] text-sm leading-relaxed mb-10">
            Bolalar, guruhlar, tarbiyachilar va ota-onalarni bitta platformada boshqaring.
          </p>

          {/* Benefits */}
          <div className="space-y-4">
            {benefits.map(({ label }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white/90 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom version tag */}
        <p className="relative text-xs text-white/30">KIDDO v1.0</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="h-9 w-9 rounded-xl bg-[#8E315D] flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m14.95 5.66l-.707-.707M6.757 6.757l-.707-.707m12.02 0l-.707.707M6.757 17.243l-.707.707" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-[#29232A] tracking-tight">KIDDO</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#29232A]">{uz.auth.xush_kelibsiz}</h2>
            <p className="text-[#766B73] mt-1.5 text-sm">{uz.auth.xush_kelibsiz_tavsif}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.auth.telefon}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998901234567"
                required
                autoComplete="username"
                className={inputBase}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
                {uz.auth.parol}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={inputBase + " pr-11"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? uz.auth.parolni_yashirish : uz.auth.parolni_korsatish}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[#B8AAB2] hover:text-[#3D3240] transition-colors"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm px-4 py-3 rounded-xl">
                <svg className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#8E315D] hover:bg-[#742548] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {loading ? uz.common.yuklanmoqda : uz.auth.kirish_btn}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
