"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import TemporaryPasswordModal from "@/components/accounts/TemporaryPasswordModal";
import uz from "@/i18n/uz";
import type { OrganizationDetail } from "@/types";

const t = uz.akkaunt;

interface AdminAccountCardProps {
  org: OrganizationDetail;
  onChanged: () => void;
}

/** Super Admin: bog'cha rahbari akkaunti — username + tizim yaratgan bir martalik vaqtinchalik parol. */
export default function AdminAccountCard({ org, onChanged }: AdminAccountCardProps) {
  const [username, setUsername]   = useState(org.number ? `dmtt${org.number.toLowerCase()}` : "");
  const [name, setName]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string[]>>({});
  const [error, setError]         = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [credentials, setCredentials]   = useState<{ login: string; password: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError("");
    try {
      const res = await api.post<{ data: { username: string; temporary_password: string } }>(
        `/v1/super-admin/organizations/${org.id}/admin-account`,
        { username: username.trim(), name: name.trim() || null },
      );
      setCredentials({ login: res.data.username, password: res.data.temporary_password });
      onChanged();
    } catch (err) {
      const d = (err as { data?: { errors?: Record<string, string[]> } }).data;
      if (d?.errors) setErrors(d.errors);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError("");
    try {
      const res = await api.post<{ data: { username?: string; temporary_password?: string } }>(
        `/v1/super-admin/organizations/${org.id}/reset-password`, {},
      );
      const admin = org.admins[0];
      if (res.data.temporary_password) {
        setCredentials({ login: res.data.username ?? admin?.username ?? admin?.phone ?? "", password: res.data.temporary_password });
      }
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8]">
      <div className="px-5 py-4 border-b border-[#EDE3E8]">
        <h2 className="text-sm font-semibold text-[#29232A]">{t.rahbar_akkaunti}</h2>
      </div>
      <div className="p-5 space-y-3">
        {error && <p role="alert" className="text-sm text-[#B91C1C]">{error}</p>}

        {org.admins.length === 0 ? (
          <form onSubmit={create} className="space-y-3" noValidate>
            <p className="text-sm text-[#B8AAB2]">{t.rahbar_yoq}</p>
            <Input id="admin-username" label={t.login} value={username} required maxLength={32} autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)} hint={t.login_izoh} error={errors.username?.[0]} />
            <Input id="admin-name" label={t.ism} value={name} maxLength={255} placeholder={org.director_name ?? ""}
              onChange={(e) => setName(e.target.value)} hint={t.ism_izoh} error={errors.name?.[0]} />
            <Button type="submit" size="sm" loading={saving} disabled={!username.trim()} fullWidth>{t.yaratish}</Button>
          </form>
        ) : (
          <>
            <ul className="space-y-3">
              {org.admins.map((admin) => (
                <li key={admin.id} data-testid={`admin-${admin.id}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-sm font-medium text-[#29232A] truncate">{admin.name}</p>
                    <Badge variant={admin.is_active ? "success" : "neutral"}>{admin.is_active ? uz.common.faol : uz.common.nofaol}</Badge>
                  </div>
                  <p className="text-xs text-[#766B73]">
                    {t.login}: <span className="font-mono text-[#29232A]">{admin.username ?? admin.phone ?? admin.email ?? "—"}</span>
                  </p>
                  {admin.must_change_password && <p className="text-xs text-[#92400E]">{t.almashtirilmagan}</p>}
                  <p className="text-xs text-[#B8AAB2]">
                    {t.oxirgi_kirish}: {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString("uz-UZ") : t.hech_kirmagan}
                  </p>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" fullWidth disabled={saving} onClick={() => setConfirmReset(true)}>{t.parol_yangilash}</Button>
          </>
        )}
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t.parol_yangilash}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>{uz.common.bekor_qilish}</Button>
            <Button loading={saving} onClick={reset}>{t.parol_yangilash}</Button>
          </>
        }
      >
        <p className="text-sm text-[#29232A]">{t.parol_yangilash_tasdiq}</p>
      </Modal>

      <TemporaryPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
