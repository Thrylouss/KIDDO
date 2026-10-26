"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { IS_DEMO, setDemoRole } from "@/lib/demo-data";
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

  async function handleDemoLogin(role: "admin" | "super_admin" | "teacher") {
    setDemoRole(role);
    setError("");
    setLoading(true);
    try {
      const user = await login("", "");
      router.push(ROLE_ROUTES[user.role] ?? "/");
    } finally {
      setLoading(false);
    }
  }

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

          {/* Demo mode notice + quick-login */}
          {IS_DEMO && (
            <div className="mb-6 rounded-xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="h-4 w-4 text-[#D97706] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-sm font-semibold text-[#92400E]">DEMO REJIMI</p>
              </div>
              <p className="text-xs text-[#B45309] mb-3">
                Bu namoyish versiyasi. Haqiqiy ma&apos;lumotlar ishlatilmaydi.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {/* Bog'cha egasi — amber */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin("admin")}
                  disabled={loading}
                  className="h-10 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-1 text-[10px] px-2"
                >
                  {loading ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                  )}
                  <span>Bog&apos;cha egasi</span>
                </button>

                {/* Tarbiyachi — green */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin("teacher")}
                  disabled={loading}
                  className="h-10 bg-[#059669] hover:bg-[#047857] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-1 text-[10px] px-2"
                >
                  {loading ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                  )}
                  <span>Tarbiyachi</span>
                </button>

                {/* Super Admin — primary */}
                <button
                  type="button"
                  onClick={() => handleDemoLogin("super_admin")}
                  disabled={loading}
                  className="h-10 bg-[#8E315D] hover:bg-[#742548] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-1 text-[10px] px-2"
                >
                  {loading ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  )}
                  <span>Super Admin</span>
                </button>
              </div>
            </div>
          )}

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
