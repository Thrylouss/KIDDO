"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { ROLE_ROUTES } from "@/lib/roles";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { User } from "@/types";
import uz from "@/i18n/uz";

const t = uz.parol_almashtirish;

/** Vaqtinchalik parol bilan kirgan foydalanuvchi o'z parolini o'rnatadi (birinchi kirishda majburiy). */
export default function PasswordChangePage() {
  const { user, loading, updateUser, logout } = useAuth();
  const router = useRouter();

  const [current, setCurrent]   = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string[]>>({});
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError("");
    if (password.length < 8)  { setErrors({ password: [t.qisqa] }); return; }
    if (password !== confirm) { setErrors({ password_confirmation: [t.mos_emas] }); return; }

    setSaving(true);
    try {
      const res = await api.put<{ user: User }>("/v1/me/password", {
        current_password: current, password, password_confirmation: confirm,
      });
      updateUser(res.user);
      router.push(ROLE_ROUTES[res.user.role] ?? "/");
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5] p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#EDE3E8] p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-xl bg-[#8E315D] flex items-center justify-center text-white font-bold">K</div>
          <span className="text-xl font-bold text-[#29232A] tracking-tight">KIDDO</span>
        </div>
        <h1 className="text-xl font-bold text-[#29232A]">{t.sarlavha}</h1>
        <p className="text-sm text-[#766B73] mt-1.5 mb-6">{t.tavsif}</p>

        <form method="post" onSubmit={submit} className="space-y-4" noValidate>
          <Input id="current-password" label={t.joriy} type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current_password?.[0]} />
          <Input id="new-password" label={t.yangi} type="password" autoComplete="new-password" required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} hint={t.yangi_izoh} error={errors.password?.[0]} />
          <Input id="confirm-password" label={t.takror} type="password" autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.password_confirmation?.[0]} />
          {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
          <Button type="submit" loading={saving} fullWidth disabled={!current || !password || !confirm}>{t.saqlash}</Button>
        </form>

        <button type="button" onClick={handleLogout} className="mt-4 w-full text-sm text-[#766B73] hover:text-[#8E315D]">
          {uz.auth.chiqish}
        </button>
      </div>
    </div>
  );
}
