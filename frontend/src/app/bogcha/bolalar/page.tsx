"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { ApiResponse, Child, Group } from "@/types";
import uz from "@/i18n/uz";

interface ChildForm {
  first_name: string;
  last_name:  string;
  birth_date: string;
  gender:     "erkak" | "ayol" | "";
  group_id:   string;
}

const emptyForm: ChildForm = { first_name: "", last_name: "", birth_date: "", gender: "", group_id: "" };

const childrenIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function BolalarPage() {
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
      await api.post("/v1/admin/children", {
        first_name: form.first_name,
        last_name:  form.last_name,
        birth_date: form.birth_date,
        gender:     form.gender,
        group_id:   form.group_id ? parseInt(form.group_id) : null,
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

  const hasFilter = search || filterGroup;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.bolalar.sarlavha}
        description={uz.bolalar.sahifa_tavsif}
        action={
          <Button onClick={() => setShowModal(true)} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.bolalar.qoshish}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input
            placeholder={uz.bolalar.qidirish}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            suffix={
              <svg className="h-4 w-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
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
            title={hasFilter ? "Natija topilmadi" : uz.bolalar.bosh_sarlavha}
            description={hasFilter ? "Boshqa kalit so'z bilan qidiring" : uz.bolalar.bosh_tavsif}
            action={!hasFilter ? { label: `+ ${uz.bolalar.qoshish}`, onClick: () => setShowModal(true) } : undefined}
          />
        ) : (
          <>
            {/* Mobile card list (< sm) */}
            <ul className="sm:hidden divide-y divide-[#F3F4F6]">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#111827] truncate">
                      {c.last_name} {c.first_name}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {c.birth_date} · {c.gender === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz}
                    </p>
                    {c.group?.name ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#6B7280] mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                        {c.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[#D1D5DB]">{uz.bolalar.guruhsiz}</span>
                    )}
                  </div>
                  <Badge variant={c.is_active ? "success" : "neutral"}>
                    {c.is_active ? uz.common.faol : uz.common.nofaol}
                  </Badge>
                </li>
              ))}
            </ul>

            {/* Desktop table (sm+) */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Bola</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden md:table-cell">{uz.bolalar.tug_sanasi}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide hidden lg:table-cell">{uz.bolalar.jinsi}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.bolalar.guruh}</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.bolalar.holat}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors duration-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                        <p className="font-medium text-[#111827]">{c.last_name} {c.first_name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#6B7280] hidden md:table-cell">{c.birth_date}</td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <Badge variant={c.gender === "erkak" ? "info" : "neutral"}>
                        {c.gender === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-[#6B7280]">
                      {c.group?.name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                          {c.group.name}
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]">{uz.bolalar.guruhsiz}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={c.is_active ? "success" : "neutral"}>
                        {c.is_active ? uz.common.faol : uz.common.nofaol}
                      </Badge>
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
        title={uz.bolalar.qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>{uz.common.bekor_qilish}</Button>
            <Button form="child-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="child-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">{uz.bolalar.bolaning_malumotlari}</p>
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

          <div className="pt-1 border-t border-[#E5E7EB]">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3 mt-3">{uz.bolalar.bogcha_malumotlari}</p>
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
          </div>
        </form>
      </Modal>
    </div>
  );
}
