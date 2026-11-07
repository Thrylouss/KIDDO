"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { STATUS_LABELS, formatDate, formatUzPhone } from "@/lib/organizations";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";
import type {
  AttendanceTotals, OrgActivity, OrgChildrenSummary, OrgGroupRow, OrgStatusChange, OrgTeacherRow,
} from "@/types";

const t = uz.bogchalar;

/** Tab ma'lumotini birinchi ochilganda yuklash (loading / error / data). */
function useTabData<T>(path: string, valid: (d: unknown) => d is T) {
  const [data, setData]   = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ data: unknown }>(path);
      setData(valid(res?.data) ? res.data : null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

const isArray = <T,>(d: unknown): d is T[] => Array.isArray(d);

function State({ loading, error, empty, emptyText, onRetry, children }: {
  loading: boolean; error: string; empty: boolean; emptyText: string; onRetry: () => void; children: React.ReactNode;
}) {
  if (loading) {
    return <div className="space-y-2 p-5" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-[#F2ECF0] animate-pulse" />)}</div>;
  }
  if (error) {
    return (
      <div role="alert" className="p-8 text-center">
        <p className="text-sm text-[#B91C1C]">{error || t.yuklash_xato}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-[#EDE3E8] px-4 py-2 text-sm font-medium text-[#8E315D] hover:bg-[#FFF9F5]">
          {uz.common.qayta_urinish}
        </button>
      </div>
    );
  }
  if (empty) return <p className="p-8 text-center text-sm text-[#B8AAB2]">{emptyText}</p>;
  return <>{children}</>;
}

const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#766B73] whitespace-nowrap";
const td = "px-4 py-3";

export function GroupsTab({ orgId }: { orgId: number }) {
  const { data, error, loading, reload } = useTabData<OrgGroupRow[]>(`/v1/super-admin/organizations/${orgId}/groups`, isArray);
  return (
    <State loading={loading} error={error} empty={!data?.length} emptyText={t.guruh_yoq} onRetry={reload}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#FAF5F8]"><tr>
            <th className={th}>{t.st_guruhlar}</th><th className={th}>{t.yosh_toifa}</th>
            <th className={`${th} text-right`}>{t.st_bolalar} / {t.sigim}</th><th className={th}>{t.st_tarbiyachilar}</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F2ECF0]">
            {data?.map((g) => (
              <tr key={g.id}>
                <td className={`${td} font-medium text-[#29232A]`}>{g.name} {!g.is_active && <Badge variant="neutral">{t.nofaol_guruh}</Badge>}</td>
                <td className={`${td} text-[#766B73]`}>{g.age_category ?? "—"}</td>
                <td className={`${td} text-right tabular-nums`}>{g.children_count}{g.capacity ? ` / ${g.capacity}` : ""}</td>
                <td className={`${td} text-[#3D3240]`}>{g.teachers.length ? g.teachers.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </State>
  );
}

export function TeachersTab({ orgId }: { orgId: number }) {
  const { data, error, loading, reload } = useTabData<OrgTeacherRow[]>(`/v1/super-admin/organizations/${orgId}/teachers`, isArray);
  return (
    <State loading={loading} error={error} empty={!data?.length} emptyText={t.tarbiyachi_yoq} onRetry={reload}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#FAF5F8]"><tr>
            <th className={th}>F.I.Sh.</th><th className={th}>{t.col_telefon}</th><th className={th}>{t.biriktirilgan_guruh}</th>
            <th className={th}>{t.col_holat}</th><th className={th}>{t.oxirgi_kirish}</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F2ECF0]">
            {data?.map((r) => (
              <tr key={r.id}>
                <td className={`${td} font-medium text-[#29232A]`}>{r.name ?? "—"}</td>
                <td className={td}>{r.phone ? <a href={`tel:${r.phone}`} className="hover:text-[#8E315D]">{formatUzPhone(r.phone)}</a> : "—"}</td>
                <td className={`${td} text-[#3D3240]`}>{r.groups.length ? r.groups.join(", ") : "—"}</td>
                <td className={td}><Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? uz.common.faol : uz.common.nofaol}</Badge></td>
                <td className={`${td} text-[#766B73]`}>{r.last_login_at ? formatDate(r.last_login_at) : t.kirmagan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </State>
  );
}

export function ChildrenTab({ orgId }: { orgId: number }) {
  const { data, error, loading, reload } = useTabData<OrgChildrenSummary>(`/v1/super-admin/organizations/${orgId}/children-summary`,
    (d): d is OrgChildrenSummary => !!d && typeof (d as OrgChildrenSummary).jami === "number");
  const max = Math.max(1, ...(data?.guruhlar.map((g) => g.count) ?? [1]));
  return (
    <State loading={loading} error={error} empty={!data?.jami} emptyText={t.bola_yoq} onRetry={reload}>
      {data && (
        <div className="space-y-5 p-5">
          <p className="rounded-xl bg-[#FAF5F8] px-4 py-3 text-xs text-[#766B73]">{t.maxfiylik}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[t.faol_bolalar, data.faol], [t.nofaol_bolalar, data.nofaol], [t.jins_ogil, data.jins.ogil], [t.jins_qiz, data.jins.qiz]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-[#EDE3E8] px-4 py-3">
                <p className="text-xl font-bold text-[#29232A] tabular-nums">{v as number}</p>
                <p className="text-xs text-[#766B73]">{l as string}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#29232A]">{t.guruh_boyicha}</h3>
              <ul className="space-y-2">
                {data.guruhlar.map((g) => (
                  <li key={g.group}>
                    <div className="flex justify-between text-sm"><span className="text-[#3D3240]">{g.group}</span><span className="tabular-nums font-medium">{g.count}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#F2ECF0]"><div className="h-full rounded-full bg-[#8E315D]" style={{ width: `${(g.count / max) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-[#29232A]">{t.yosh_boyicha}</h3>
              <ul className="flex flex-wrap gap-2">
                {data.yosh.map((y) => (
                  <li key={String(y.age)} className="rounded-full bg-[#FDF2F6] px-3 py-1 text-sm text-[#8E315D]">
                    {y.age === null ? t.yosh_nomalum : `${y.age} ${t.yosh}`}: <span className="font-semibold">{y.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </State>
  );
}

export function AttendanceTab({ orgId }: { orgId: number }) {
  const { data, error, loading, reload } = useTabData<AttendanceTotals[]>(`/v1/super-admin/organizations/${orgId}/attendance?days=14`, isArray);
  return (
    <State loading={loading} error={error} empty={!data?.length} emptyText={t.davomat_yoq} onRetry={reload}>
      <div className="overflow-x-auto">
        <p className="px-4 pt-4 text-sm font-semibold text-[#29232A]">{t.davomat_kunlar}</p>
        <table className="mt-2 w-full min-w-[560px] text-sm">
          <thead className="bg-[#FAF5F8]"><tr>
            <th className={th}>{uz.super_admin.sana}</th>
            {[uz.davomat.jami, uz.davomat.keldi, uz.davomat.kelmadi, uz.davomat.sababli, uz.davomat.belgilanmagan].map((h) => <th key={h} className={`${th} text-right`}>{h}</th>)}
            <th className={`${th} text-right`}>%</th>
          </tr></thead>
          <tbody className="divide-y divide-[#F2ECF0]">
            {data?.map((d) => (
              <tr key={d.sana}>
                <td className={`${td} text-[#3D3240]`}>{formatDate(d.sana)}</td>
                <td className={`${td} text-right tabular-nums`}>{d.jami}</td>
                <td className={`${td} text-right tabular-nums text-[#166534]`}>{d.keldi}</td>
                <td className={`${td} text-right tabular-nums text-[#991B1B]`}>{d.kelmadi}</td>
                <td className={`${td} text-right tabular-nums text-[#92400E]`}>{d.sababli}</td>
                <td className={`${td} text-right tabular-nums text-[#766B73]`}>{d.belgilanmagan}</td>
                <td className={`${td} text-right tabular-nums font-medium`}>{d.jami ? Math.round((d.keldi / d.jami) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </State>
  );
}

export function HistoryTab({ orgId, version }: { orgId: number; version: number }) {
  const status = useTabData<OrgStatusChange[]>(`/v1/super-admin/organizations/${orgId}/status-history?v=${version}`, isArray);
  const activity = useTabData<OrgActivity[]>(`/v1/super-admin/organizations/${orgId}/activity?v=${version}`, isArray);
  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:divide-x divide-[#F2ECF0]">
      <section>
        <h3 className="px-5 pt-4 text-sm font-semibold text-[#29232A]">{t.holat_tarixi}</h3>
        <State loading={status.loading} error={status.error} empty={!status.data?.length} emptyText={t.tarix_yoq} onRetry={status.reload}>
          <ul className="divide-y divide-[#F2ECF0]" data-testid="status-history">
            {status.data?.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <p className="text-sm text-[#29232A]">
                  {c.from_status ? STATUS_LABELS[c.from_status] : "—"} → <span className="font-semibold">{STATUS_LABELS[c.to_status] ?? c.to_label}</span>
                </p>
                {c.reason && <p className="mt-0.5 text-sm text-[#766B73]">{t.sababi}: {c.reason}</p>}
                {c.suspended_until && <p className="text-xs text-[#92400E]">{formatDate(c.suspended_until)} {t.toxtatilgan_gacha}</p>}
                <p className="mt-0.5 text-xs text-[#B8AAB2]">{c.changed_by ?? t.tizim} · {formatDate(c.created_at)}</p>
              </li>
            ))}
          </ul>
        </State>
      </section>
      <section>
        <h3 className="px-5 pt-4 text-sm font-semibold text-[#29232A]">{t.faoliyat_jurnali}</h3>
        <State loading={activity.loading} error={activity.error} empty={!activity.data?.length} emptyText={uz.super_admin.hech_faoliyat_yoq} onRetry={activity.reload}>
          <ul className="divide-y divide-[#F2ECF0]">
            {activity.data?.map((log) => (
              <li key={log.id} className="px-5 py-3">
                <p className="text-sm text-[#29232A]">{log.description}</p>
                <p className="mt-0.5 text-xs text-[#B8AAB2]">{log.user?.name ?? t.tizim} · {formatDate(log.created_at)}</p>
              </li>
            ))}
          </ul>
        </State>
      </section>
    </div>
  );
}
