import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_VARIANT, TYPE_LABELS, formatDate, orgStatus } from "@/lib/organizations";
import uz from "@/i18n/uz";
import type { OrganizationSummary } from "@/types";

export function OrgTypeBadge({ type }: { type: OrganizationSummary["type"] }) {
  if (!type) return <span className="text-xs text-[#B8AAB2]">{uz.bogchalar.turi_yoq}</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${type === "davlat" ? "bg-[#EEF2FF] text-[#3730A3]" : "bg-[#FDF2F6] text-[#8E315D]"}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

export function OrgStatusBadge({ org }: { org: Pick<OrganizationSummary, "status" | "is_active" | "suspended_until"> }) {
  const s = orgStatus(org);
  return (
    <span className="inline-flex flex-col">
      <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABELS[s]}</Badge>
      {s === "suspended" && org.suspended_until && (
        <span className="mt-0.5 text-[11px] text-[#92400E]">{formatDate(org.suspended_until)} {uz.bogchalar.toxtatilgan_gacha}</span>
      )}
    </span>
  );
}
