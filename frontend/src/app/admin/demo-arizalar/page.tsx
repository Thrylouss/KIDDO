"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";

const t = uz.demo_arizalar;

type Status = keyof typeof t.status;
const STATUSES = Object.keys(t.status) as Status[];
const TG_LABEL: Record<string, string> = { sent: t.tg_sent, failed: t.tg_failed, pending: t.tg_pending, not_configured: t.tg_not_configured };

export interface DemoRequestRow {
  id: number;
  kindergarten_name: string;
  kindergarten_type: "davlat" | "xususiy";
  region: string;
  district: string;
  address: string | null;
  director_name: string;
  phone: string;
  children_count: number | null;
  groups_count: number | null;
  comment: string | null;
  status: Status;
  status_label: string;
  internal_note: string | null;
  handled_by: string | null;
  demo_starts_at: string | null;
  demo_ends_at: string | null;
  demo_days_left: number | null;
  telegram: { status: string; attempts: number; sent_at: string | null; error: string | null };
  created_at: string;
}

interface ListResponse {
  data: DemoRequestRow[];
  meta: { current_page: number; last_page: number; total: number; counts: Partial<Record<Status, number>>; telegram_configured: boolean };
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATUS_VARIANT: Record<Status, "info" | "warning" | "success" | "error" | "neutral"> = {
  new: "info", contacted: "neutral", preparing: "warning", active: "success", rejected: "error",
};

const tgVariant = (s: string) => (s === "sent" ? "success" : s === "failed" ? "error" : "neutral");

export default function DemoArizalarPage() {
  const [rows, setRows] = useState<DemoRequestRow[]>([]);
  const [meta, setMeta] = useState<ListResponse["meta"] | null>(null);
  const [status, setStatus] = useState<Status | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<DemoRequestRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: "20" });
      if (status) qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      const res = await api.get<ListResponse>(`/v1/super-admin/demo-requests?${qs}`);
      setRows(res?.data ?? []);
      setMeta(res?.meta ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const onSaved = (row: DemoRequestRow) => {
    setRows((p) => p.map((r) => (r.id === row.id ? row : r)));
    setOpen(row);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t.sarlavha} description={t.tavsif} />

      {meta && !meta.telegram_configured && (
        <p data-testid="tg-not-configured" className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">{t.tg_sozlanmagan}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={t.holat}>
        {(["", ...STATUSES] as const).map((s) => (
          <button key={s || "all"} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${status === s ? "bg-[#8E315D] border-[#8E315D] text-white" : "bg-white border-[#EDE3E8] text-[#3D3240] hover:bg-[#FFF9F5]"}`}>
            {s ? t.status[s] : t.barcha}
            {s && meta?.counts?.[s] ? <span className="ml-1.5 opacity-70">{meta.counts[s]}</span> : null}
          </button>
        ))}
      </div>

      <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t.qidirish} aria-label={t.qidirish}
        className="mb-4 w-full rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15" />

      {error && <p role="alert" className="mb-4 rounded-lg bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

      <div className="rounded-2xl border border-[#EDE3E8] bg-white overflow-hidden">
        {loading && rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#766B73]">{uz.common.yuklanmoqda}</p>
        ) : rows.length === 0 ? (
          <EmptyState title={t.bosh} description={t.bosh_tavsif} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FBF7F9] text-left text-xs uppercase tracking-wide text-[#766B73]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.bogcha}</th>
                  <th className="px-4 py-3 font-medium">{t.rahbar}</th>
                  <th className="px-4 py-3 font-medium">{t.hudud}</th>
                  <th className="px-4 py-3 font-medium">{t.bolalar_guruhlar}</th>
                  <th className="px-4 py-3 font-medium">{t.sana}</th>
                  <th className="px-4 py-3 font-medium">{t.holat}</th>
                  <th className="px-4 py-3 font-medium">{t.telegram}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF0]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FFF9F5]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#29232A]">{r.kindergarten_name}</p>
                      <p className="text-xs text-[#766B73]">{r.kindergarten_type === "xususiy" ? t.xususiy : t.davlat}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#29232A]">{r.director_name}</p>
                      <a href={`tel:${r.phone}`} className="text-xs text-[#8E315D] hover:underline">{r.phone}</a>
                    </td>
                    <td className="px-4 py-3 text-[#3D3240]">{r.region}<span className="block text-xs text-[#766B73]">{r.district}</span></td>
                    <td className="px-4 py-3 text-[#3D3240]">{r.children_count ?? "—"} / {r.groups_count ?? "—"}</td>
                    <td className="px-4 py-3 text-[#3D3240] whitespace-nowrap">{fmt(r.created_at)}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status]}>{t.status[r.status] ?? r.status_label}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={tgVariant(r.telegram.status)}>{TG_LABEL[r.telegram.status] ?? r.telegram.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setOpen(r)}>{t.korish}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#EDE3E8]">
            <p className="text-sm text-[#766B73]">Jami {meta.total} ta</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
              <Button size="sm" variant="secondary" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>Keyingi</Button>
            </div>
          </div>
        )}
      </div>

      {open && <DetailModal row={open} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </div>
  );
}

function DetailModal({ row, onClose, onSaved }: { row: DemoRequestRow; onClose: () => void; onSaved: (r: DemoRequestRow) => void }) {
  const [status, setStatus] = useState<Status>(row.status);
  const [note, setNote] = useState(row.internal_note ?? "");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.patch<{ data: DemoRequestRow }>(`/v1/super-admin/demo-requests/${row.id}`, { status, internal_note: note.trim() || null });
      if (res?.data) onSaved(res.data);
      setMsg({ ok: true, text: t.saqlandi });
    } catch (e) {
      const f = fieldErrors(e);
      setMsg({ ok: false, text: Object.values(f)[0]?.[0] ?? errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function retry() {
    setRetrying(true);
    setMsg(null);
    try {
      const res = await api.post<{ data: DemoRequestRow; message: string }>(`/v1/super-admin/demo-requests/${row.id}/retry-telegram`);
      if (res?.data) onSaved(res.data);
      setMsg({ ok: true, text: res?.message ?? t.tg_sent });
    } catch (e) {
      const data = (e as { data?: { data?: DemoRequestRow; message?: string } }).data;
      if (data?.data) onSaved(data.data);
      setMsg({ ok: false, text: data?.message ?? errorMessage(e) });
    } finally {
      setRetrying(false);
    }
  }

  const item = (label: string, value: React.ReactNode) => (
    <div><dt className="text-xs text-[#766B73]">{label}</dt><dd className="mt-0.5 text-sm text-[#29232A] break-words">{value || "—"}</dd></div>
  );

  return (
    <Modal open onClose={onClose} title={row.kindergarten_name} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{uz.common.yopish}</Button><Button onClick={save} loading={saving}>{t.saqlash}</Button></>}>
      <dl className="grid sm:grid-cols-2 gap-4">
        {item(t.turi, row.kindergarten_type === "xususiy" ? t.xususiy : t.davlat)}
        {item(t.hudud, `${row.region}, ${row.district}`)}
        {item(t.manzil, row.address)}
        {item(t.rahbar, row.director_name)}
        {item(t.telefon, <a href={`tel:${row.phone}`} className="text-[#8E315D] hover:underline">{row.phone}</a>)}
        {item(t.bolalar_guruhlar, `${row.children_count ?? "—"} / ${row.groups_count ?? "—"}`)}
        {item(t.sana, fmt(row.created_at))}
        {item(t.mas_ul, row.handled_by)}
        <div className="sm:col-span-2">{item(t.izoh, row.comment)}</div>
      </dl>

      <div className="mt-5 rounded-xl border border-[#EDE3E8] bg-[#FBF7F9] p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {t.telegram}: <Badge variant={tgVariant(row.telegram.status)}>{TG_LABEL[row.telegram.status] ?? row.telegram.status}</Badge>
            <span className="text-xs text-[#766B73]">{row.telegram.attempts} {t.urinishlar}{row.telegram.sent_at ? ` · ${fmt(row.telegram.sent_at)}` : ""}</span>
          </span>
          {row.telegram.status !== "sent" && (
            <Button size="sm" variant="secondary" onClick={retry} loading={retrying}>{t.qayta_yuborish}</Button>
          )}
        </div>
        {row.telegram.error && <p className="mt-2 text-xs text-[#B91C1C] break-words">{row.telegram.error}</p>}
      </div>

      <div className="mt-5 grid gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-status" className="text-sm font-medium text-[#29232A]">{t.holatni_ozgartirish}</label>
          <select id="demo-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}
            className="rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#8E315D]">
            {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </select>
          <p className="text-xs text-[#766B73]">{t.demo_izoh}</p>
        </div>
        {row.demo_starts_at && (
          <p data-testid="demo-period" className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-sm text-[#166534]">
            {t.demo_muddat}: {fmt(row.demo_starts_at)} — {fmt(row.demo_ends_at)} · {row.demo_days_left} {t.kun_qoldi}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-note" className="text-sm font-medium text-[#29232A]">{t.ichki_qayd}</label>
          <textarea id="demo-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-[#EDE3E8] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#8E315D] resize-y" />
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-[#166534]" : "text-[#B91C1C]"}`}>{msg.text}</p>}
      </div>
    </Modal>
  );
}
