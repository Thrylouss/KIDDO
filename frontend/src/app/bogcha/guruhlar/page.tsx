"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import ConfirmDialog from "@/components/ConfirmDialog";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import type { ApiResponse, Group } from "@/types";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

interface GroupForm {
  name:         string;
  age_category: string;
  capacity:     string;
}

const emptyForm: GroupForm = { name: "", age_category: "", capacity: "" };

const groupIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

interface GroupCardProps {
  group:    Group;
  /** Berilmasa (faqat ko'rish rejimi) — tugma ko'rsatilmaydi */
  onEdit?:   () => void;
  onDelete?: () => void;
}

function GroupCard({ group, onEdit, onDelete }: GroupCardProps) {
  const count    = group.children_count ?? 0;
  const capacity = group.capacity;
  const pct      = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : null;
  const barColor =
    pct === null ? "bg-[#8E315D]" :
    pct >= 100   ? "bg-[#EF4444]" :
    pct >= 80    ? "bg-[#F59E0B]" :
                   "bg-[#22C55E]";

  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] p-5 hover:shadow-sm transition-shadow duration-200 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] flex-shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#29232A]">{group.name}</p>
            {group.age_category ? (
              <p className="text-xs text-[#B8AAB2] mt-0.5">{group.age_category}</p>
            ) : (
              <p className="text-xs text-[#D9C9D1] mt-0.5">{uz.guruhlar.yosh_korsatilmagan}</p>
            )}
          </div>
        </div>
        <Badge variant={group.is_active ? "success" : "neutral"}>
          {group.is_active ? uz.common.faol : uz.common.nofaol}
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs text-[#766B73]">
          <span>{uz.guruhlar.bolalar_soni}</span>
          <span className="font-medium text-[#29232A]">
            {count}{capacity ? ` / ${capacity}` : ""}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#F2ECF0] rounded-full overflow-hidden">
          {pct !== null ? (
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div
              className="h-full rounded-full bg-[#8E315D]/30"
              style={{ width: count > 0 ? "40%" : "0%" }}
            />
          )}
        </div>
        {pct !== null && (
          <p className="text-xs text-[#B8AAB2] mt-1">{pct}% {uz.guruhlar.sigim_korsatish}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-[#B8AAB2] pt-1 border-t border-[#F2ECF0]">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        {group.teacher_profiles_count ?? 0} {uz.dashboard.tarbiyachi}
        {(onEdit || onDelete) && (
          <div className="ml-auto flex gap-1.5">
            {onEdit && <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`${uz.common.tahrirlash}: ${group.name}`}>{uz.common.tahrirlash}</Button>}
            {onDelete && <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`${uz.common.ochirish}: ${group.name}`}>{uz.common.ochirish}</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#F2ECF0] animate-skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 bg-[#F2ECF0] rounded animate-skeleton" />
          <div className="h-3 w-1/3 bg-[#F2ECF0] rounded animate-skeleton" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-[#F2ECF0] rounded animate-skeleton" />
        <div className="h-1.5 w-full bg-[#F2ECF0] rounded-full animate-skeleton" />
      </div>
    </div>
  );
}

export default function GuruhlarPage() {
  const readOnly = useReadOnly();
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState<GroupForm>(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [formError,  setFormError]  = useState("");
  const [editing,    setEditing]    = useState<Group | null>(null);
  const [deleting,   setDeleting]   = useState<Group | null>(null);
  const [success,    setSuccess]    = useState("");

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Group[]>>("/v1/admin/groups");
      setGroups(res.data);
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

  function openEdit(group: Group) {
    setSuccess("");
    setEditing(group);
    setForm({
      name:         group.name,
      age_category: group.age_category ?? "",
      capacity:     group.capacity ? String(group.capacity) : "",
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
      name:         form.name,
      age_category: form.age_category || null,
      capacity:     form.capacity ? parseInt(form.capacity) : null,
    };
    try {
      if (editing) {
        if (IS_DEMO) return;
        await api.put(`/v1/admin/groups/${editing.id}`, body);
        setSuccess(uz.guruhlar.yangilandi);
      } else {
        await api.post("/v1/admin/groups", body);
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
    await api.delete(`/v1/admin/groups/${deleting.id}`);
    setDeleting(null);
    setSuccess(uz.guruhlar.ochirildi);
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.guruhlar.sarlavha}
        description="Bog'chadagi barcha guruhlar"
        action={readOnly ? undefined :
          <Button onClick={openCreate} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.guruhlar.qoshish}
          </Button>
        }
      />

      {success && (
        <p role="status" className="mb-4 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{success}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8]">
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={groupIcon} />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8]">
          <EmptyState
            icon={groupIcon}
            title={uz.guruhlar.bosh_sarlavha}
            description={uz.guruhlar.bosh_tavsif}
            action={readOnly ? undefined : { label: `+ ${uz.guruhlar.qoshish}`, onClick: openCreate }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onEdit={readOnly ? undefined : () => openEdit(g)}
              onDelete={readOnly ? undefined : () => { setSuccess(""); setDeleting(g); }}
            />
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editing ? uz.guruhlar.tahrirlash : uz.guruhlar.qoshish}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="group-form" type="submit" loading={saving} disabled={!!editing && IS_DEMO}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="group-form" onSubmit={handleSubmit} className="space-y-4">
          {editing && IS_DEMO && (
            <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
          )}
          <Input
            label={uz.guruhlar.nomi}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErrors.name?.[0]}
            required
            placeholder="Masalan: Kamalak guruhi"
          />
          <Input
            label={uz.guruhlar.yosh_oralighi}
            value={form.age_category}
            onChange={(e) => setForm({ ...form, age_category: e.target.value })}
            placeholder="Masalan: 3-4 yosh"
          />
          <Input
            label={`${uz.guruhlar.sigim} (ixtiyoriy)`}
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            min={1}
            max={100}
            placeholder="20"
            error={formErrors.capacity?.[0]}
          />
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`${uz.guruhlar.ochirish}: ${deleting?.name ?? ""}`}
        message={`${uz.guruhlar.ochirish_tasdiqi} ${uz.guruhlar.ochirish_izoh}`}
        confirmLabel={uz.common.ochirish}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
