"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import ConfirmDialog from "@/components/ConfirmDialog";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import ChildParentsModal from "@/components/ChildParentsModal";
import type { ApiResponse, Child, Group } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface ChildForm {
  first_name: string;
  last_name:  string;
  birth_date: string;
  gender:     "erkak" | "ayol" | "";
  group_id:   string;
  is_active:  boolean;
}

const emptyForm: ChildForm = { first_name: "", last_name: "", birth_date: "", gender: "", group_id: "", is_active: true };

const childrenIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function BolalarPage() {
  const readOnly = useReadOnly();
  const [children, setChildren] = useState<Child[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState<ChildForm>(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [formErrors,  setFormErrors]  = useState<Record<string, string[]>>({});
  const [search,      setSearch]      = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [parentsChild, setParentsChild] = useState<Child | null>(null);
  const [formError,    setFormError]    = useState("");
  const [editing,      setEditing]      = useState<Child | null>(null);
  const [deleting,     setDeleting]     = useState<Child | null>(null);
  const [success,      setSuccess]      = useState("");

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const [childRes, groupRes] = await Promise.all([
        api.get<ApiResponse<Child[]>>("/v1/admin/children"),
        api.get<ApiResponse<Group[]>>("/v1/admin/groups"),
      ]);
      setChildren(childRes.data);
      setGroups(groupRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = children;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q)
      );
    }
    if (filterGroup) {
      list = list.filter(c => String(c.group_id) === filterGroup);
    }
    return list;
  }, [children, search, filterGroup]);

  function openCreate() {
    setSuccess("");
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(c: Child) {
    setSuccess("");
    setEditing(c);
    setForm({
      first_name: c.first_name,
      last_name:  c.last_name,
      birth_date: c.birth_date,
      gender:     c.gender,
      group_id:   c.group_id ? String(c.group_id) : "",
      is_active:  c.is_active,
    });
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
    const body = {
      first_name: form.first_name,
      last_name:  form.last_name,
      birth_date: form.birth_date,
      gender:     form.gender,
      group_id:   form.group_id ? parseInt(form.group_id) : null,
    };
    try {
      if (editing) {
        if (IS_DEMO) return;
        await api.put(`/v1/admin/children/${editing.id}`, { ...body, is_active: form.is_active });
        setSuccess(uz.bolalar.yangilandi);
      } else {
        await api.post("/v1/admin/children", body);
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

  async function confirmDelete() {
    if (!deleting) return;
    await api.delete(`/v1/admin/children/${deleting.id}`);
    setDeleting(null);
    setSuccess(uz.bolalar.ochirildi);
    await load();
  }

  const hasFilter = search || filterGroup;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.bolalar.sarlavha}
        description={uz.bolalar.sahifa_tavsif}
        action={readOnly ? undefined :
          <Button onClick={openCreate} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.bolalar.qoshish}
          </Button>
        }
      />

      {success && (
        <p role="status" className="mb-4 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{success}</p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input
            placeholder={uz.bolalar.qidirish}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            suffix={
              <svg className="h-4 w-4 text-[#B8AAB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </div>
        <div className="w-full sm:w-52">
          <Select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="">{uz.bolalar.hammasi}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : error ? (
          <EmptyState
            title={uz.common.yuklash_xatosi}
            action={{ label: uz.common.qayta_urinish, onClick: load }}
            icon={childrenIcon}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={childrenIcon}
            title={hasFilter ? uz.bolalar.natija_yoq : uz.bolalar.bosh_sarlavha}
            description={hasFilter ? uz.bolalar.natija_yoq_tavsif : uz.bolalar.bosh_tavsif}
            action={!hasFilter && !readOnly ? { label: `+ ${uz.bolalar.qoshish}`, onClick: openCreate } : undefined}
          />
        ) : (
          <>
            {/* Mobile card list (< sm) */}
            <ul className="sm:hidden divide-y divide-[#F2ECF0]">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
                  <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-[#29232A] truncate">
                        {c.last_name} {c.first_name}
                      </p>
                      <Badge variant={c.is_active ? "success" : "neutral"}>
                        {c.is_active ? uz.common.faol : uz.common.nofaol}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#B8AAB2] mt-0.5">
                      {c.birth_date} · {c.gender === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz}
                    </p>
                    {c.group?.name ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#766B73] mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                        {c.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#D9C9D1]">{uz.bolalar.guruhsiz}</span>
                    )}
                    {/* Amallar alohida qatorda — tor ekranda ism ustunini siqmasin */}
                    <div className="flex flex-wrap gap-1 mt-2 -ml-2">
                      <Button size="sm" variant="ghost" onClick={() => setParentsChild(c)}>
                        {uz.bolalar.ota_onalar_btn}
                      </Button>
                      {!readOnly && <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>{uz.common.tahrirlash}</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setDeleting(c); }}>{uz.common.ochirish}</Button>
                      </>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table (sm+) */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">Bola</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden md:table-cell">{uz.bolalar.tug_sanasi}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">{uz.bolalar.jinsi}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.bolalar.guruh}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.bolalar.holat}</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF0]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF5F8] transition-colors duration-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                        <p className="font-medium text-[#29232A]">{c.last_name} {c.first_name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#766B73] hidden md:table-cell">{c.birth_date}</td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <Badge variant={c.gender === "erkak" ? "info" : "neutral"}>
                        {c.gender === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-[#766B73]">
                      {c.group?.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                          {c.group.name}
                        </span>
                      ) : (
                        <span className="text-[#D9C9D1]">{uz.bolalar.guruhsiz}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={c.is_active ? "success" : "neutral"}>
                        {c.is_active ? uz.common.faol : uz.common.nofaol}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setParentsChild(c)}>
                          {uz.bolalar.ota_onalar_btn}
                        </Button>
                        {!readOnly && <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>{uz.common.tahrirlash}</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setDeleting(c); }}>{uz.common.ochirish}</Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Add modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? uz.bolalar.tahrirlash : uz.bolalar.qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="child-form" type="submit" loading={saving} disabled={!!editing && IS_DEMO}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="child-form" onSubmit={handleSubmit} className="space-y-5">
          {editing && IS_DEMO && (
            <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
          )}
          <div>
            <p className="text-xs font-semibold text-[#B8AAB2] uppercase tracking-wide mb-3">{uz.bolalar.bolaning_malumotlari}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={uz.bolalar.ismi}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                error={formErrors.first_name?.[0]}
                required
              />
              <Input
                label={uz.bolalar.familiyasi}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                error={formErrors.last_name?.[0]}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={uz.bolalar.tug_sanasi}
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              max={new Date().toISOString().split("T")[0]}
              error={formErrors.birth_date?.[0]}
              required
            />
            <Select
              label={uz.bolalar.jinsi}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as "erkak" | "ayol" })}
              error={formErrors.gender?.[0]}
              required
            >
              <option value="">{uz.common.tanlang}</option>
              <option value="erkak">{uz.bolalar.jins_erkak}</option>
              <option value="ayol">{uz.bolalar.jins_qiz}</option>
            </Select>
          </div>

          <div className="pt-1 border-t border-[#EDE3E8]">
            <p className="text-xs font-semibold text-[#B8AAB2] uppercase tracking-wide mb-3 mt-3">{uz.bolalar.bogcha_malumotlari}</p>
            <Select
              label={uz.bolalar.guruh}
              value={form.group_id}
              onChange={(e) => setForm({ ...form, group_id: e.target.value })}
            >
              <option value="">{uz.bolalar.guruhsiz}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
            {editing && (
              <div className="mt-3">
                <Select
                  label={uz.bolalar.holat}
                  value={form.is_active ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
                >
                  <option value="1">{uz.common.faol}</option>
                  <option value="0">{uz.common.nofaol}</option>
                </Select>
              </div>
            )}
          </div>
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`${uz.bolalar.ochirish}: ${deleting ? `${deleting.last_name} ${deleting.first_name}` : ""}`}
        message={`${uz.bolalar.ochirish_tasdiqi} ${uz.bolalar.ochirish_izoh}`}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />

      <ChildParentsModal child={parentsChild} onClose={() => setParentsChild(null)} />
    </div>
  );
}
