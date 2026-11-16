"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fetchAllPages } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import uz, { intlLocale } from "@/i18n";
import type { ActivityLogEntry, OrganizationSummary, PaginatedResponse } from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function actionColor(action: string): string {
  if (action.includes("created"))    return "bg-[var(--success-soft)] text-[var(--success)]";
  if (action.includes("deleted"))    return "bg-[var(--error-soft)] text-[var(--error)]";
  if (action.includes("deactivated"))return "bg-[var(--error-soft)] text-[var(--warning-text)]";
  if (action.includes("entered"))    return "bg-[var(--primary-lt)] text-[var(--primary-h)]";
  if (action.includes("sent"))       return "bg-[var(--primary-lt)] text-[var(--primary-h)]";
  if (action.includes("renewed"))    return "bg-[var(--success-soft)] text-[var(--success)]";
  if (action.includes("cancelled"))  return "bg-[var(--warning-soft)] text-[var(--warning-text)]";
  return "bg-[var(--border-2)] text-[var(--label)]";
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FaollikPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [logs,    setLogs]    = useState<ActivityLogEntry[]>([]);
  const [orgs,    setOrgs]    = useState<OrganizationSummary[]>([]);
  const [meta,    setMeta]    = useState({ current_page: 1, last_page: 1, total: 0, per_page: 30 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [orgsError, setOrgsError] = useState(false);

  const [filterOrg, setFilterOrg] = useState("");
  const [page,      setPage]      = useState(1);

  // Filtr uchun barcha bog'chalar (sahifalab, per_page=100) — bir marta
  useEffect(() => {
    fetchAllPages<OrganizationSummary>("/v1/super-admin/organizations?sort=name")
      .then(setOrgs)
      .catch(() => setOrgsError(true));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "30" });
      if (filterOrg) params.set("organization_id", filterOrg);

      const logRes = await api.get<PaginatedResponse<ActivityLogEntry>>(`/v1/super-admin/activity-logs?${params}`);
      setLogs(logRes?.data ?? []);
      if (logRes?.meta) setMeta(logRes.meta);
    } catch (err) {
      setLogs([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-[var(--text)]">{uz.super_admin.faollik}</h1>
        <p className="text-sm text-[var(--text-3)] mt-0.5">{uz.super_admin.faollik_tavsif}</p>
      </div>

      {IS_DEMO && (
        <div data-testid="demo-banner" className="flex items-center gap-2.5 rounded-xl bg-[var(--primary-lt)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--primary-h)]">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span><strong>{uz.matn.demo_rejimi_2}</strong> {uz.matn.malumotlar_saqlanmaydi_amallar_simulyats}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
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
              className="px-4 py-2 text-sm text-[var(--text-2)] hover:text-[var(--label)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              {uz.matn.tozalash}
            </button>
          )}
        </div>
        {orgsError && <p role="alert" className="mt-2 text-xs text-[var(--warning-text)]">{uz.common.bogchalar_yuklanmadi}</p>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="animate-pulse divide-y divide-[var(--border-2)]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-36 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-48 bg-[var(--border-2)] rounded" />
                <div className="h-4 w-24 bg-[var(--border-2)] rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" data-testid="faollik-error" className="py-12 px-5 text-center">
            <p className="text-sm text-[var(--error-text)]">{error}</p>
            <button onClick={load} className="mt-3 px-4 py-2 text-sm font-medium text-[var(--primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--hover)] transition-colors">
              {uz.common.qayta_urinish}
            </button>
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
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.sana}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.amal}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">{uz.super_admin.tavsif}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide hidden lg:table-cell">{uz.matn.bogcha}</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide hidden lg:table-cell">{uz.matn.foydalanuvchi}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-2)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-5 py-3.5 text-xs text-[var(--text-3)] whitespace-nowrap">
                        {fmtDate(log.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--label)] max-w-xs truncate">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-2)] hidden lg:table-cell">
                        {log.organization?.name ?? <span className="text-[var(--border-strong)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-2)] hidden lg:table-cell">
                        {log.user?.name ?? <span className="text-[var(--border-strong)]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[var(--border-2)]">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-[var(--text-3)] flex-shrink-0">{fmtDate(log.created_at)}</span>
                  </div>
                  <p className="text-sm text-[var(--label)]">{log.description}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
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
