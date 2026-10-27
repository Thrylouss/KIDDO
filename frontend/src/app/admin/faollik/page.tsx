"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo-data";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import uz from "@/i18n/uz";
import type { ActivityLogEntry, OrganizationSummary, ApiResponse, PaginatedResponse } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function actionColor(action: string): string {
  if (action.includes("created"))    return "bg-[#F0FDF4] text-[#166534]";
  if (action.includes("deleted"))    return "bg-[#FEF2F2] text-[#991B1B]";
  if (action.includes("deactivated"))return "bg-[#FEF2F2] text-[#B45309]";
  if (action.includes("entered"))    return "bg-[#FDF2F6] text-[#742548]";
  if (action.includes("sent"))       return "bg-[#FDF2F6] text-[#742548]";
  if (action.includes("renewed"))    return "bg-[#F0FDF4] text-[#166534]";
  if (action.includes("cancelled"))  return "bg-[#FFF7ED] text-[#B45309]";
  return "bg-[#F2ECF0] text-[#3D3240]";
}

// ── Pagination ─────────────────────────────────────────────────────────────

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
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#EDE3E8]">
      <p className="text-sm text-[#766B73]">Jami {meta.total} ta</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(meta.current_page - 1)}
          disabled={meta.current_page === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#EDE3E8] text-[#3D3240] disabled:opacity-40 hover:bg-[#FFF9F5] transition-colors"
        >
          Oldingi
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              p === meta.current_page
                ? "bg-[#8E315D] text-white"
                : "border border-[#EDE3E8] text-[#3D3240] hover:bg-[#FFF9F5]"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(meta.current_page + 1)}
          disabled={meta.current_page === meta.last_page}
          className="px-3 py-1.5 text-sm rounded-lg border border-[#EDE3E8] text-[#3D3240] disabled:opacity-40 hover:bg-[#FFF9F5] transition-colors"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FaollikPage() {
  const [logs,    setLogs]    = useState<ActivityLogEntry[]>([]);
  const [orgs,    setOrgs]    = useState<OrganizationSummary[]>([]);
  const [meta,    setMeta]    = useState({ current_page: 1, last_page: 1, total: 0, per_page: 30 });
  const [loading, setLoading] = useState(true);

  const [filterOrg, setFilterOrg] = useState("");
  const [page,      setPage]      = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "30" });
      if (filterOrg) params.set("organization_id", filterOrg);

      const [logRes, orgRes] = await Promise.all([
        api.get<PaginatedResponse<ActivityLogEntry>>(`/v1/super-admin/activity-logs?${params}`),
        orgs.length === 0
          ? api.get<ApiResponse<OrganizationSummary[]>>("/v1/super-admin/organizations")
          : Promise.resolve(null),
      ]);
      setLogs(logRes.data);
      setMeta(logRes.meta);
      if (orgRes) setOrgs((orgRes as ApiResponse<OrganizationSummary[]>).data);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterOrg]);

  useEffect(() => { load(); }, [load]);

  const logIcon = (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#29232A]">{uz.super_admin.faollik}</h1>
        <p className="text-sm text-[#B8AAB2] mt-0.5">{uz.super_admin.faollik_tavsif}</p>
      </div>

      {IS_DEMO && (
        <div data-testid="demo-banner" className="flex items-center gap-2.5 rounded-xl bg-[#FDF2F6] border border-[#EDE3E8] px-4 py-3 text-sm text-[#742548]">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span><strong>Demo rejimi</strong> — ma&apos;lumotlar saqlanmaydi, amallar simulyatsiya qilinadi.</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select
              label={uz.super_admin.bogcha_filtri}
              value={filterOrg}
              onChange={(e) => { setFilterOrg(e.target.value); setPage(1); }}
            >
              <option value="">{uz.common.hammasi}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          </div>
          {filterOrg && (
            <button
              onClick={() => { setFilterOrg(""); setPage(1); }}
              className="px-4 py-2 text-sm text-[#766B73] hover:text-[#3D3240] border border-[#EDE3E8] rounded-lg hover:bg-[#FFF9F5] transition-colors"
            >
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#F2ECF0]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-36 bg-[#F2ECF0] rounded" />
                <div className="h-4 w-48 bg-[#F2ECF0] rounded" />
                <div className="h-4 w-24 bg-[#F2ECF0] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16">
            <EmptyState title={uz.super_admin.faollik_yoq} icon={logIcon} />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF5F8] border-b border-[#EDE3E8]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.sana}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.amal}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.tavsif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">Bog&apos;cha</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden lg:table-cell">Foydalanuvchi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECF0]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF5F8] transition-colors">
                      <td className="px-5 py-3.5 text-xs text-[#B8AAB2] whitespace-nowrap">
                        {fmtDate(log.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#3D3240] max-w-xs truncate">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5 text-[#766B73] hidden lg:table-cell">
                        {log.organization?.name ?? <span className="text-[#D9C9D1]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[#766B73] hidden lg:table-cell">
                        {log.user?.name ?? <span className="text-[#D9C9D1]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F2ECF0]">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-[#B8AAB2] flex-shrink-0">{fmtDate(log.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#3D3240]">{log.description}</p>
                  <div className="flex items-center gap-2 text-xs text-[#B8AAB2]">
                    {log.organization && <span>{log.organization.name}</span>}
                    {log.organization && log.user && <span>·</span>}
                    {log.user && <span>{log.user.name}</span>}
                  </div>
                </div>
              ))}
            </div>

            <Pagination meta={meta} onPage={(p) => setPage(p)} />
          </>
        )}
      </div>
    </div>
  );
}
