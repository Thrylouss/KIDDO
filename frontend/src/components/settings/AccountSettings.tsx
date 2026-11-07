"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { roleLabel } from "@/lib/roles";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import type { User } from "@/types";
import uz from "@/i18n/uz";

const t = uz.sozlamalar;

/** Har bir rol uchun «Sozlamalar»: hisob ma'lumotlari va o'z parolini almashtirish (PUT /v1/me/password). */
export default function AccountSettings({ children }: { children?: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [current, setCurrent]   = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string[]>>({});
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({}); setError(""); setSuccess("");
    if (password.length < 8)  { setErrors({ password: [uz.parol_almashtirish.qisqa] }); return; }
    if (password !== confirm) { setErrors({ password_confirmation: [uz.parol_almashtirish.mos_emas] }); return; }
    setSaving(true);
    try {
      const res = await api.put<{ user: User }>("/v1/me/password", { current_password: current, password, password_confirmation: confirm });
      if (res?.user) updateUser(res.user);
      setCurrent(""); setPassword(""); setConfirm("");
      setSuccess(t.saqlandi);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string | null | undefined][] = [
    [t.ism, user?.name], [t.login, user?.username ?? user?.phone], [t.rol, roleLabel(user?.role)], [t.telefon, user?.phone],
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title={t.sarlavha} description={t.tavsif} />

      <section className="bg-white rounded-xl border border-[#EDE3E8]">
        <h2 className="px-5 py-4 border-b border-[#EDE3E8] text-sm font-semibold text-[#29232A]">{t.hisob}</h2>
        <dl className="divide-y divide-[#F2ECF0]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3 text-sm">
              <dt className="sm:w-40 text-[#766B73]">{label}</dt>
              <dd className="text-[#29232A] font-medium break-all">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {children}

      <section className="bg-white rounded-xl border border-[#EDE3E8]">
        <div className="px-5 py-4 border-b border-[#EDE3E8]">
          <h2 className="text-sm font-semibold text-[#29232A]">{t.xavfsizlik}</h2>
          <p className="text-xs text-[#766B73] mt-0.5">{t.xavfsizlik_izoh}</p>
        </div>
        <form method="post" onSubmit={submit} className="p-5 grid gap-4 sm:max-w-md" noValidate>
          <Input id="settings-current" label={t.joriy_parol} type="password" autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current_password?.[0]} required />
          <Input id="settings-new" label={uz.parol_almashtirish.yangi} type="password" autoComplete="new-password" hint={uz.parol_almashtirish.yangi_izoh}
            value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password?.[0]} required />
          <Input id="settings-confirm" label={uz.parol_almashtirish.takror} type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.password_confirmation?.[0]} required />
          {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}
          {success && <p role="status" className="rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-3 py-2">{success}</p>}
          <div><Button type="submit" loading={saving} disabled={!current || !password || !confirm}>{uz.parol_almashtirish.saqlash}</Button></div>
        </form>
      </section>
    </div>
  );
}
