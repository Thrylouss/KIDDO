"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, downloadFile, impersonation } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import {
  DEFAULT_FILTERS, copyText, filtersFromParams, filtersToQuery, orgAddress, orgClipboardText,
  activeFilterCount, type OrgFilters,
} from "@/lib/organizations";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import OrgStatsCards from "@/components/organizations/OrgStatsCards";
import OrgFiltersBar from "@/components/organizations/OrgFiltersBar";
import OrgTable from "@/components/organizations/OrgTable";
import OrgCards from "@/components/organizations/OrgCards";
import OrgFormModal from "@/components/organizations/OrgFormModal";
import OrgStatusDialog from "@/components/organizations/OrgStatusDialog";
import OrgDeleteDialog from "@/components/organizations/OrgDeleteDialog";
import OrgBulkStatusDialog from "@/components/organizations/OrgBulkStatusDialog";
import type { OrgActionHandlers } from "@/components/organizations/OrgActionsMenu";
import uz from "@/i18n/uz";
import type { OrganizationSummary, OrgFilterOptions, OrgStats, OrgStatus } from "@/types";

const t = uz.bogchalar;
const VIEW_KEY = "kiddo.bogchalar.view";

interface Meta { current_page: number; last_page: number; per_page: number; total: number }

const orgIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

/** Ko'rinish: URL (?view=cards) ustun, bo'lmasa — foydalanuvchining oxirgi tanlovi (localStorage). */
function readView(params: URLSearchParams): "table" | "cards" {
  const v = params.get("view");
  if (v === "cards" || v === "table") return v;
  try { return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table"; } catch { return "table"; }
}

export default function BogchalarPage() {
  const router = useRouter();
  const toast  = useToast();

  // Filtrlar URL'da (sahifa yangilanganda tiklanadi). Mount'dan keyin o'qiladi — SSR bilan mos bo'lsin
  const [filters, setFilters] = useState<OrgFilters>(DEFAULT_FILTERS);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");

  const [orgs, setOrgs]       = useState<OrganizationSummary[]>([]);
  const [meta, setMeta]       = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [stats, setStats]     = useState<OrgStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [options, setOptions] = useState<OrgFilterOptions>({ districts: [], regions: [], mfys: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen]   = useState(false);
  const [editOrg, setEditOrg]     = useState<OrganizationSummary | null>(null);
  const [statusOrg, setStatusOrg] = useState<OrganizationSummary | null>(null);
  const [statusPreset, setStatusPreset] = useState<OrgStatus | undefined>(undefined);
  const [deleteOrg, setDeleteOrg] = useState<OrganizationSummary | null>(null);
  const [bulkAction, setBulkAction] = useState<"archived" | "active" | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(filtersFromParams(params));
    setView(readView(params));
    setReady(true);
  }, []);

  const loadOrgs = useCallback(async (f: OrgFilters) => {
    const id = ++reqId.current;
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<{ data: OrganizationSummary[]; meta: Meta }>(`/v1/super-admin/organizations?${filtersToQuery(f, { forApi: true })}`);
      if (id !== reqId.current) return; // eskirgan javob (tez filtr almashtirish)
      setOrgs(Array.isArray(res?.data) ? res.data : []);
      setMeta(res?.meta ?? null);
    } catch {
      if (id === reqId.current) setError(true);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (turi: OrgFilters["turi"]) => {
    setStatsLoading(true);
    try {
      const res = await api.get<{ data: OrgStats }>(`/v1/super-admin/organizations/stats?turi=${turi}`);
      setStats(res?.data && typeof res.data.total === "number" ? res.data : null);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { if (ready) loadOrgs(filters); }, [ready, filters, loadOrgs]);
  useEffect(() => { if (ready) loadStats(filters.turi); }, [ready, filters.turi, loadStats]);
  useEffect(() => {
    api.get<{ data: OrgFilterOptions }>("/v1/super-admin/organizations/filter-options")
      .then((r) => { if (Array.isArray(r?.data?.districts)) setOptions(r.data); }).catch(() => {});
  }, []);

  // URL bilan sinxron (history'ni to'ldirmasdan)
  useEffect(() => {
    if (!ready) return;
    const q = filtersToQuery(filters);
    if (view === "cards") q.set("view", "cards");
    const qs = q.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [ready, filters, view]);

  const update = useCallback((patch: Partial<OrgFilters>) => {
    setFilters((p) => ({ ...p, ...patch, page: "page" in patch ? patch.page! : 1 }));
  }, []);

  function changeView(v: "table" | "cards") {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* saqlanmasa ham ishlaydi */ }
  }

  const refresh = useCallback(() => { loadOrgs(filters); loadStats(filters.turi); }, [filters, loadOrgs, loadStats]);

  // ── Amallar ──────────────────────────────────────────────────────
  const handlers: OrgActionHandlers = useMemo(() => ({
    onEdit: (org) => { setEditOrg(org); setFormOpen(true); },
    onStatus: (org) => { setStatusPreset(undefined); setStatusOrg(org); },
    onDelete: (org) => setDeleteOrg(org),
    onEnter: async (org) => {
      try {
        await api.post(`/v1/super-admin/organizations/${org.id}/enter`, {});
        impersonation.start(org.id, org.name);
        router.push("/bogcha/dashboard");
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    onCopyInfo: async (org) => {
      if (await copyText(orgClipboardText(org))) toast.success(t.nusxalandi);
      else toast.error(t.nusxa_xato);
    },
    onCopyAddress: async (org) => {
      const a = orgAddress(org);
      if (a && await copyText(a)) toast.success(t.nusxalandi);
      else toast.error(t.nusxa_xato);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [router]);

  async function exportExcel(onlySelected: boolean) {
    setExporting(true);
    try {
      const qs = filtersToQuery(filters, { forApi: true });
      qs.delete("page"); qs.delete("per_page");
      if (onlySelected) qs.set("ids", [...selected].join(","));
      await downloadFile(`/v1/super-admin/organizations/export?${qs}`, "bogchalar.xlsx");
      toast.success(t.eksport_tayyor);
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? t.eksport_xato);
    } finally {
      setExporting(false);
    }
  }

  function toggle(id: number) {
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll(checked: boolean) {
    setSelected((p) => { const n = new Set(p); orgs.forEach((o) => (checked ? n.add(o.id) : n.delete(o.id))); return n; });
  }

  const filtered = activeFilterCount(filters) > 0;
  const offset = meta ? (meta.current_page - 1) * meta.per_page : 0;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title={t.sarlavha}
        description={t.tavsif}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportExcel(false)} loading={exporting} disabled={!meta?.total}>{t.eksport}</Button>
            <Button variant="secondary" onClick={() => router.push("/admin/bogchalar/import")} icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }>{t.import}</Button>
            <Button onClick={() => { setEditOrg(null); setFormOpen(true); }} icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }>{t.qoshish}</Button>
          </div>
        }
      />

      <OrgStatsCards stats={stats} loading={statsLoading} filters={filters} onApply={update} />

      <OrgFiltersBar filters={filters} districts={options.districts} regions={options.regions} mfys={options.mfys} onChange={update}
        onReset={() => setFilters({ ...DEFAULT_FILTERS, per_page: filters.per_page, sort: filters.sort, direction: filters.direction })} />

      {/* Ko'rinish va tanlov */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-[#766B73]" aria-live="polite">
          {meta ? <><span className="font-semibold text-[#29232A]">{meta.total}</span> {t.natija}</> : " "}
        </p>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#FDF2F6] px-3 py-1.5 text-sm text-[#8E315D]">
            <span className="font-medium">{selected.size} {t.tanlangan}</span>
            <button type="button" onClick={() => exportExcel(true)} disabled={exporting} className="font-semibold hover:underline disabled:opacity-50">{t.eksport_tanlangan}</button>
            <button type="button" onClick={() => setBulkAction("archived")} className="font-semibold hover:underline">{t.ommaviy_arxiv}</button>
            <button type="button" onClick={() => setBulkAction("active")} className="font-semibold hover:underline">{t.ommaviy_tiklash}</button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-[#766B73] hover:underline">{t.tanlovni_bekor}</button>
          </div>
        )}
        <div role="group" aria-label={t.korinish} className="ml-auto inline-flex rounded-lg border border-[#EDE3E8] bg-white p-0.5">
          {(["table", "cards"] as const).map((v) => (
            <button key={v} type="button" onClick={() => changeView(v)} aria-pressed={view === v}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === v ? "bg-[#8E315D] text-white" : "text-[#766B73] hover:text-[#29232A]"}`}>
              {v === "table" ? t.jadval : t.kartochka}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {loading && orgs.length === 0 ? (
          <SkeletonTable rows={6} />
        ) : error ? (
          <EmptyState title={uz.common.yuklash_xatosi} icon={orgIcon} action={{ label: uz.common.qayta_urinish, onClick: () => loadOrgs(filters) }} />
        ) : orgs.length === 0 ? (
          <EmptyState icon={orgIcon}
            title={filtered ? t.topilmadi : t.bosh}
            description={filtered ? t.topilmadi_tavsif : t.bosh_tavsif}
            action={filtered
              ? { label: t.filtr_tozalash, onClick: () => setFilters({ ...DEFAULT_FILTERS, per_page: filters.per_page }) }
              : { label: `+ ${t.qoshish}`, onClick: () => { setEditOrg(null); setFormOpen(true); } }} />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""} aria-busy={loading || undefined}>
            {view === "table" ? (
              <OrgTable orgs={orgs} offset={offset} sort={filters.sort} direction={filters.direction}
                onSort={(sort, direction) => update({ sort, direction })}
                selected={selected} onToggle={toggle} onToggleAll={toggleAll} handlers={handlers} />
            ) : (
              <OrgCards orgs={orgs} selected={selected} onToggle={toggle} handlers={handlers} />
            )}
            {meta && <Pagination meta={meta} onPage={(page) => update({ page })} />}
          </div>
        )}
      </div>

      <OrgFormModal open={formOpen} org={editOrg} onClose={() => setFormOpen(false)}
        onSaved={() => { toast.success(editOrg ? t.f_saqlandi : t.f_yaratildi); refresh(); }}
        onOpenProfile={(id) => router.push(`/admin/bogchalar/${id}`)} />

      <OrgStatusDialog org={statusOrg} initialStatus={statusPreset} onClose={() => setStatusOrg(null)}
        onChanged={() => { toast.success(t.holat_ozgardi); refresh(); }} />

      <OrgBulkStatusDialog action={bulkAction} ids={[...selected]} onClose={() => setBulkAction(null)}
        onDone={(r) => {
          toast.success(`${t.ommaviy_natija}: ${r.changed.length}${r.skipped.length ? `, ${r.skipped.length} ${t.ommaviy_otkazildi}` : ""}`);
          setSelected(new Set());
          refresh();
        }} />

      <OrgDeleteDialog org={deleteOrg} onClose={() => setDeleteOrg(null)}
        onDeleted={(id) => { toast.success(t.ochirildi); setSelected((p) => { const n = new Set(p); n.delete(id); return n; }); refresh(); }}
        onArchive={(org) => { setStatusPreset("archived"); setStatusOrg(org); }} />
    </div>
  );
}
