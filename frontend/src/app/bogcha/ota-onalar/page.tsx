"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors, RELATION_LABELS } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import ConfirmDialog from "@/components/ConfirmDialog";
import TemporaryPasswordModal from "@/components/accounts/TemporaryPasswordModal";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { ApiResponse, Child, ParentProfile, ParentRelation } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface ParentForm {
  first_name:    string;
  last_name:     string;
  /** Login (mobil ilova uchun) — faqat yaratishda; parolni tizim yaratadi */
  username:      string;
  phone:         string;
  relation_type: ParentRelation | "";
  /** Yaratishda darhol biriktiriladigan farzand (shu bog'chadan) */
  child_id:      string;
}

const emptyForm: ParentForm = { first_name: "", last_name: "", username: "", phone: "", relation_type: "", child_id: "" };

interface CreatedAccount { username?: string; phone?: string; temporary_password?: string }

const parentIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

/** Akkaunt faolligi users.is_active dan; eski javoblarda user bo'lmasa faol deb hisoblanadi. */
function isActive(p: ParentProfile): boolean {
  return p.user?.is_active ?? true;
}

export default function OtaOnalarPage() {
  const readOnly = useReadOnly();
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState<ParentForm>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [formError,  setFormError]  = useState("");
  const [success,    setSuccess]    = useState("");
  const [editing,    setEditing]    = useState<ParentProfile | null>(null);
  const [toggling,   setToggling]   = useState<ParentProfile | null>(null);
  const [resetting,  setResetting]  = useState<ParentProfile | null>(null);
  const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null);
  const [children,   setChildren]   = useState<Pick<Child, "id" | "first_name" | "last_name">[]>([]);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ParentProfile[]>>("/v1/admin/parents");
      setParents(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    setSuccess("");
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
    // Farzandni tanlash uchun — faqat shu bog'cha bolalari (backend ham tekshiradi)
    api.get<ApiResponse<Child[]>>("/v1/admin/children").then((r) => setChildren(r?.data ?? [])).catch(() => setChildren([]));
  }

  function openEdit(p: ParentProfile) {
    setSuccess("");
    setEditing(p);
    setForm({ first_name: p.first_name, last_name: p.last_name, username: p.user?.username ?? "", phone: p.phone ?? "", relation_type: p.relation_type, child_id: "" });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || IS_DEMO) return;
    setFormErrors({});
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        // Parol bu yerda o'zgarmaydi — alohida «Parolni tiklash» amali orqali
        await api.put(`/v1/admin/parents/${editing.id}`, {
          first_name:    form.first_name,
          last_name:     form.last_name,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          relation_type: form.relation_type,
        });
      } else {
        // Parol yuborilmaydi — tizim vaqtinchalik parol yaratadi va u faqat bir marta ko'rsatiladi
        const res = await api.post<{ account?: CreatedAccount }>("/v1/admin/parents", {
          first_name:    form.first_name,
          last_name:     form.last_name,
          username:      form.username.trim() || null,
          phone:         form.phone.trim() || null,
          relation_type: form.relation_type,
          child_id:      form.child_id ? Number(form.child_id) : null,
        });
        if (res?.account?.temporary_password) {
          setCredentials({ login: res.account.username ?? res.account.phone ?? "", password: res.account.temporary_password });
        }
      }
      closeModal();
      setSuccess(editing ? uz.ota_onalar.yangilandi : uz.ota_onalar.qoshildi);
      await load();
    } catch (err: unknown) {
      setFormErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmReset() {
    if (!resetting) return;
    const res = await api.post<{ data?: { temporary_password?: string } }>(`/v1/admin/parents/${resetting.id}/reset-password`, {});
    if (res?.data?.temporary_password) {
      setCredentials({ login: resetting.user?.username ?? resetting.phone ?? "", password: res.data.temporary_password });
    }
    setSuccess(uz.common.parol_yangilandi);
    setResetting(null);
    await load();
  }

  async function confirmToggle() {
    if (!toggling) return;
    const active = isActive(toggling);
    await api.patch(`/v1/admin/parents/${toggling.id}/${active ? "deactivate" : "activate"}`);
    setSuccess(active ? uz.ota_onalar.faolsizlantirildi : uz.ota_onalar.faollashtirildi);
    setToggling(null);
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.ota_onalar.sarlavha}
        description={uz.ota_onalar.sahifa_tavsif}
        action={readOnly ? undefined :
          <Button onClick={openModal} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.ota_onalar.qoshish}
          </Button>
        }
      />

      {success && (
        <p role="status" className="mb-4 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{success}</p>
      )}

      {/* Tor ekranda jadval karta ichida gorizontal aylanadi — amal tugmalari kesilmasin */}
      <div className="relative bg-white rounded-xl border border-[#EDE3E8] overflow-x-auto">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : error ? (
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={parentIcon} />
        ) : parents.length === 0 ? (
          <EmptyState
            icon={parentIcon}
            title={uz.ota_onalar.bosh_sarlavha}
            description={uz.ota_onalar.bosh_tavsif}
            action={readOnly ? undefined : { label: `+ ${uz.ota_onalar.qoshish}`, onClick: openModal }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">Ota-ona</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{uz.ota_onalar.telefon}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden md:table-cell">{uz.ota_onalar.qarindoshlik}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.ota_onalar.bola}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.ota_onalar.holat}</th>
                <th className="px-5 py-3.5"><span className="sr-only">{uz.common.amallar}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF0]">
              {parents.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF5F8] transition-colors duration-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                      <div>
                        <p className="font-medium text-[#29232A]">{p.last_name} {p.first_name}</p>
                        {p.user?.username && <p className="text-xs text-[#766B73]">{uz.ota_onalar.login}: <span className="font-mono">{p.user.username}</span></p>}
                        {p.user?.must_change_password && <p className="text-xs text-[#92400E]">{uz.akkaunt.almashtirilmagan}</p>}
                        <p className="text-xs text-[#B8AAB2] sm:hidden">{p.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#766B73] hidden sm:table-cell">{p.phone ?? <span className="text-[#D9C9D1]">—</span>}</td>
                  <td className="px-5 py-4 text-[#766B73] hidden md:table-cell">{RELATION_LABELS[p.relation_type] ?? p.relation_type}</td>
                  <td className="px-5 py-4">
                    {p.children && p.children.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.children.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-[#F2ECF0] text-[#3D3240] px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B8AAB2]" />
                            {c.last_name} {c.first_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#D9C9D1]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={isActive(p) ? "success" : "neutral"}>
                      {isActive(p) ? uz.common.faol : uz.common.nofaol}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {!readOnly && <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>{uz.common.tahrirlash}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setResetting(p); }}>
                        {uz.common.parolni_tiklash}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setToggling(p); }}>
                        {isActive(p) ? uz.common.faolsizlantirish : uz.common.faollashtirish}
                      </Button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? uz.ota_onalar.tahrirlash : uz.ota_onalar.qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="parent-form" type="submit" loading={saving} disabled={IS_DEMO}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="parent-form" onSubmit={handleSubmit} className="space-y-4">
          {IS_DEMO && (
            <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={uz.ota_onalar.ismi}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              error={formErrors.first_name?.[0]}
              maxLength={100}
              required
            />
            <Input
              label={uz.ota_onalar.familiyasi}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              error={formErrors.last_name?.[0]}
              maxLength={100}
              required
            />
          </div>
          {!editing && (
            <Input
              id="parent-username"
              label={uz.ota_onalar.login}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              hint={uz.ota_onalar.login_izoh}
              error={formErrors.username?.[0]}
              autoCapitalize="none"
              maxLength={32}
            />
          )}
          <Input
            id="parent-phone"
            label={`${uz.ota_onalar.telefon} (${uz.tarbiyachilar.ixtiyoriy})`}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+998XXXXXXXXX"
            error={formErrors.phone?.[0]}
            hint={editing ? uz.ota_onalar.telefon_izoh : undefined}
            maxLength={20}
          />
          <Select
            label={uz.ota_onalar.qarindoshlik}
            value={form.relation_type}
            onChange={(e) => setForm({ ...form, relation_type: e.target.value as ParentRelation | "" })}
            error={formErrors.relation_type?.[0]}
            required
          >
            <option value="">{uz.common.tanlang}</option>
            {(Object.keys(RELATION_LABELS) as ParentRelation[]).map((r) => (
              <option key={r} value={r}>{RELATION_LABELS[r]}</option>
            ))}
          </Select>
          {!editing && (
            <Select
              id="parent-child"
              label={`${uz.ota_onalar.bola} (${uz.tarbiyachilar.ixtiyoriy})`}
              value={form.child_id}
              onChange={(e) => setForm({ ...form, child_id: e.target.value })}
              error={formErrors.child_id?.[0]}
            >
              <option value="">{uz.common.tanlang}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
              ))}
            </Select>
          )}
          {!editing && <p className="text-xs text-[#766B73]">{uz.ota_onalar.parol_tizim}</p>}
          {formError && (
            <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={`${toggling && isActive(toggling) ? uz.common.faolsizlantirish : uz.common.faollashtirish}: ${toggling ? `${toggling.last_name} ${toggling.first_name}` : ""}`}
        message={toggling && isActive(toggling) ? uz.ota_onalar.faolsizlantirish_tasdiq : uz.ota_onalar.faollashtirish_tasdiq}
        confirmLabel={toggling && isActive(toggling) ? uz.common.faolsizlantirish : uz.common.faollashtirish}
        danger={!!toggling && isActive(toggling)}
        onConfirm={confirmToggle}
        onClose={() => setToggling(null)}
      />

      <ConfirmDialog
        open={!!resetting}
        title={`${uz.common.parolni_tiklash}: ${resetting ? `${resetting.last_name} ${resetting.first_name}` : ""}`}
        message={uz.akkaunt.parol_yangilash_tasdiq}
        confirmLabel={uz.akkaunt.parol_yangilash}
        onConfirm={confirmReset}
        onClose={() => setResetting(null)}
      />

      <TemporaryPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
