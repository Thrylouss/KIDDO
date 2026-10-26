"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, impersonation } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
import type { OrganizationSummary, Plan, ApiResponse } from "@/types";

// ── Types ──────────────────────────────────────────────────────────
interface OrgForm {
  name: string; phone: string; address: string;
  admin_name: string; admin_phone: string; admin_email: string; admin_password: string;
  plan_id: string; subscription_status: string;
  starts_at: string; ends_at: string; payment_status: string;
}
const emptyForm: OrgForm = {
  name: "", phone: "", address: "",
  admin_name: "", admin_phone: "", admin_email: "", admin_password: "",
  plan_id: "", subscription_status: "trial", starts_at: "", ends_at: "", payment_status: "pending",
};

interface ApiParams { search: string; status: string; sort: string; page: number }
interface Meta { current_page: number; last_page: number; per_page: number; total: number }

// ── Helpers ────────────────────────────────────────────────────────

const orgIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// ── Page ───────────────────────────────────────────────────────────
export default function BogchalarPage() {
  const router = useRouter();

  const [orgs,    setOrgs]    = useState<OrganizationSummary[]>([]);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Filter/sort state — drives API calls
  const [apiParams, setApiParams] = useState<ApiParams>({ search: "", status: "", sort: "newest", page: 1 });
  // Raw search input (decoupled from debounced apiParams.search)
  const [searchInput, setSearchInput] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Action menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Create modal
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState<OrgForm>(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [formErrors,  setFormErrors]  = useState<Record<string, string[]>>({});
  const [saveError,   setSaveError]   = useState("");

  // Edit modal
  const [editOrg,    setEditOrg]    = useState<OrganizationSummary | null>(null);
  const [editForm,   setEditForm]   = useState({ name: "", phone: "", address: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState("");

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState<OrganizationSummary | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<OrganizationSummary | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load data ────────────────────────────────────────────────────

  async function loadOrgs(p: ApiParams = apiParams) {
    setError(false);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p.page), sort: p.sort });
      if (p.search) qs.set("search", p.search);
      if (p.status) qs.set("status", p.status);
      const res = await api.get<{ data: OrganizationSummary[]; meta: Meta }>(
        `/v1/super-admin/organizations?${qs}`
      );
      if (!res) { setOrgs([]); setMeta(null); return; }
      setOrgs(res.data);
      setMeta(res.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans")
      .then(r => setPlans(r.data))
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOrgs(apiParams); }, [apiParams]);

  // ── Filter handlers ───────────────────────────────────────────────

  function handleSearch(val: string) {
    setSearchInput(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setApiParams(p => ({ ...p, search: val, page: 1 }));
    }, 300);
  }

  function handleStatus(val: string) {
    setApiParams(p => ({ ...p, status: val, page: 1 }));
  }

  function handleSort(val: string) {
    setApiParams(p => ({ ...p, sort: val, page: 1 }));
  }

  // ── Actions ───────────────────────────────────────────────────────

  async function handleEnter(org: OrganizationSummary) {
    setOpenMenuId(null);
    try {
      await api.post(`/v1/super-admin/organizations/${org.id}/enter`, {});
      impersonation.start(org.id, org.name);
      router.push("/bogcha/dashboard");
    } catch {
      alert("Kirish amalga oshmadi.");
    }
  }

  async function handleToggleActive() {
    if (!confirmToggle) return;
    setActionLoading(true);
    try {
      if (confirmToggle.is_active) {
        await api.patch(`/v1/super-admin/organizations/${confirmToggle.id}/deactivate`, {});
      } else {
        await api.patch(`/v1/super-admin/organizations/${confirmToggle.id}/activate`, {});
      }
      setConfirmToggle(null);
      loadOrgs();
    } catch {
      alert("Amal bajarilmadi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await api.delete(`/v1/super-admin/organizations/${confirmDelete.id}`);
      setConfirmDelete(null);
      loadOrgs();
    } catch {
      alert("O'chirish amalga oshmadi.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setSaveError("");
    setSaving(true);
    try {
      await api.post("/v1/super-admin/organizations", {
        name:                form.name,
        phone:               form.phone || null,
        address:             form.address || null,
        admin_name:          form.admin_name || null,
        admin_phone:         form.admin_phone || null,
        admin_email:         form.admin_email || null,
        admin_password:      form.admin_password || null,
        plan_id:             form.plan_id ? parseInt(form.plan_id) : null,
        subscription_status: form.subscription_status || null,
        starts_at:           form.starts_at || null,
        ends_at:             form.ends_at || null,
        payment_status:      form.payment_status || null,
      });
      setShowCreate(false);
      setForm(emptyForm);
      setApiParams(p => ({ ...p, page: 1 }));
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]>; message?: string } };
      if (e?.data?.errors) setFormErrors(e.data.errors);
      else setSaveError(e?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(org: OrganizationSummary) {
    setOpenMenuId(null);
    setEditOrg(org);
    setEditForm({ name: org.name, phone: org.phone ?? "", address: org.address ?? "" });
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editOrg) return;
    setEditSaving(true);
    setEditError("");
    try {
      await api.put(`/v1/super-admin/organizations/${editOrg.id}`, {
        name:    editForm.name,
        phone:   editForm.phone || null,
        address: editForm.address || null,
      });
      setEditOrg(null);
      loadOrgs();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      setEditError(e?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={uz.super_admin.bogchalar}
        description={uz.super_admin.bogchalar_tavsif}
        action={
          <Button onClick={() => setShowCreate(true)} icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }>
            {uz.super_admin.bogcha_qoshish}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input
            placeholder={uz.super_admin.qidiruv}
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            suffix={
              <svg className="h-4 w-4 text-[#B8AAB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            }
          />
        </div>
        <Select value={apiParams.status} onChange={(e) => handleStatus(e.target.value)} className="sm:w-48">
          <option value="">{uz.super_admin.filter_barchasi}</option>
          <option value="active">{uz.super_admin.filter_faol}</option>
          <option value="inactive">{uz.super_admin.filter_nofaol}</option>
          <option value="trial">{uz.super_admin.filter_trial}</option>
          <option value="paid">{uz.super_admin.filter_tolangan}</option>
          <option value="payment_overdue">{uz.super_admin.filter_kechikkan}</option>
          <option value="expired">{uz.super_admin.filter_tugagan}</option>
          <option value="cancelled">{uz.super_admin.bekor}</option>
        </Select>
        <Select value={apiParams.sort} onChange={(e) => handleSort(e.target.value)} className="sm:w-48">
          <option value="newest">{uz.super_admin.sort_yangi}</option>
          <option value="oldest">{uz.super_admin.sort_eski}</option>
          <option value="name">{uz.super_admin.sort_nomi}</option>
          <option value="subscription_expiry">{uz.super_admin.sort_muddati}</option>
        </Select>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : error ? (
          <EmptyState
            title={uz.common.yuklash_xatosi}
            action={{ label: uz.common.qayta_urinish, onClick: () => loadOrgs() }}
            icon={orgIcon}
          />
        ) : orgs.length === 0 ? (
          <EmptyState
            icon={orgIcon}
            title={apiParams.search || apiParams.status ? "Natija topilmadi" : "Hali bog'cha yo'q"}
            description={apiParams.search || apiParams.status ? "Boshqa filtr bilan qidiring" : "Birinchi bog'chani qo'shing."}
            action={!apiParams.search && !apiParams.status
              ? { label: `+ ${uz.super_admin.bogcha_qoshish}`, onClick: () => setShowCreate(true) }
              : undefined}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="sm:hidden divide-y divide-[#F2ECF0]">
              {orgs.map((org) => (
                <li key={org.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-lg bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] font-semibold flex-shrink-0">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#29232A] truncate">{org.name}</p>
                    <p className="text-xs text-[#B8AAB2]">{org.phone ?? "—"}</p>
                    {org.subscription && <SubscriptionBadge status={org.subscription.status} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={org.is_active ? "success" : "neutral"}>
                      {org.is_active ? uz.common.faol : uz.common.nofaol}
                    </Badge>
                    <Link href={`/admin/bogchalar/${org.id}`} className="text-sm text-[#8E315D] font-medium">
                      Ko&apos;rish
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div
              className="hidden sm:block"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("[data-menu]")) setOpenMenuId(null);
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">Bog&apos;cha</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden md:table-cell">{uz.super_admin.mas_ul}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">{uz.super_admin.tarif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.obuna}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.amallar}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECF0]">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-[#FAF5F8] transition-colors duration-100">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] font-semibold text-xs flex-shrink-0">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#29232A]">{org.name}</p>
                            <p className="text-xs text-[#B8AAB2]">{org.phone ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {org.admin ? (
                          <div>
                            <p className="text-sm text-[#3D3240]">{org.admin.name}</p>
                            <p className="text-xs text-[#B8AAB2]">{org.admin.phone ?? "—"}</p>
                          </div>
                        ) : (
                          <span className="text-[#D9C9D1] text-sm">{uz.super_admin.admin_yoq}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#766B73] hidden lg:table-cell">
                        {org.subscription?.plan?.name ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        {org.subscription ? (
                          <div>
                            <SubscriptionBadge status={org.subscription.status} />
                            {org.subscription.days_remaining > 0 && (
                              <p className="text-xs text-[#B8AAB2] mt-1">
                                {org.subscription.days_remaining} {uz.super_admin.qolgan_kun}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#D9C9D1]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={org.is_active ? "success" : "neutral"}>
                          {org.is_active ? uz.common.faol : uz.common.nofaol}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 relative" data-menu="">
                        <button
                          data-menu=""
                          onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                          className="p-1.5 rounded-lg text-[#B8AAB2] hover:text-[#3D3240] hover:bg-[#F2ECF0] transition-colors"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {openMenuId === org.id && (
                          <div
                            data-menu=""
                            className="absolute right-0 top-10 bg-white border border-[#EDE3E8] rounded-xl shadow-lg z-20 min-w-[190px] py-1"
                          >
                            <ActionMenuItem
                              label="Ko'rish"
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                              href={`/admin/bogchalar/${org.id}`}
                              onClick={() => setOpenMenuId(null)}
                            />
                            <ActionMenuItem
                              label={uz.common.tahrirlash}
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                              onClick={() => openEdit(org)}
                            />
                            <ActionMenuItem
                              label={uz.super_admin.bogcha_kirish}
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>}
                              onClick={() => handleEnter(org)}
                            />
                            <ActionMenuItem
                              label={uz.super_admin.obunani_uzaytirish}
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                              href={`/admin/bogchalar/${org.id}`}
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="border-t border-[#F2ECF0] my-1" />
                            <ActionMenuItem
                              label={org.is_active ? uz.super_admin.faolsizlantir : uz.super_admin.faollashtirish}
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={org.is_active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} /></svg>}
                              onClick={() => { setOpenMenuId(null); setConfirmToggle(org); }}
                              variant={org.is_active ? "warning" : "success"}
                            />
                            <ActionMenuItem
                              label={uz.common.ochirish}
                              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                              onClick={() => { setOpenMenuId(null); setConfirmDelete(org); }}
                              variant="danger"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#F2ECF0]">
                <p className="text-sm text-[#766B73]">
                  {uz.super_admin.jami} <span className="font-medium">{meta.total}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={meta.current_page <= 1}
                    onClick={() => setApiParams(p => ({ ...p, page: p.page - 1 }))}
                    className="px-3 py-1.5 text-sm border border-[#EDE3E8] rounded-lg disabled:opacity-40 hover:bg-[#F2ECF0] transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-sm text-[#766B73]">
                    {meta.current_page} / {meta.last_page}
                  </span>
                  <button
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => setApiParams(p => ({ ...p, page: p.page + 1 }))}
                    className="px-3 py-1.5 text-sm border border-[#EDE3E8] rounded-lg disabled:opacity-40 hover:bg-[#F2ECF0] transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create modal ── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setForm(emptyForm); setFormErrors({}); setSaveError(""); }}
        title={uz.super_admin.bogcha_qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="org-form" type="submit" loading={saving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="org-form" onSubmit={handleCreate} className="space-y-5">
          {IS_DEMO && (
            <div className="bg-[#FFF9F5] border border-[#EDE3E8] text-[#766B73] text-sm px-4 py-3 rounded-xl">
              {uz.super_admin.demo_modal_xabar}
            </div>
          )}
          {saveError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm px-4 py-3 rounded-xl">
              {saveError}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-[#B8AAB2] uppercase tracking-wide mb-3">{uz.super_admin.bogcha_malumotlari}</p>
            <div className="space-y-3">
              <Input label="Nomi *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={formErrors.name?.[0]} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={formErrors.phone?.[0]} placeholder="+998712345678" />
                <Input label="Manzil" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="pt-1 border-t border-[#EDE3E8]">
            <p className="text-xs font-semibold text-[#B8AAB2] uppercase tracking-wide mb-3 mt-3">{uz.super_admin.admin_malumotlari}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Admin ismi" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} error={formErrors.admin_name?.[0]} />
                <Input label="Admin telefoni" value={form.admin_phone} onChange={(e) => setForm({ ...form, admin_phone: e.target.value })} error={formErrors.admin_phone?.[0]} placeholder="+998901234567" />
              </div>
              <Input label="Admin email (ixtiyoriy)" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} error={formErrors.admin_email?.[0]} />
              <Input label="Parol (bo'sh: kiddo123)" type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} error={formErrors.admin_password?.[0]} />
            </div>
          </div>
          <div className="pt-1 border-t border-[#EDE3E8]">
            <p className="text-xs font-semibold text-[#B8AAB2] uppercase tracking-wide mb-3 mt-3">{uz.super_admin.obuna_malumotlari}</p>
            <div className="space-y-3">
              <Select label={uz.super_admin.tarif} value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
                <option value="">— Tarif tanlang —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Obuna holati" value={form.subscription_status} onChange={(e) => setForm({ ...form, subscription_status: e.target.value })}>
                  <option value="trial">Sinov</option>
                  <option value="active">Faol</option>
                  <option value="past_due">To&apos;lov kechikkan</option>
                </Select>
                <Select label="To'lov holati" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  <option value="pending">Kutilmoqda</option>
                  <option value="paid">To&apos;langan</option>
                  <option value="overdue">Muddati o&apos;tgan</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Boshlanish sanasi" type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                <Input label="Tugash sanasi" type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal
        open={!!editOrg}
        onClose={() => setEditOrg(null)}
        title={uz.common.tahrirlash}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOrg(null)}>{uz.common.bekor_qilish}</Button>
            <Button form="edit-form" type="submit" loading={editSaving}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="edit-form" onSubmit={handleEdit} className="space-y-4">
          {editError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm px-4 py-3 rounded-xl">{editError}</div>
          )}
          <Input label="Nomi *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Input label="Telefon" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+998712345678" />
          <Input label="Manzil" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
        </form>
      </Modal>

      {/* ── Confirm toggle active/inactive ── */}
      <Modal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.is_active ? uz.super_admin.faolsizlantir : uz.super_admin.faollashtirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmToggle(null)}>{uz.common.bekor_qilish}</Button>
            <Button
              onClick={handleToggleActive}
              loading={actionLoading}
              variant={confirmToggle?.is_active ? "danger" : "primary"}
            >
              {uz.common.tasdiqlash}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#766B73]">
          {confirmToggle?.is_active
            ? uz.super_admin.faolsizlantir_tasdiq
            : uz.super_admin.faollashtirish_tasdiq}
        </p>
        {confirmToggle && (
          <p className="mt-2 font-medium text-[#29232A]">{confirmToggle.name}</p>
        )}
      </Modal>

      {/* ── Confirm delete ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={uz.common.ochirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>{uz.common.bekor_qilish}</Button>
            <Button onClick={handleDelete} loading={actionLoading} variant="danger">
              {uz.common.ochirish}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#766B73]">{uz.super_admin.ochir_tasdiq}</p>
        {confirmDelete && (
          <p className="mt-2 font-semibold text-[#29232A]">{confirmDelete.name}</p>
        )}
      </Modal>
    </div>
  );
}

// ── Small sub-components ───────────────────────────────────────────

function SubscriptionBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "info" | "error" }> = {
    active:   { label: uz.super_admin.faol,            variant: "success" },
    trial:    { label: uz.super_admin.sinov,           variant: "info" },
    past_due: { label: uz.super_admin.past_due,        variant: "warning" },
    expired:  { label: uz.super_admin.muddati_tugagan, variant: "error" },
    cancelled:{ label: uz.super_admin.bekor,           variant: "neutral" },
  };
  const info = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function ActionMenuItem({
  label, icon, href, onClick, variant = "default",
}: {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  const color = {
    default: "text-[#3D3240] hover:bg-[#F2ECF0]",
    warning: "text-[#92400E] hover:bg-[#FFFBEB]",
    danger:  "text-[#991B1B] hover:bg-[#FEF2F2]",
    success: "text-[#166534] hover:bg-[#F0FDF4]",
  }[variant];

  const cls = `w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors ${color}`;

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls} data-menu="">
        <span className="flex-shrink-0 opacity-60">{icon}</span>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} data-menu="">
      <span className="flex-shrink-0 opacity-60">{icon}</span>
      {label}
    </button>
  );
}
