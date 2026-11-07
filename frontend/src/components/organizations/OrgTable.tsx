"use client";

import Link from "next/link";
import { formatDate, formatUzPhone, orgAddress } from "@/lib/organizations";
import OrgActionsMenu, { type OrgActionHandlers } from "./OrgActionsMenu";
import { OrgStatusBadge, OrgTypeBadge } from "./OrgBadges";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type { OrganizationSummary } from "@/types";

const t = uz.bogchalar;

/** Ustun sarlavhasi → backend sort qiymati (null — saralanmaydi). */
const COLUMNS: { label: string; sort: string | null; cls?: string; align?: "right" }[] = [
  { label: t.col_n,             sort: null, cls: "w-12" },
  { label: t.col_nomi,          sort: "name", cls: "min-w-[220px]" },
  { label: t.col_turi,          sort: "type" },
  { label: t.col_masul,         sort: null, cls: "min-w-[160px]" },
  { label: t.col_telefon,       sort: null },
  { label: t.col_manzil,        sort: null, cls: "min-w-[180px]" },
  { label: t.col_tuman_mfy,     sort: "district", cls: "min-w-[150px]" },
  { label: t.col_bolalar,       sort: "children_count", align: "right" },
  { label: t.col_guruhlar,      sort: "groups_count", align: "right" },
  { label: t.col_tarbiyachilar, sort: "teachers_count", align: "right" },
  { label: t.col_holat,         sort: "status" },
  { label: t.col_sana,          sort: "created_at" },
  { label: t.col_amallar,       sort: null },
];

interface Props {
  orgs: OrganizationSummary[];
  offset: number;
  sort: string;
  direction: "" | "asc" | "desc";
  onSort: (sort: string, direction: "asc" | "desc") => void;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  handlers: OrgActionHandlers;
}

/** Ustun saralash holati: «newest/oldest/name...» kabi tayyor saralashlar ham sarlavhada ko'rinadi. */
function sortState(col: string, sort: string, direction: string): "asc" | "desc" | null {
  if (sort === col) return direction === "asc" ? "asc" : direction === "desc" ? "desc" : (["name", "type", "district"].includes(col) ? "asc" : "desc");
  if (col === "created_at" && (sort === "newest" || sort === "oldest")) return sort === "oldest" ? "asc" : "desc";
  if (col === "name" && (sort === "name_desc")) return "desc";
  if (col === "children_count" && sort.startsWith("children_")) return sort === "children_asc" ? "asc" : "desc";
  return null;
}

export default function OrgTable({ orgs, offset, sort, direction, onSort, selected, onToggle, onToggleAll, handlers }: Props) {
  const allChecked = orgs.length > 0 && orgs.every((o) => selected.has(o.id));
  const th = "px-3 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide whitespace-nowrap";

  return (
    <div className="overflow-x-auto" data-testid="org-table">
      <table className="w-full min-w-[1180px] text-sm">
        <thead>
          <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
            <th className="pl-4 pr-1 py-3 w-8">
              <input type="checkbox" aria-label={t.hammasini_tanlash} checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)}
                className="h-4 w-4 accent-[#8E315D]" />
            </th>
            {COLUMNS.map((c) => {
              const state = c.sort ? sortState(c.sort, sort, direction) : null;
              return (
                <th key={c.label} scope="col" aria-sort={state === "asc" ? "ascending" : state === "desc" ? "descending" : undefined}
                  className={`${th} ${c.align === "right" ? "text-right" : "text-left"} ${c.cls ?? ""}`}>
                  {c.sort ? (
                    <button type="button" onClick={() => onSort(c.sort!, state === "asc" ? "desc" : "asc")}
                      className={`inline-flex items-center gap-1 uppercase hover:text-[#29232A] focus-visible:outline-none focus-visible:underline ${state ? "text-[#8E315D]" : ""}`}>
                      {c.label}
                      <span aria-hidden="true" className="text-[10px]">{state === "asc" ? "▲" : state === "desc" ? "▼" : "↕"}</span>
                    </button>
                  ) : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2ECF0]">
          {orgs.map((org, i) => {
            const address = orgAddress(org);
            return (
              <tr key={org.id} className={`hover:bg-[#FAF5F8] transition-colors ${selected.has(org.id) ? "bg-[#FDF2F6]/60" : ""}`}>
                <td className="pl-4 pr-1 py-3">
                  <input type="checkbox" aria-label={`${t.tanlash}: ${org.name}`} checked={selected.has(org.id)} onChange={() => onToggle(org.id)}
                    className="h-4 w-4 accent-[#8E315D]" />
                </td>
                <td className="px-3 py-3 text-[#B8AAB2] tabular-nums">{offset + i + 1}</td>
                <td className="px-3 py-3 max-w-[280px]">
                  <Link href={`/admin/bogchalar/${org.id}`} title={org.name} className="block truncate font-medium text-[#29232A] hover:text-[#8E315D]">{org.name}</Link>
                  <span className="flex items-center gap-1.5">
                    {org.official_code && <span className="text-xs text-[#B8AAB2] truncate" title={org.official_code}>{org.official_code}</span>}
                    {org.is_demo && <span data-testid={`dev-${org.id}`}><Badge variant="warning">{uz.super_admin.dev_belgi}</Badge></span>}
                  </span>
                </td>
                <td className="px-3 py-3"><OrgTypeBadge type={org.type} /></td>
                <td className="px-3 py-3 max-w-[200px]">
                  {org.director_name || org.admin ? (
                    <span className="block truncate text-[#3D3240]" title={org.director_name ?? org.admin?.name ?? ""}>{org.director_name ?? org.admin?.name}</span>
                  ) : <span className="text-[#D9C9D1]">{uz.super_admin.admin_yoq}</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {org.phone || org.director_phone ? (
                    <a href={`tel:${org.phone ?? org.director_phone}`} className="text-[#3D3240] hover:text-[#8E315D]" title={t.qongiroq}>
                      {formatUzPhone(org.phone ?? org.director_phone)}
                    </a>
                  ) : <span className="text-[#D9C9D1]">—</span>}
                </td>
                <td className="px-3 py-3 max-w-[240px]"><span className="block truncate text-[#766B73]" title={address}>{address || "—"}</span></td>
                <td className="px-3 py-3 max-w-[180px]">
                  <span className="block truncate text-[#3D3240]" title={org.district ?? ""}>{org.district ?? "—"}</span>
                  {org.mfy && <span className="block truncate text-xs text-[#B8AAB2]" title={org.mfy}>{org.mfy}</span>}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-[#29232A] tabular-nums">{org.children_count ?? "—"}</td>
                <td className="px-3 py-3 text-right text-[#3D3240] tabular-nums">{org.groups_count ?? "—"}</td>
                <td className="px-3 py-3 text-right text-[#3D3240] tabular-nums">{org.teachers_count ?? "—"}</td>
                <td className="px-3 py-3"><OrgStatusBadge org={org} /></td>
                <td className="px-3 py-3 whitespace-nowrap text-[#766B73] tabular-nums">{formatDate(org.created_at)}</td>
                <td className="px-3 py-3 text-right"><OrgActionsMenu org={org} handlers={handlers} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
