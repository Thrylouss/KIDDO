"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import ConfirmDialog from "@/components/ConfirmDialog";
import TemporaryPasswordModal from "@/components/accounts/TemporaryPasswordModal";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import TeacherGroupsModal from "@/components/TeacherGroupsModal";
import type { ApiResponse, TeacherProfile } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface TeacherForm {
  first_name: string;
  last_name:  string;
  /** Login (username) — faqat yaratishda; parolni tizim yaratadi */
  username:   string;
  phone:      string;
  position:   string;
}

const emptyForm: TeacherForm = { first_name: "", last_name: "", username: "", phone: "", position: "" };

interface CreatedAccount { username?: string; phone?: string; temporary_password?: string }

const teacherIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export default function TarbiyachilarPage() {
  const readOnly = useReadOnly();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState<TeacherForm>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [formError,  setFormError]  = useState("");
  const [editing,    setEditing]    = useState<TeacherProfile | null>(null);
  const [toggling,   setToggling]   = useState<TeacherProfile | null>(null);
  const [resetting,  setResetting]  = useState<TeacherProfile | null>(null);
  const [credentials, setCredentials] = useState<{ login: string; password: string } | null>(null);

  const [groupsTeacher, setGroupsTeacher] = useState<TeacherProfile | null>(null);
  const [success,       setSuccess]       = useState("");

  async function handleGroupsSaved() {
    setGroupsTeacher(null);
    setSuccess(uz.tarbiyachilar.guruhlar_saqlandi);
    await load();
  }

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<TeacherProfile[]>>("/v1/admin/teachers");
      setTeachers(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setSuccess("");
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(t: TeacherProfile) {
    setSuccess("");
    setEditing(t);
    setForm({ first_name: t.first_name, last_name: t.last_name, username: t.user?.username ?? "", phone: t.phone ?? "", position: t.position ?? "" });
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
    if (saving) return;
    setFormErrors({});
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        if (IS_DEMO) return;
        // Parol bu yerda o'zgarmaydi — alohida «Parolni tiklash» amali orqali
        await api.put(`/v1/admin/teachers/${editing.id}`, {
          first_name: form.first_name,
          last_name:  form.last_name,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          position:   form.position || null,
        });
        setSuccess(uz.tarbiyachilar.yangilandi);
      } else {
        // Parol yuborilmaydi — tizim vaqtinchalik parol yaratadi va u faqat bir marta ko'rsatiladi
        const res = await api.post<{ account?: CreatedAccount }>("/v1/admin/teachers", {
          first_name: form.first_name,
          last_name:  form.last_name,
          username:   form.username.trim() || null,
          phone:      form.phone.trim() || null,
          position:   form.position || null,
        });
        if (res?.account?.temporary_password) {
          setCredentials({ login: res.account.username ?? res.account.phone ?? "", password: res.account.temporary_password });
        }
      }
      closeModal();
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
    const res = await api.post<{ data?: { temporary_password?: string } }>(`/v1/admin/teachers/${resetting.id}/reset-password`, {});
    if (res?.data?.temporary_password) {
      setCredentials({ login: resetting.user?.username ?? resetting.phone ?? "", password: res.data.temporary_password });
    }
    setSuccess(uz.common.parol_yangilandi);
    setResetting(null);
    await load();
  }

  async function confirmToggle() {
    if (!toggling) return;
    const action = toggling.is_active ? "deactivate" : "activate";
    await api.patch(`/v1/admin/teachers/${toggling.id}/${action}`);
    setSuccess(toggling.is_active ? uz.tarbiyachilar.faolsizlantirildi : uz.tarbiyachilar.faollashtirildi);
    setToggling(null);
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.tarbiyachilar.sarlavha}
        description={uz.tarbiyachilar.sahifa_tavsif}
        action={readOnly ? undefined :
          <Button onClick={openCreate} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.tarbiyachilar.qoshish}
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
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={teacherIcon} />
        ) : teachers.length === 0 ? (
          <EmptyState
            icon={teacherIcon}
            title={uz.tarbiyachilar.bosh_sarlavha}
            description={uz.tarbiyachilar.bosh_tavsif}
            action={readOnly ? undefined : { label: `+ ${uz.tarbiyachilar.qoshish}`, onClick: openCreate }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">Tarbiyachi</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{uz.tarbiyachilar.telefon}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden md:table-cell">{uz.tarbiyachilar.lavozim}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">{uz.tarbiyachilar.guruh}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.tarbiyachilar.holat}</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF0]">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-[#FAF5F8] transition-colors duration-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${t.first_name} ${t.last_name}`} size="sm" />
                      <div>
                        <p className="font-medium text-[#29232A]">{t.last_name} {t.first_name}</p>
                        {t.user?.username && <p className="text-xs text-[#766B73]">{uz.tarbiyachilar.login}: <span className="font-mono">{t.user.username}</span></p>}
                        {t.user?.must_change_password && <p className="text-xs text-[#92400E]">{uz.akkaunt.almashtirilmagan}</p>}
                        <p className="text-xs text-[#B8AAB2] sm:hidden">{t.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#766B73] hidden sm:table-cell">{t.phone ?? <span className="text-[#D9C9D1]">—</span>}</td>
                  <td className="px-5 py-4 text-[#766B73] hidden md:table-cell">{t.position}</td>
                  <td className="px-5 py-4 text-[#766B73] hidden lg:table-cell">
                    {t.groups && t.groups.length > 0
                      ? t.groups.map(g => g.name).join(", ")
                      : <span className="text-[#D9C9D1]">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={t.is_active ? "success" : "neutral"}>
                      {t.is_active ? uz.common.faol : uz.common.nofaol}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {!readOnly && <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => { setSuccess(""); setGroupsTeacher(t); }}>
                        {uz.tarbiyachilar.guruhlar_btn}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>{uz.common.tahrirlash}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setResetting(t); }}>
                        {uz.common.parolni_tiklash}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setToggling(t); }}>
                        {t.is_active ? uz.common.faolsizlantirish : uz.common.faollashtirish}
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
        title={editing ? uz.tarbiyachilar.tahrirlash : uz.tarbiyachilar.qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="teacher-form" type="submit" loading={saving} disabled={!!editing && IS_DEMO}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={handleSubmit} className="space-y-4">
          {editing && IS_DEMO && (
            <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={uz.tarbiyachilar.ismi}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              error={formErrors.first_name?.[0]}
              required
            />
            <Input
              label={uz.tarbiyachilar.familiyasi}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              error={formErrors.last_name?.[0]}
              required
            />
          </div>
          {!editing && (
            <Input
              id="teacher-username"
              label={uz.tarbiyachilar.login}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              hint={uz.akkaunt.login_izoh}
              error={formErrors.username?.[0]}
              autoCapitalize="none"
              maxLength={32}
            />
          )}
          <Input
            id="teacher-phone"
            label={`${uz.tarbiyachilar.telefon} (${uz.tarbiyachilar.ixtiyoriy})`}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+998901234567"
            error={formErrors.phone?.[0]}
          />
          {!editing && <p className="text-xs text-[#766B73]">{uz.tarbiyachilar.parol_izoh}</p>}
          <Input
            label={`${uz.tarbiyachilar.lavozim} (${uz.tarbiyachilar.ixtiyoriy})`}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            placeholder="Tarbiyachi"
          />
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toggling}
        title={`${toggling?.is_active ? uz.common.faolsizlantirish : uz.common.faollashtirish}: ${toggling ? `${toggling.last_name} ${toggling.first_name}` : ""}`}
        message={toggling?.is_active ? uz.tarbiyachilar.faolsizlantirish_tasdiq : uz.tarbiyachilar.faollashtirish_tasdiq}
        confirmLabel={toggling?.is_active ? uz.common.faolsizlantirish : uz.common.faollashtirish}
        danger={!!toggling?.is_active}
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

      <TeacherGroupsModal
        teacher={groupsTeacher}
        onClose={() => setGroupsTeacher(null)}
        onSaved={handleGroupsSaved}
      />
    </div>
  );
}
