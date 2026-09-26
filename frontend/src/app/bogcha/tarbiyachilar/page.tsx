"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { ApiResponse, TeacherProfile } from "@/types";
import uz from "@/i18n/uz";

interface TeacherForm {
  first_name: string;
  last_name:  string;
  phone:      string;
  password:   string;
  position:   string;
}

const emptyForm: TeacherForm = { first_name: "", last_name: "", phone: "", password: "", position: "" };

const teacherIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export default function TarbiyachilarPage() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [showModal,  setShowModal]  = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [form,       setForm]       = useState<TeacherForm>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

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

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
    setFormErrors({});
    setShowPw(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setSaving(true);
    try {
      await api.post("/v1/admin/teachers", {
        first_name: form.first_name,
        last_name:  form.last_name,
        phone:      form.phone,
        password:   form.password,
        position:   form.position || null,
      });
      closeModal();
      await load();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setFormErrors(e.data.errors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.tarbiyachilar.sarlavha}
        description={uz.tarbiyachilar.sahifa_tavsif}
        action={
          <Button onClick={() => setShowModal(true)} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.tarbiyachilar.qoshish}
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : error ? (
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={teacherIcon} />
        ) : teachers.length === 0 ? (
          <EmptyState
            icon={teacherIcon}
            title={uz.tarbiyachilar.bosh_sarlavha}
            description={uz.tarbiyachilar.bosh_tavsif}
            action={{ label: `+ ${uz.tarbiyachilar.qoshish}`, onClick: () => setShowModal(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Tarbiyachi</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden sm:table-cell">{uz.tarbiyachilar.telefon}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden md:table-cell">{uz.tarbiyachilar.lavozim}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden lg:table-cell">{uz.tarbiyachilar.guruh}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.tarbiyachilar.holat}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-[#F9FAFB] transition-colors duration-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${t.first_name} ${t.last_name}`} size="sm" />
                      <div>
                        <p className="font-medium text-[#111827]">{t.last_name} {t.first_name}</p>
                        <p className="text-xs text-[#9CA3AF] sm:hidden">{t.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#6B7280] hidden sm:table-cell">{t.phone}</td>
                  <td className="px-5 py-4 text-[#6B7280] hidden md:table-cell">{t.position}</td>
                  <td className="px-5 py-4 text-[#6B7280] hidden lg:table-cell">
                    {t.groups && t.groups.length > 0
                      ? t.groups.map(g => g.name).join(", ")
                      : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={t.is_active ? "success" : "neutral"}>
                      {t.is_active ? uz.common.faol : uz.common.nofaol}
                    </Badge>
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
        title={uz.tarbiyachilar.qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="teacher-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={handleSubmit} className="space-y-4">
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
          <Input
            label={uz.tarbiyachilar.telefon}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+998901234567"
            error={formErrors.phone?.[0]}
            required
          />
          <Input
            label={uz.tarbiyachilar.parol}
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={formErrors.password?.[0]}
            required
            minLength={6}
            suffix={
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                {showPw ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            }
          />
          <Input
            label={`${uz.tarbiyachilar.lavozim} (ixtiyoriy)`}
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            placeholder="Tarbiyachi"
          />
        </form>
      </Modal>
    </div>
  );
}
