"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
import type {
  FullSubscription,
  SubscriptionDetail,
  SubscriptionMetrics,
  Plan,
  PaginatedResponse,
  ApiResponse,
  OrganizationSummary,
} from "@/types";

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtMoney(val: number): string {
  return val.toLocaleString("uz-UZ") + " UZS";
}

function subStatusVariant(status: string): "success" | "info" | "warning" | "error" | "neutral" {
  if (status === "active")   return "success";
  if (status === "trial")    return "info";
  if (status === "past_due") return "warning";
  if (status === "expired")  return "error";
  return "neutral";
}

function subStatusLabel(status: string): string {
  return ({
    active:    uz.super_admin.faol,
    trial:     uz.super_admin.sinov,
    past_due:  uz.super_admin.past_due,
    expired:   uz.super_admin.muddati_tugagan,
    cancelled: uz.super_admin.bekor,
  } as Record<string, string>)[status] ?? status;
}

function DaysCell({ days, status }: { days: number; status: string }) {
  if (status === "expired" || status === "cancelled") {
    return <span className="text-[#EF4444] text-sm">Tugagan</span>;
  }
  if (days === 0) return <span className="text-[#EF4444] text-sm font-semibold">Bugun tugaydi</span>;
  const cls =
    days < 7  ? "text-[#EF4444] font-semibold" :
    days <= 14 ? "text-[#F59E0B] font-semibold" :
                 "text-[#6B7280]";
  return <span className={`text-sm ${cls}`}>{days} {uz.super_admin.qolgan_kun}</span>;
}

// ── Pagination ─────────────────────────────────────────────────────

function Pagination({
  meta,
  onPage,
}: {
  meta: { current_page: number; last_page: number; total: number };
  onPage: (page: number) => void;
}) {
  if (meta.last_page <= 1) return null;
  const pages = Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#E5E7EB]">
      <p className="text-sm text-[#6B7280]">{uz.super_admin.jami} {meta.total} ta</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E7EB] text-[#374151] disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors"
        >
          Oldingi
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              p === meta.current_page
                ? "bg-[#7C3AED] text-white"
                : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F8FAFC]"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page === meta.last_page}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E7EB] text-[#374151] disabled:opacity-40 hover:bg-[#F8FAFC] transition-colors"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}

// ── Form types ─────────────────────────────────────────────────────

interface CreateForm {
  organization_id: string;
  plan_id:         string;
  status:          string;
  ends_at:         string;
  payment_status:  string;
  auto_renew:      boolean;
  notes:           string;
}

interface RenewForm {
  plan_id:        string;
  ends_at:        string;
  payment_status: string;
  notes:          string;
}

const emptyCreate: CreateForm = {
  organization_id: "",
  plan_id:         "",
  status:          "trial",
  ends_at:         "",
  payment_status:  "pending",
  auto_renew:      false,
  notes:           "",
};

const emptyRenew: RenewForm = {
  plan_id:        "",
  ends_at:        "",
  payment_status: "paid",
  notes:          "",
};

// ── Page ───────────────────────────────────────────────────────────

export default function ObunalarPage() {
  // ── Data ──────────────────────────────────────────────────────
  const [subs,    setSubs]    = useState<FullSubscription[]>([]);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [orgs,    setOrgs]    = useState<Pick<OrganizationSummary, "id" | "name">[]>([]);
  const [meta,    setMeta]    = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Filters ───────────────────────────────────────────────────
  const [searchInput,  setSearchInput]  = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlan,   setFilterPlan]   = useState("");
  const [filterOrg,    setFilterOrg]    = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [sort,         setSort]         = useState("newest");
  const [page,         setPage]         = useState(1);
  const [appliedSearch, setAppliedSearch] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Menu ──────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // ── Detail modal ──────────────────────────────────────────────
  const [showDetail,    setShowDetail]    = useState(false);
  const [detail,        setDetail]        = useState<SubscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Action modals ─────────────────────────────────────────────
  const [selected,       setSelected]       = useState<FullSubscription | null>(null);
  const [showRenew,      setShowRenew]      = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancel,     setShowCancel]     = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);

  // ── Form state ────────────────────────────────────────────────
  const [createForm,    setCreateForm]    = useState<CreateForm>(emptyCreate);
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState("");
  const [renewForm,     setRenewForm]     = useState<RenewForm>(emptyRenew);
  const [renewing,      setRenewing]      = useState(false);
  const [renewErrors,   setRenewErrors]   = useState<Record<string, string[]>>({});
  const [changePlanId,  setChangePlanId]  = useState("");
  const [changingPlan,  setChangingPlan]  = useState(false);
  const [cancelReason,  setCancelReason]  = useState("");
  const [cancelling,    setCancelling]    = useState(false);

  // ── Load data ─────────────────────────────────────────────────

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (appliedSearch) params.set("search", appliedSearch);
      if (filterStatus)  params.set("status", filterStatus);
      if (filterPlan)    params.set("plan_id", filterPlan);
      if (filterOrg)     params.set("organization_id", filterOrg);
      if (dateFrom)      params.set("date_from", dateFrom);
      if (dateTo)        params.set("date_to", dateTo);
      if (sort !== "newest") params.set("sort", sort);
      const res = await api.get<PaginatedResponse<FullSubscription>>(
        `/v1/super-admin/subscriptions?${params}`
      );
      setSubs(res.data);
      setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, filterStatus, filterPlan, filterOrg, dateFrom, dateTo, sort]);

  async function loadMetrics() {
    try {
      const res = await api.get<ApiResponse<SubscriptionMetrics>>("/v1/super-admin/subscriptions/metrics");
      setMetrics(res.data);
    } catch { /* ignore */ }
  }

  async function loadPlans() {
    try {
      const res = await api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans");
      setPlans(res.data);
    } catch { /* ignore */ }
  }

  async function loadOrgs() {
    try {
      const res = await api.get<PaginatedResponse<OrganizationSummary>>(
        "/v1/super-admin/organizations?per_page=100"
      );
      setOrgs(res.data.map((o) => ({ id: o.id, name: o.name })));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadMetrics();
    loadPlans();
    loadOrgs();
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    function handleClick() { setOpenMenuId(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuId]);

  // ── Search debounce ───────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearchInput(val);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setAppliedSearch(val);
      setPage(1);
    }, 350);
  }

  // ── Handlers ──────────────────────────────────────────────────

  async function openDetail(sub: FullSubscription) {
    setSelected(sub);
    setShowDetail(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get<ApiResponse<SubscriptionDetail>>(
        `/v1/super-admin/subscriptions/${sub.id}`
      );
      setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  }

  function openRenew(sub: FullSubscription) {
    setSelected(sub);
    setRenewForm({ ...emptyRenew, plan_id: String(sub.plan_id) });
    setRenewErrors({});
    setShowRenew(true);
  }

  function openChangePlan(sub: FullSubscription) {
    setSelected(sub);
    setChangePlanId(String(sub.plan_id));
    setShowChangePlan(true);
  }

  function openCancel(sub: FullSubscription) {
    setSelected(sub);
    setCancelReason("");
    setShowCancel(true);
  }

  async function handleToggleAutoRenew(sub: FullSubscription) {
    try {
      const res = await api.patch<ApiResponse<FullSubscription>>(
        `/v1/super-admin/subscriptions/${sub.id}/toggle-auto-renew`,
        {}
      );
      setSubs((prev) => prev.map((s) => s.id === sub.id ? res.data : s));
      await loadMetrics();
    } catch { /* ignore */ }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      await api.post("/v1/super-admin/subscriptions", {
        organization_id: parseInt(createForm.organization_id),
        plan_id:         parseInt(createForm.plan_id),
        status:          createForm.status,
        ends_at:         createForm.ends_at || null,
        payment_status:  createForm.payment_status,
        auto_renew:      createForm.auto_renew,
        notes:           createForm.notes || null,
      });
      setShowCreate(false);
      setCreateForm(emptyCreate);
      await Promise.all([loadSubs(), loadMetrics()]);
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      setCreateError(e?.data?.message ?? uz.xatolar.server_xato);
    } finally {
      setCreating(false);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setRenewErrors({});
    setRenewing(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${selected.id}/renew`, {
        plan_id:        parseInt(renewForm.plan_id),
        ends_at:        renewForm.ends_at,
        payment_status: renewForm.payment_status,
        notes:          renewForm.notes || null,
      });
      setShowRenew(false);
      await Promise.all([loadSubs(), loadMetrics()]);
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setRenewErrors(e.data.errors);
    } finally {
      setRenewing(false);
    }
  }

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setChangingPlan(true);
    try {
      const res = await api.post<ApiResponse<FullSubscription>>(
        `/v1/super-admin/subscriptions/${selected.id}/change-plan`,
        { plan_id: parseInt(changePlanId), effective_immediately: true }
      );
      setSubs((prev) => prev.map((s) => s.id === selected.id ? res.data : s));
      setShowChangePlan(false);
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setCancelling(true);
    try {
      const res = await api.post<ApiResponse<FullSubscription>>(
        `/v1/super-admin/subscriptions/${selected.id}/cancel`,
        { reason: cancelReason || null }
      );
      setSubs((prev) => prev.map((s) => s.id === selected.id ? res.data : s));
      setShowCancel(false);
      await loadMetrics();
    } finally {
      setCancelling(false);
    }
  }

  function resetFilters() {
    setSearchInput("");
    setAppliedSearch("");
    setFilterStatus("");
    setFilterPlan("");
    setFilterOrg("");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
    setPage(1);
  }

  const hasFilters = appliedSearch || filterStatus || filterPlan || filterOrg || dateFrom || dateTo;

  // ── KPI tiles ─────────────────────────────────────────────────

  const kpiTiles = metrics
    ? [
        { key: "active",    label: uz.super_admin.faol_obunalar,   color: "bg-[#DCFCE7] text-[#166534]", value: metrics.active },
        { key: "trial",     label: uz.super_admin.trial_obunalar,  color: "bg-[#DBEAFE] text-[#1E40AF]", value: metrics.trial },
        { key: "past_due",  label: uz.super_admin.past_due,        color: "bg-[#FEF3C7] text-[#92400E]", value: metrics.past_due },
        { key: "expired",   label: uz.super_admin.tugagan_obunalar,color: "bg-[#FEE2E2] text-[#991B1B]", value: metrics.expired },
        { key: "cancelled", label: uz.super_admin.bekor,           color: "bg-[#F3F4F6] text-[#374151]", value: metrics.cancelled },
      ]
    : [];

  const minDate = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">{uz.super_admin.obunalar}</h1>
          <p className="text-sm text-[#9CA3AF] mt-0.5">Barcha bog&apos;chalar obunalarini boshqaring</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          {uz.super_admin.obuna_qoshish}
        </Button>
      </div>

      {/* KPI tiles */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {kpiTiles.map(({ key, label, color, value }) => (
            <button
              key={key}
              onClick={() => {
                setFilterStatus(filterStatus === key ? "" : key);
                setPage(1);
              }}
              className={`rounded-xl border p-4 text-center transition-all bg-white ${
                filterStatus === key
                  ? "border-[#7C3AED] ring-1 ring-[#7C3AED]"
                  : "border-[#E5E7EB] hover:border-[#D1D5DB]"
              }`}
            >
              <div className={`text-xl font-bold mb-1 px-2 py-1 rounded-lg inline-block ${color}`}>
                {value}
              </div>
              <p className="text-xs text-[#6B7280] mt-1">{label}</p>
            </button>
          ))}
          {/* MRR tile */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-center">
            <div className="text-lg font-bold mb-1 px-2 py-1 rounded-lg inline-block bg-[#EDE9FE] text-[#4C1D95]">
              {(metrics.mrr / 1_000_000).toFixed(1)}M
            </div>
            <p className="text-xs text-[#6B7280] mt-1">{uz.super_admin.mrr}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            label={uz.common.izlash}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Bog'cha nomi..."
          />
          <Select
            label={uz.super_admin.filter_status}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          >
            <option value="">{uz.common.hammasi}</option>
            <option value="active">{uz.super_admin.faol}</option>
            <option value="trial">{uz.super_admin.sinov}</option>
            <option value="past_due">{uz.super_admin.past_due}</option>
            <option value="expired">{uz.super_admin.muddati_tugagan}</option>
            <option value="cancelled">{uz.super_admin.bekor}</option>
          </Select>
          <Select
            label="Tarif bo'yicha"
            value={filterPlan}
            onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
          >
            <option value="">{uz.common.hammasi}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Select
            label={uz.super_admin.tartiblash}
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
          >
            <option value="newest">{uz.super_admin.sort_yangi}</option>
            <option value="oldest">{uz.super_admin.sort_eski}</option>
            <option value="ending_soon">Muddati yaqin</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Select
            label={uz.super_admin.filter_tashkilot}
            value={filterOrg}
            onChange={(e) => { setFilterOrg(e.target.value); setPage(1); }}
          >
            <option value="">{uz.common.hammasi}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
          <Input
            label="Boshlang'ich sana"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <Input
            label="Tugash sanasi"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
        {hasFilters && (
          <div className="mt-3">
            <button
              onClick={resetFilters}
              className="text-sm text-[#6B7280] hover:text-[#374151] border border-[#E5E7EB] px-4 py-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors"
            >
              Filtrlarni tozalash
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : subs.length === 0 ? (
          <EmptyState
            title={uz.common.malumot_yoq}
            description={hasFilters ? "Qidiruv mezonlarini o'zgartiring." : "Hali obuna mavjud emas."}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Bog&apos;cha</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.tarif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Boshlanish</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.tugash}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.qolgan}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.avto_yangilash}</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">{uz.super_admin.amallar}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {subs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] font-bold text-xs flex-shrink-0">
                            {(sub.organization?.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <Link
                            href={`/admin/bogchalar/${sub.organization_id}`}
                            className="font-medium text-[#111827] hover:text-[#7C3AED] transition-colors truncate max-w-[140px]"
                          >
                            {sub.organization?.name ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#6B7280]">
                        {sub.plan?.name ?? "—"}
                        {sub.plan?.price_monthly && (
                          <div className="text-xs text-[#9CA3AF]">
                            {Number(sub.plan.price_monthly).toLocaleString("uz-UZ")} UZS/oy
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={subStatusVariant(sub.status)}>
                          {subStatusLabel(sub.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[#6B7280] text-xs">{fmtDate(sub.starts_at)}</td>
                      <td className="px-5 py-3.5 text-[#6B7280] text-xs">{fmtDate(sub.ends_at)}</td>
                      <td className="px-5 py-3.5">
                        <DaysCell days={sub.days_remaining} status={sub.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleAutoRenew(sub)}
                          title={uz.super_admin.avto_yangilash}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            sub.auto_renew ? "bg-[#7C3AED]" : "bg-[#E5E7EB]"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              sub.auto_renew ? "translate-x-[18px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <div className="relative">
                            <button
                              aria-label="Amallar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === sub.id ? null : sub.id);
                              }}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            {openMenuId === sub.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-8 z-20 w-52 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1"
                              >
                                <button
                                  onClick={() => { setOpenMenuId(null); openDetail(sub); }}
                                  className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC]"
                                >
                                  {uz.super_admin.batafsil}
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); openRenew(sub); }}
                                  className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC]"
                                >
                                  {uz.super_admin.obuna_uzaytirish}
                                </button>
                                {sub.status !== "cancelled" && sub.status !== "expired" && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); openChangePlan(sub); }}
                                    className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC]"
                                  >
                                    {uz.super_admin.tarif_almashtirish}
                                  </button>
                                )}
                                <button
                                  onClick={() => { setOpenMenuId(null); handleToggleAutoRenew(sub); }}
                                  className="w-full text-left px-4 py-2 text-sm text-[#374151] hover:bg-[#F8FAFC]"
                                >
                                  {sub.auto_renew
                                    ? uz.super_admin.avto_yangilash_ochirildi
                                    : uz.super_admin.avto_yangilash_yoqildi}
                                </button>
                                {sub.status !== "cancelled" && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); openCancel(sub); }}
                                    className="w-full text-left px-4 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                                  >
                                    Bekor qilish
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────── */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={uz.super_admin.obuna_batafsil}
        footer={
          <Button variant="secondary" onClick={() => setShowDetail(false)}>
            {uz.common.yopish}
          </Button>
        }
      >
        {detailLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-5 bg-[#F3F4F6] rounded animate-pulse" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-5">
            {/* Org + Plan summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F9FAFB] rounded-lg px-4 py-3">
                <p className="text-xs text-[#9CA3AF] mb-1">Bog&apos;cha</p>
                <p className="text-sm font-medium text-[#111827]">
                  {detail.organization_detail?.name ?? "—"}
                </p>
                {detail.organization_detail?.phone && (
                  <p className="text-xs text-[#6B7280]">{detail.organization_detail.phone}</p>
                )}
              </div>
              <div className="bg-[#F9FAFB] rounded-lg px-4 py-3">
                <p className="text-xs text-[#9CA3AF] mb-1">Tarif</p>
                <p className="text-sm font-medium text-[#111827]">
                  {detail.plan_detail?.name ?? "—"}
                </p>
                {detail.plan_detail && (
                  <p className="text-xs text-[#6B7280]">
                    {Number(detail.plan_detail.price_monthly).toLocaleString("uz-UZ")} {detail.plan_detail.currency}/oy
                  </p>
                )}
              </div>
            </div>

            {/* Status row */}
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant={subStatusVariant(detail.status)}>{subStatusLabel(detail.status)}</Badge>
              <span className="text-sm text-[#6B7280]">
                {uz.super_admin.boshlanish}: {fmtDate(detail.starts_at)}
              </span>
              <span className="text-sm text-[#6B7280]">
                {uz.super_admin.tugash}: {fmtDate(detail.ends_at)}
              </span>
              {detail.auto_renew && (
                <span className="text-xs font-medium text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-full">
                  {uz.super_admin.avto_yangilash}
                </span>
              )}
            </div>

            {/* Payment summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-[#E5E7EB] px-4 py-3 text-center">
                <p className="text-xs text-[#9CA3AF] mb-1">{uz.super_admin.tolov_jami_tulangan}</p>
                <p className="text-base font-bold text-[#059669]">
                  {fmtMoney(detail.payment_summary.total_paid)}
                </p>
              </div>
              <div className="rounded-lg border border-[#E5E7EB] px-4 py-3 text-center">
                <p className="text-xs text-[#9CA3AF] mb-1">{uz.super_admin.kutilayotgan_hisob}</p>
                <p className="text-base font-bold text-[#F59E0B]">
                  {fmtMoney(detail.payment_summary.total_pending)}
                </p>
              </div>
              <div className="rounded-lg border border-[#E5E7EB] px-4 py-3 text-center">
                <p className="text-xs text-[#9CA3AF] mb-1">Oxirgi to&apos;lov</p>
                <p className="text-sm font-medium text-[#374151]">
                  {fmtDate(detail.payment_summary.latest_payment_at)}
                </p>
              </div>
            </div>

            {/* Plan limits */}
            {detail.plan_detail && (
              <div className="bg-[#F9FAFB] rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Tarif chegaralari</p>
                <div className="flex flex-wrap gap-3 text-sm text-[#374151]">
                  {detail.plan_detail.max_children != null && (
                    <span>Max bolalar: <strong>{detail.plan_detail.max_children}</strong></span>
                  )}
                  {detail.plan_detail.max_teachers != null && (
                    <span>Max tarbiyachilar: <strong>{detail.plan_detail.max_teachers}</strong></span>
                  )}
                  {detail.plan_detail.max_groups != null && (
                    <span>Max guruhlar: <strong>{detail.plan_detail.max_groups}</strong></span>
                  )}
                  <span>Sinov: <strong>{detail.plan_detail.trial_days} kun</strong></span>
                </div>
              </div>
            )}

            {/* Recent invoices */}
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                So&apos;nggi invoicelar
              </p>
              {detail.recent_invoices.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">{uz.super_admin.hech_invoice_yoq}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.recent_invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between text-sm py-2 px-3 bg-[#F9FAFB] rounded-lg"
                    >
                      <span className="text-[#6B7280]">{inv.invoice_number}</span>
                      <span className="font-medium">{Number(inv.amount).toLocaleString("uz-UZ")} {inv.currency}</span>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "error" : "warning"}>
                        {inv.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.cancelled_reason && (
              <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-[#991B1B] mb-1">Bekor qilish sababi</p>
                <p className="text-sm text-[#374151]">{detail.cancelled_reason}</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ── Create Modal ──────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(""); setCreateForm(emptyCreate); }}
        title={uz.super_admin.obuna_qoshish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{uz.common.bekor_qilish}</Button>
            <Button
              form="sub-create-form"
              type="submit"
              loading={creating}
              disabled={!createForm.organization_id || !createForm.plan_id}
            >
              {uz.common.saqlash}
            </Button>
          </>
        }
      >
        <form id="sub-create-form" onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <p className="text-sm text-[#EF4444] bg-[#FEF2F2] px-3 py-2 rounded-lg">{createError}</p>
          )}
          <Select
            label="Bog'cha"
            value={createForm.organization_id}
            onChange={(e) => setCreateForm({ ...createForm, organization_id: e.target.value })}
            required
          >
            <option value="">{uz.common.tanlang}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
          <Select
            label={uz.super_admin.tarif}
            value={createForm.plan_id}
            onChange={(e) => setCreateForm({ ...createForm, plan_id: e.target.value })}
            required
          >
            <option value="">{uz.common.tanlang}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>
          <Select
            label={uz.super_admin.holat}
            value={createForm.status}
            onChange={(e) => setCreateForm({ ...createForm, status: e.target.value, ends_at: "" })}
          >
            <option value="trial">{uz.super_admin.sinov}</option>
            <option value="active">{uz.super_admin.faol}</option>
          </Select>
          {createForm.status === "active" && (
            <Input
              label={uz.super_admin.yangi_tugash}
              type="date"
              value={createForm.ends_at}
              onChange={(e) => setCreateForm({ ...createForm, ends_at: e.target.value })}
              min={minDate}
              required
            />
          )}
          <Select
            label={uz.super_admin.tolov_holati}
            value={createForm.payment_status}
            onChange={(e) => setCreateForm({ ...createForm, payment_status: e.target.value })}
          >
            <option value="pending">Kutilmoqda</option>
            <option value="paid">To&apos;langan</option>
          </Select>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateForm({ ...createForm, auto_renew: !createForm.auto_renew })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                createForm.auto_renew ? "bg-[#7C3AED]" : "bg-[#E5E7EB]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  createForm.auto_renew ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
            <span className="text-sm text-[#374151]">{uz.super_admin.avto_yangilash}</span>
          </div>
          <Input
            label={uz.super_admin.eslatma}
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            placeholder="Ixtiyoriy izoh..."
          />
        </form>
      </Modal>

      {/* ── Renew Modal ───────────────────────────────────────────── */}
      <Modal
        open={showRenew}
        onClose={() => { setShowRenew(false); setRenewErrors({}); }}
        title={uz.super_admin.obuna_uzaytirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRenew(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="sub-renew-form" type="submit" loading={renewing}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="sub-renew-form" onSubmit={handleRenew} className="space-y-4">
          {selected?.organization && (
            <div className="px-4 py-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-xs text-[#9CA3AF] mb-1">Bog&apos;cha</p>
              <p className="text-sm font-medium text-[#111827]">{selected.organization.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.tarif}
            value={renewForm.plan_id}
            onChange={(e) => setRenewForm({ ...renewForm, plan_id: e.target.value })}
            error={renewErrors.plan_id?.[0]}
            required
          >
            <option value="">{uz.common.tanlang}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>
          <Input
            label={uz.super_admin.yangi_tugash}
            type="date"
            value={renewForm.ends_at}
            onChange={(e) => setRenewForm({ ...renewForm, ends_at: e.target.value })}
            min={minDate}
            error={renewErrors.ends_at?.[0]}
            required
          />
          <Select
            label={uz.super_admin.tolov_holati}
            value={renewForm.payment_status}
            onChange={(e) => setRenewForm({ ...renewForm, payment_status: e.target.value })}
          >
            <option value="paid">To&apos;langan</option>
            <option value="pending">Kutilmoqda</option>
          </Select>
          <Input
            label={uz.super_admin.eslatma}
            value={renewForm.notes}
            onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
            placeholder="Ixtiyoriy izoh..."
          />
        </form>
      </Modal>

      {/* ── Change Plan Modal ─────────────────────────────────────── */}
      <Modal
        open={showChangePlan}
        onClose={() => setShowChangePlan(false)}
        title={uz.super_admin.tarif_almashtirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangePlan(false)}>{uz.common.bekor_qilish}</Button>
            <Button
              form="sub-change-plan-form"
              type="submit"
              loading={changingPlan}
              disabled={!changePlanId || changePlanId === String(selected?.plan_id)}
            >
              {uz.common.saqlash}
            </Button>
          </>
        }
      >
        <form id="sub-change-plan-form" onSubmit={handleChangePlan} className="space-y-4">
          {selected?.plan && (
            <div className="px-4 py-3 bg-[#F9FAFB] rounded-lg">
              <p className="text-xs text-[#9CA3AF] mb-1">{uz.super_admin.joriy_tarif}</p>
              <p className="text-sm font-medium text-[#111827]">{selected.plan.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.yangi_tarif}
            value={changePlanId}
            onChange={(e) => setChangePlanId(e.target.value)}
            required
          >
            <option value="">{uz.common.tanlang}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>
          <p className="text-xs text-[#9CA3AF]">{uz.super_admin.darhol} kuchga kiradi</p>
        </form>
      </Modal>

      {/* ── Cancel Modal ──────────────────────────────────────────── */}
      <Modal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title="Obunani bekor qilish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancel(false)}>{uz.common.bekor_qilish}</Button>
            <Button
              form="sub-cancel-form"
              type="submit"
              loading={cancelling}
              variant="danger"
            >
              Bekor qilish
            </Button>
          </>
        }
      >
        <form id="sub-cancel-form" onSubmit={handleCancel} className="space-y-4">
          {selected?.organization && (
            <p className="text-sm text-[#6B7280]">
              <strong className="text-[#111827]">{selected.organization.name}</strong> obunasini bekor
              qilmoqchimisiz?
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {uz.super_admin.bekor_qilish_sababi} (ixtiyoriy)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Sabab..."
              className="w-full px-3.5 py-2.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
