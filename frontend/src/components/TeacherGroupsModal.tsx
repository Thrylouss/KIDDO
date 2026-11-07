"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { ApiResponse, Group, TeacherProfile } from "@/types";
import uz from "@/i18n/uz";

interface TeacherGroupsModalProps {
  teacher: TeacherProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TeacherGroupsModal({ teacher, onClose, onSaved }: TeacherGroupsModalProps) {
  const [groups,    setGroups]    = useState<Group[]>([]);
  const [selected,  setSelected]  = useState<number[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  // Faqat o'z bog'chasining guruhlari — GET /v1/admin/groups tenant bo'yicha cheklangan
  const load = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Group[]>>("/v1/admin/groups");
      setGroups(res?.data ?? []);
    } catch (err: unknown) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!teacher) return;
    setSelected((teacher.groups ?? []).map((g) => g.id));
    setSaveError("");
    load();
  }, [teacher, load]);

  if (!teacher) return null;

  function toggle(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));
  }

  async function save() {
    if (saving || IS_DEMO || !teacher) return;
    setSaving(true);
    setSaveError("");
    try {
      // Faqat ro'yxatda ko'rsatilgan (o'z bog'chasidagi) guruhlar yuboriladi
      const known = new Set(groups.map((g) => g.id));
      await api.put(`/v1/admin/teachers/${teacher.id}/groups`, {
        group_ids: selected.filter((id) => known.has(id)),
      });
      onSaved();
    } catch (err: unknown) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${uz.tarbiyachilar.guruhlarni_biriktirish}: ${teacher.last_name} ${teacher.first_name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{uz.common.bekor_qilish}</Button>
          <Button onClick={save} loading={saving} disabled={IS_DEMO || loading || !!loadError}>{uz.common.saqlash}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {IS_DEMO && (
          <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-3 py-2">{uz.common.demo_saqlanmaydi}</p>
        )}
        {loading ? (
          <p className="text-sm text-[#766B73]">{uz.common.yuklanmoqda}</p>
        ) : loadError ? (
          <div className="text-sm">
            <p role="alert" className="text-[#B91C1C] mb-2">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={load}>{uz.common.qayta_urinish}</Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-[#766B73]">{uz.tarbiyachilar.guruh_yoq}</p>
        ) : (
          <>
            <p className="text-xs text-[#766B73]">{uz.tarbiyachilar.guruhlar_izoh}</p>
            <ul className="space-y-1.5">
              {groups.map((g) => (
                <li key={g.id}>
                  <label className="flex items-center gap-2 text-sm text-[#29232A]">
                    <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggle(g.id)} />
                    {g.name}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {saveError && <p role="alert" className="text-sm text-[#B91C1C]">{saveError}</p>}
      </div>
    </Modal>
  );
}
