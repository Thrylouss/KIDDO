"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
import type { UserSummary, PaginatedResponse, Role, OrganizationSummary } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: uz.foydalanuvchilar.rol_super_admin,
    admin:       uz.foydalanuvchilar.rol_admin,
    teacher:     uz.foydalanuvchilar.rol_teacher,
    parent:      uz.foydalanuvchilar.rol_parent,
  };
  return labels[role] ?? role;
}

function roleVariant(role: Role): "warning" | "info" | "success" | "neutral" {
  if (role === "super_admin") return "warning";
  if (role === "admin")       return "info";
  if (role === "teacher")     return "success";
  return "neutral";
}

function formatDate(iso: string | null): string {
  if (!iso) return uz.foydalanuvchilar.hech_qachon;
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Types ──────────────────────────────────────────────────────────

interface ApiParams {
  search: string;
  role: string;
  status: string;
  sort: string;
  page: number;
}

interface PasswordForm { password: string }

interface EditForm {
  name: string;
  phone: string;
  email: string;
  role: Role;
  organization_id: string;
  is_active: boolean;
}

// ── Page ───────────────────────────────────────────────────────────

export default function FoydalanuvchilarPage() {
  const [users,   setUsers]   = useState<UserSummary[]>([]);
  const [meta,    setMeta]    = useState<{ current_page: number; last_page: number; per_page: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [apiParams, setApiParams] = useState<ApiParams>({
    search: "", role: "", status: "", sort: "newest", page: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Organizations for edit dropdown
  const [orgs, setOrgs] = useState<Pick<OrganizationSummary, "id" | "name">[]>([]);

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Edit modal
  const [editTarget,   setEditTarget]   = useState<UserSummary | null>(null);
  const [editForm,     setEditForm]     = useState<EditForm | null>(null);
  const [editLoading,  setEditLoading]  = useState(false);
  const [editError,    setEditError]    = useState("");

  // Confirm modals
  const [confirmActivate,   setConfirmActivate]   = useState<UserSummary | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserSummary | null>(null);
  const [resetTarget,       setResetTarget]       = useState<UserSummary | null>(null);
  const [passwordForm,      setPasswordForm]      = useState<PasswordForm>({ password: "" });
  const [actionLoading,     setActionLoading]     = useState(false);
  const [actionError,       setActionError]       = useState("");

  // ── Fetch users ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams();
    if (apiParams.search) params.set("search", apiParams.search);
    if (apiParams.role)   params.set("role",   apiParams.role);
    if (apiParams.status) params.set("status", apiParams.status);
    params.set("sort",     apiParams.sort);
    params.set("page",     String(apiParams.page));
    params.set("per_page", "20");

    api.get<PaginatedResponse<UserSummary>>(`/v1/super-admin/users?${params}`)
      .then(res => {
        if (cancelled) return;
        setUsers(res.data);
        setMeta(res.meta);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [apiParams]);

  // ── Fetch organizations (for edit dropdown) ────────────────────

  useEffect(() => {
    api.get<PaginatedResponse<OrganizationSummary>>("/v1/super-admin/organizations?per_page=100")
      .then(res => setOrgs(res.data.map(o => ({ id: o.id, name: o.name }))))
      .catch(() => {}); // non-critical — falls back to empty list
  }, []);

  // ── Search debounce ────────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearchInput(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setApiParams(p => ({ ...p, search: val, page: 1 }));
    }, 350);
  }

  function setFilter(key: keyof ApiParams, val: string) {
    setApiParams(p => ({ ...p, [key]: val, page: 1 }));
  }

  // ── Open edit modal ────────────────────────────────────────────

  function openEdit(u: UserSummary) {
    setEditTarget(u);
    setEditForm({
      name:            u.name,
      phone:           u.phone ?? "",
      email:           u.email ?? "",
      role:            u.role,
      organization_id: u.organization ? String(u.organization.id) : "",
      is_active:       u.is_active,
    });
    setEditError("");
  }

  // ── Save edit ──────────────────────────────────────────────────

  async function doEdit() {
    if (!editTarget || !editForm) return;
    setEditLoading(true); setEditError("");

    const payload: Record<string, unknown> = {
      name:            editForm.name.trim(),
      phone:           editForm.phone.trim(),
      email:           editForm.email.trim() || null,
      role:            editForm.role,
      organization_id: editForm.organization_id ? Number(editForm.organization_id) : null,
      is_active:       editForm.is_active,
    };

    try {
      const res = await api.put<{ data: UserSummary }>(`/v1/super-admin/users/${editTarget.id}`, payload);
      setUsers(us => us.map(u => u.id === editTarget.id ? res.data : u));
      setEditTarget(null);
      setEditForm(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string; errors?: Record<string, string[]> } };
      if (err?.data?.errors) {
        const firstMsg = Object.values(err.data.errors).flat()[0];
        setEditError(firstMsg ?? uz.xatolar.server_xato);
      } else {
        setEditError(err?.data?.message ?? uz.xatolar.server_xato);
      }
    } finally {
      setEditLoading(false);
    }
  }

  // ── Activate / Deactivate / Reset password ─────────────────────

  async function doActivate() {
    if (!confirmActivate) return;
    setActionLoading(true); setActionError("");
    try {
      await api.patch(`/v1/super-admin/users/${confirmActivate.id}/activate`);
      setUsers(us => us.map(u => u.id === confirmActivate.id ? { ...u, is_active: true } : u));
      setConfirmActivate(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setActionError(err?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setActionLoading(false);
    }
  }

  async function doDeactivate() {
    if (!confirmDeactivate) return;
    setActionLoading(true); setActionError("");
    try {
      await api.patch(`/v1/super-admin/users/${confirmDeactivate.id}/deactivate`);
      setUsers(us => us.map(u => u.id === confirmDeactivate.id ? { ...u, is_active: false } : u));
      setConfirmDeactivate(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setActionError(err?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setActionLoading(false);
    }
  }

  async function doResetPassword() {
    if (!resetTarget) return;
    setActionLoading(true); setActionError("");
    try {
      await api.post(`/v1/super-admin/users/${resetTarget.id}/reset-password`, passwordForm);
      setResetTarget(null);
      setPasswordForm({ password: "" });
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setActionError(err?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{uz.foydalanuvchilar.sarlavha}</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{uz.foydalanuvchilar.sahifa_tavsif}</p>
        </div>
        {meta && (
          <span className="text-sm font-medium text-[#6B7280] bg-[#F3F4F6] px-3 py-1 rounded-full">
            {uz.foydalanuvchilar.jami}: {meta.total}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <Input
            placeholder={uz.foydalanuvchilar.qidirish}
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        <Select
          value={apiParams.role}
          onChange={e => setFilter("role", e.target.value)}
        >
          <option value="">{uz.foydalanuvchilar.filter_hammasi}</option>
          <option value="admin">{uz.foydalanuvchilar.rol_admin}</option>
          <option value="teacher">{uz.foydalanuvchilar.rol_teacher}</option>
          <option value="parent">{uz.foydalanuvchilar.rol_parent}</option>
          <option value="super_admin">{uz.foydalanuvchilar.rol_super_admin}</option>
        </Select>

        <Select
          value={apiParams.status}
          onChange={e => setFilter("status", e.target.value)}
        >
          <option value="">{uz.common.hammasi}</option>
          <option value="active">{uz.foydalanuvchilar.filter_faol}</option>
          <option value="inactive">{uz.foydalanuvchilar.filter_nofaol}</option>
        </Select>

        <Select
          value={apiParams.sort}
          onChange={e => setFilter("sort", e.target.value)}
        >
          <option value="newest">{uz.foydalanuvchilar.sort_yangi}</option>
          <option value="oldest">{uz.foydalanuvchilar.sort_eski}</option>
          <option value="last_login">{uz.foydalanuvchilar.sort_kirish}</option>
          <option value="name">{uz.foydalanuvchilar.sort_nomi}</option>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
          <p className="text-[#EF4444] mb-3">{uz.common.yuklash_xatosi}</p>
          <Button variant="secondary" onClick={() => setApiParams(p => ({ ...p }))}>
            {uz.common.qayta_urinish}
          </Button>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title={uz.foydalanuvchilar.bosh_sarlavha}
          description={uz.foydalanuvchilar.bosh_tavsif}
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  {[
                    uz.foydalanuvchilar.ismi,
                    uz.foydalanuvchilar.telefon,
                    uz.foydalanuvchilar.rol,
                    uz.foydalanuvchilar.tashkilot,
                    uz.foydalanuvchilar.holat,
                    uz.foydalanuvchilar.oxirgi_kirish,
                    uz.foydalanuvchilar.amallar,
                  ].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                    {/* Name + email */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111827]">{u.name}</div>
                      {u.email && <div className="text-xs text-[#9CA3AF] mt-0.5">{u.email}</div>}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                      {u.phone ?? "—"}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge variant={roleVariant(u.role)}>{roleLabel(u.role)}</Badge>
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3 text-[#374151]">
                      {u.organization
                        ? <span className="font-medium">{u.organization.name}</span>
                        : <span className="text-[#9CA3AF] text-xs italic">{uz.foydalanuvchilar.tashkilot_yoq}</span>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? uz.common.faol : uz.common.nofaol}
                      </Badge>
                    </td>

                    {/* Last login */}
                    <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">
                      {formatDate(u.last_login_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                          aria-label="Amallar"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                          </svg>
                        </button>
                        {openMenuId === u.id && (
                          <div
                            className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-[#E5E7EB] z-20 py-1"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6]"
                              onClick={() => openEdit(u)}
                            >
                              {uz.foydalanuvchilar.tahrirlash}
                            </button>
                            {!u.is_active ? (
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6]"
                                onClick={() => setConfirmActivate(u)}
                              >
                                {uz.foydalanuvchilar.faollashtirish}
                              </button>
                            ) : (
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6]"
                                onClick={() => setConfirmDeactivate(u)}
                              >
                                {uz.foydalanuvchilar.faolsizlantirish}
                              </button>
                            )}
                            <button
                              className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6]"
                              onClick={() => { setResetTarget(u); setPasswordForm({ password: "" }); }}
                            >
                              {uz.foydalanuvchilar.parol_yangilash}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <p className="text-sm text-[#6B7280]">
                {meta.current_page} / {meta.last_page} {uz.super_admin.sahifa}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={meta.current_page <= 1}
                  onClick={() => setApiParams(p => ({ ...p, page: p.page - 1 }))}
                >
                  ←
                </Button>
                <Button
                  variant="secondary"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setApiParams(p => ({ ...p, page: p.page + 1 }))}
                >
                  →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setEditForm(null); setEditError(""); }}
        title={uz.foydalanuvchilar.tahrirlash_modal}
        size="md"
      >
        {editForm && (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {uz.foydalanuvchilar.ism_familiya} <span className="text-[#EF4444]">*</span>
              </label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)}
                placeholder={uz.foydalanuvchilar.ism_familiya}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {uz.foydalanuvchilar.telefon} <span className="text-[#EF4444]">*</span>
              </label>
              <Input
                value={editForm.phone}
                onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)}
                placeholder="+998901234567"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {uz.foydalanuvchilar.email}
              </label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)}
                placeholder="email@example.com"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {uz.foydalanuvchilar.rol} <span className="text-[#EF4444]">*</span>
              </label>
              <Select
                value={editForm.role}
                onChange={e => setEditForm(f => f ? { ...f, role: e.target.value as Role } : f)}
              >
                <option value="admin">{uz.foydalanuvchilar.rol_admin}</option>
                <option value="teacher">{uz.foydalanuvchilar.rol_teacher}</option>
                <option value="parent">{uz.foydalanuvchilar.rol_parent}</option>
                <option value="super_admin">{uz.foydalanuvchilar.rol_super_admin}</option>
              </Select>
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">
                {uz.foydalanuvchilar.tashkilot}
              </label>
              <Select
                value={editForm.organization_id}
                onChange={e => setEditForm(f => f ? { ...f, organization_id: e.target.value } : f)}
              >
                <option value="">{uz.foydalanuvchilar.tashkilot_yoq}</option>
                {orgs.map(o => (
                  <option key={o.id} value={String(o.id)}>{o.name}</option>
                ))}
              </Select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#374151]">
                {uz.foydalanuvchilar.holat}
              </label>
              <button
                type="button"
                onClick={() => setEditForm(f => f ? { ...f, is_active: !f.is_active } : f)}
                className={[
                  "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                  editForm.is_active ? "bg-[#7C3AED]" : "bg-[#D1D5DB]",
                ].join(" ")}
                role="switch"
                aria-checked={editForm.is_active}
              >
                <span
                  className={[
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
                    editForm.is_active ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
              <span className="text-sm text-[#6B7280]">
                {editForm.is_active ? uz.common.faol : uz.common.nofaol}
              </span>
            </div>

            {editError && (
              <p className="text-sm text-[#EF4444] bg-[#FEF2F2] px-3 py-2 rounded-lg">{editError}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => { setEditTarget(null); setEditForm(null); setEditError(""); }}
              >
                {uz.common.bekor_qilish}
              </Button>
              <Button
                onClick={doEdit}
                disabled={editLoading || !editForm.name.trim() || !editForm.phone.trim()}
              >
                {editLoading ? uz.common.yuklanmoqda : uz.foydalanuvchilar.yangilash}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Activate Modal ─────────────────────────────────────── */}
      <Modal
        open={!!confirmActivate}
        onClose={() => { setConfirmActivate(null); setActionError(""); }}
        title={uz.foydalanuvchilar.faollashtirish}
      >
        <p className="text-sm text-[#374151] mb-4">
          {uz.foydalanuvchilar.faollashtirish_tasdiq}
        </p>
        {confirmActivate && (
          <p className="text-sm font-medium text-[#111827] mb-4">{confirmActivate.name}</p>
        )}
        {actionError && <p className="text-sm text-[#EF4444] mb-3">{actionError}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setConfirmActivate(null); setActionError(""); }}>
            {uz.common.bekor_qilish}
          </Button>
          <Button onClick={doActivate} disabled={actionLoading}>
            {actionLoading ? uz.common.yuklanmoqda : uz.foydalanuvchilar.faollashtirish}
          </Button>
        </div>
      </Modal>

      {/* ── Deactivate Modal ───────────────────────────────────── */}
      <Modal
        open={!!confirmDeactivate}
        onClose={() => { setConfirmDeactivate(null); setActionError(""); }}
        title={uz.foydalanuvchilar.faolsizlantirish}
      >
        <p className="text-sm text-[#374151] mb-4">
          {uz.foydalanuvchilar.faolsizlantirish_tasdiq}
        </p>
        {confirmDeactivate && (
          <p className="text-sm font-medium text-[#111827] mb-4">{confirmDeactivate.name}</p>
        )}
        {actionError && <p className="text-sm text-[#EF4444] mb-3">{actionError}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setConfirmDeactivate(null); setActionError(""); }}>
            {uz.common.bekor_qilish}
          </Button>
          <Button variant="danger" onClick={doDeactivate} disabled={actionLoading}>
            {actionLoading ? uz.common.yuklanmoqda : uz.foydalanuvchilar.faolsizlantirish}
          </Button>
        </div>
      </Modal>

      {/* ── Reset Password Modal ───────────────────────────────── */}
      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setActionError(""); setPasswordForm({ password: "" }); }}
        title={uz.foydalanuvchilar.parol_yangilash}
      >
        {resetTarget && (
          <p className="text-sm text-[#6B7280] mb-4">{resetTarget.name}</p>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#374151] mb-1">
            {uz.foydalanuvchilar.yangi_parol}
          </label>
          <Input
            type="password"
            value={passwordForm.password}
            onChange={e => setPasswordForm({ password: e.target.value })}
            placeholder="Kamida 8 ta belgi"
          />
        </div>
        {actionError && <p className="text-sm text-[#EF4444] mb-3">{actionError}</p>}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => { setResetTarget(null); setActionError(""); setPasswordForm({ password: "" }); }}
          >
            {uz.common.bekor_qilish}
          </Button>
          <Button
            onClick={doResetPassword}
            disabled={actionLoading || passwordForm.password.length < 8}
          >
            {actionLoading ? uz.common.yuklanmoqda : uz.common.saqlash}
          </Button>
        </div>
      </Modal>

      {/* Close dropdown on outside click */}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
