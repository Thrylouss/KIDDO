"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import type { ApiResponse, Group } from "@/types";
import uz from "@/i18n/uz";

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

function GroupCard({ group }: { group: Group }) {
  const count    = group.children_count ?? 0;
  const capacity = group.capacity;
  const pct      = capacity ? Math.min(100, Math.round((count / capacity) * 100)) : null;
  const barColor =
    pct === null ? "bg-[#2563EB]" :
    pct >= 100   ? "bg-[#EF4444]" :
    pct >= 80    ? "bg-[#F59E0B]" :
                   "bg-[#22C55E]";

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-sm transition-shadow duration-200 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] flex-shrink-0">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">{group.name}</p>
            {group.age_category ? (
              <p className="text-xs text-[#9CA3AF] mt-0.5">{group.age_category}</p>
            ) : (
              <p className="text-xs text-[#D1D5DB] mt-0.5">— yosh oralig'i ko'rsatilmagan</p>
            )}
          </div>
        </div>
        <Badge variant={group.is_active ? "success" : "neutral"}>
          {group.is_active ? uz.common.faol : uz.common.nofaol}
        </Badge>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs text-[#6B7280]">
          <span>{uz.guruhlar.bolalar_soni}</span>
          <span className="font-medium text-[#111827]">
            {count}{capacity ? ` / ${capacity}` : ""}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
          {pct !== null ? (
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div
              className="h-full rounded-full bg-[#2563EB]/30"
              style={{ width: count > 0 ? "40%" : "0%" }}
            />
          )}
        </div>
        {pct !== null && (
          <p className="text-xs text-[#9CA3AF] mt-1">{pct}% {uz.guruhlar.sigim_korsatish}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] pt-1 border-t border-[#F3F4F6]">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        {group.teacher_profiles_count ?? 0} {uz.dashboard.tarbiyachi}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#F3F4F6] animate-skeleton flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 bg-[#F3F4F6] rounded animate-skeleton" />
          <div className="h-3 w-1/3 bg-[#F3F4F6] rounded animate-skeleton" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-[#F3F4F6] rounded animate-skeleton" />
        <div className="h-1.5 w-full bg-[#F3F4F6] rounded-full animate-skeleton" />
      </div>
    </div>
  );
}

export default function GuruhlarPage() {
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState<GroupForm>(emptyForm);
  const [saving,    setSaving]    = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

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

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
    setFormErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setSaving(true);
    try {
      await api.post("/v1/admin/groups", {
        name:         form.name,
        age_category: form.age_category || null,
        capacity:     form.capacity ? parseInt(form.capacity) : null,
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
        title={uz.guruhlar.sarlavha}
        description="Bog'chadagi barcha guruhlar"
        action={
          <Button onClick={() => setShowModal(true)} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.guruhlar.qoshish}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB]">
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={groupIcon} />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB]">
          <EmptyState
            icon={groupIcon}
            title={uz.guruhlar.bosh_sarlavha}
            description={uz.guruhlar.bosh_tavsif}
            action={{ label: `+ ${uz.guruhlar.qoshish}`, onClick: () => setShowModal(true) }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={uz.guruhlar.qoshish}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="group-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="group-form" onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      </Modal>
    </div>
  );
}
