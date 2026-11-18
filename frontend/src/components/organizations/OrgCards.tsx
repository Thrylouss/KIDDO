"use client";

import Link from "next/link";
import { formatDate, formatUzPhone, orgAddress } from "@/lib/organizations";
import OrgActionsMenu, { type OrgActionHandlers } from "./OrgActionsMenu";
import { OrgStatusBadge, OrgTypeBadge } from "./OrgBadges";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n";
import type { OrganizationSummary } from "@/types";

const t = uz.bogchalar;

/** Kartochka ko'rinishi — jadval bilan bir xil ma'lumot (bitta API javobi). */
export default function OrgCards({ orgs, selected, onToggle, handlers }: {
  orgs: OrganizationSummary[]; selected: Set<number>; onToggle: (id: number) => void; handlers: OrgActionHandlers;
}) {
  return (
    <ul data-testid="org-cards" className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {orgs.map((org) => {
        const address = orgAddress(org);
        const phone = org.phone ?? org.director_phone;
        return (
          <li key={org.id} className={`min-w-0 flex flex-col rounded-2xl border bg-white p-5 transition hover:shadow-[0_12px_30px_-18px_rgba(142,49,93,0.35)]
            ${selected.has(org.id) ? "border-[var(--primary)]" : "border-[var(--border)]"}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" aria-label={`${t.tanlash}: ${org.name}`} checked={selected.has(org.id)} onChange={() => onToggle(org.id)}
                className="mt-1 h-4 w-4 accent-[var(--primary)]" />
              <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-[var(--primary-lt)] flex items-center justify-center text-[var(--primary)] font-semibold" aria-hidden="true">
                {org.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/bogchalar/${org.id}`} className="block font-semibold leading-snug text-[var(--text)] hover:text-[var(--primary)] line-clamp-2" title={org.name}>
                  {org.name}
                </Link>
                {(org.number || org.official_code) && (
                  <p className="mt-0.5 text-xs text-[var(--text-3)] truncate">
                    {[org.number && `${t.raqami_qisqa} ${org.number}`, org.official_code].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <OrgTypeBadge type={org.type} />
                  <OrgStatusBadge org={org} />
                  {org.is_demo && <Badge variant="warning">{uz.super_admin.dev_belgi}</Badge>}
                </div>
              </div>
              <OrgActionsMenu org={org} handlers={handlers} />
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex gap-2"><dt className="w-24 flex-shrink-0 text-[var(--text-3)]">{t.col_masul}</dt>
                <dd className="truncate text-[var(--label)]" title={org.director_name ?? ""}>{org.director_name ?? org.admin?.name ?? "—"}</dd></div>
              <div className="flex gap-2"><dt className="w-24 flex-shrink-0 text-[var(--text-3)]">{t.col_telefon}</dt>
                <dd>{phone ? <a href={`tel:${phone}`} className="text-[var(--label)] hover:text-[var(--primary)]">{formatUzPhone(phone)}</a> : "—"}</dd></div>
              <div className="flex gap-2"><dt className="w-24 flex-shrink-0 text-[var(--text-3)]">{t.col_manzil}</dt>
                <dd className="line-clamp-2 text-[var(--text-2)]" title={address}>{address || "—"}</dd></div>
            </dl>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-2)] p-2 text-center">
              {[[t.col_bolalar, org.children_count], [t.col_guruhlar, org.groups_count], [t.col_tarbiyachilar, org.teachers_count]].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-lg font-bold text-[var(--text)] tabular-nums">{(value as number | null) ?? "—"}</p>
                  <p className="text-[11px] text-[var(--text-2)] truncate">{label as string}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-[var(--text-3)]">{t.royxatdan_otgan}: {formatDate(org.created_at)}</span>
              <Link href={`/admin/bogchalar/${org.id}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">{t.batafsil} →</Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
