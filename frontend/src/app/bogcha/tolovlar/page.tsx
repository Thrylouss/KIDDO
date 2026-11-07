"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { formatUzDate } from "@/lib/dates";
import ConfirmDialog from "@/components/ConfirmDialog";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { SkeletonTable } from "@/components/ui/Skeleton";
import uz from "@/i18n/uz";
import { useReadOnly } from "@/lib/readOnly";

const t = uz.tolov;

interface Payment { id: number; month: string; amount: number; paid_at: string; note: string | null }
interface Row { id: number; first_name: string; last_name: string; group: { id: number; name: string } | null; payment: Payment | null }
interface Overview {
  month: string;
  summary: { jami: number; tolagan: number; tolanmagan: number; summa: number };
  children: Row[];
  groups: { id: number; name: string }[];
}

const som = (n: number) => `${n.toLocaleString("ru-RU").replace(/,/g, " ")} ${t.som}`;
// Mahalliy sana (UTC emas) — backend Toshkent vaqti bo'yicha «bugun» bilan tekshiradi
const todayIso = () => new Date().toLocaleDateString("sv-SE");
const currentMonth = () => todayIso().slice(0, 7);

/** Rahbar: bolalarning oylik to'lov holati (qayd etish, tahrirlash, bekor qilish). */
export default function TolovlarPage() {
  const [month, setMonth]     = useState(currentMonth());
  const [groupId, setGroupId] = useState("");
  const [data, setData]       = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [success, setSuccess] = useState("");

  const [editing, setEditing]   = useState<Row | null>(null);
  const [form, setForm]         = useState({ amount: "", paid_at: todayIso(), note: "" });
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [clearing, setClearing] = useState<Row | null>(null);
  const readOnly = useReadOnly();

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const qs = new URLSearchParams({ month });
      if (groupId) qs.set("group_id", groupId);
      setData(await api.get<Overview>(`/v1/admin/payments?${qs}`));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [month, groupId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(row: Row) {
    setSuccess(""); setErrors({}); setFormError("");
    // Yangi qayd uchun summa — shu oyda boshqa bolaga yozilgan oxirgi summa (qulaylik uchun)
    const last = data?.children.find((c) => c.payment)?.payment?.amount;
    setForm({
      amount: String(row.payment?.amount ?? last ?? ""),
      paid_at: row.payment?.paid_at ?? todayIso(),
      note: row.payment?.note ?? "",
    });
    setEditing(row);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true); setErrors({}); setFormError("");
    try {
      await api.put("/v1/admin/payments", {
        child_id: editing.id, month, amount: Number(form.amount), paid_at: form.paid_at, note: form.note.trim() || null,
      });
      setEditing(null);
      setSuccess(t.saqlandi);
      await load();
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!clearing) return;
    await api.delete(`/v1/admin/payments/${clearing.id}/${month}`);
    setClearing(null);
    setSuccess(t.bekor_qilindi);
    await load();
  }

  const s = data?.summary;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={t.sarlavha} description={t.tavsif} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input id="payments-month" label={t.oy} type="month" value={month} max={currentMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <Select id="payments-group" label={t.guruh} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">{t.barcha_guruhlar}</option>
          {data?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </div>

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-[#EDE3E8] bg-[#EDE3E8] mb-4">
          {[
            { id: "jami", label: t.jami, value: String(s.jami) },
            { id: "tolagan", label: t.tolagan, value: String(s.tolagan) },
            { id: "tolanmagan", label: t.tolanmagan, value: String(s.tolanmagan) },
            { id: "summa", label: t.summa, value: som(s.summa) },
          ].map((c) => (
            <div key={c.id} className="bg-white px-4 py-3">
              <p className="text-[11px] text-[#B8AAB2] font-medium uppercase tracking-wide">{c.label}</p>
              <p data-testid={`pay-${c.id}`} className="text-xl font-bold text-[#29232A] leading-tight">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {success && <p role="status" className="mb-4 rounded-lg bg-[var(--success-bg)] text-[var(--success)] text-sm px-4 py-2.5">{success}</p>}

      <div className="relative bg-white rounded-xl border border-[#EDE3E8] overflow-x-auto">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : error ? (
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} />
        ) : !data || data.children.length === 0 ? (
          <EmptyState title={t.bola_yoq} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8] text-left text-xs font-semibold text-[#766B73] uppercase tracking-wide">
                <th className="px-5 py-3.5">{t.bola}</th>
                <th className="px-5 py-3.5 hidden sm:table-cell">{t.guruh}</th>
                <th className="px-5 py-3.5">{t.holat}</th>
                <th className="px-5 py-3.5 hidden md:table-cell">{t.summa_som}</th>
                <th className="px-5 py-3.5"><span className="sr-only">{uz.common.amallar}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF0]">
              {data.children.map((row) => (
                <tr key={row.id} data-testid={`pay-row-${row.id}`} className="hover:bg-[#FAF5F8]">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#29232A]">{row.last_name} {row.first_name}</p>
                    <p className="text-xs text-[#B8AAB2] sm:hidden">{row.group?.name ?? "—"}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[#766B73] hidden sm:table-cell">{row.group?.name ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    {row.payment ? (
                      <div>
                        <Badge variant="success">{t.tolangan_badge}</Badge>
                        <p className="text-[11px] text-[#B8AAB2] mt-1">{formatUzDate(row.payment.paid_at)}{row.payment.note ? ` · ${row.payment.note}` : ""}</p>
                      </div>
                    ) : <Badge variant="warning">{t.tolanmagan_badge}</Badge>}
                  </td>
                  <td className="px-5 py-3.5 text-[#29232A] hidden md:table-cell whitespace-nowrap">{row.payment ? som(row.payment.amount) : "—"}</td>
                  <td className="px-5 py-3.5">
                    {!readOnly && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant={row.payment ? "ghost" : "secondary"} className="whitespace-nowrap" onClick={() => openEdit(row)}>
                          {row.payment ? t.tahrirlash : t.qayd_etish}
                        </Button>
                        {row.payment && <Button size="sm" variant="ghost" onClick={() => { setSuccess(""); setClearing(row); }}>{t.bekor}</Button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`${t.qayd_etish}: ${editing ? `${editing.last_name} ${editing.first_name}` : ""}`} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>{uz.common.bekor_qilish}</Button>
            <Button form="payment-form" type="submit" loading={saving} disabled={!form.amount || !form.paid_at}>{uz.common.saqlash}</Button>
          </>
        }>
        <form id="payment-form" onSubmit={save} className="space-y-4" noValidate>
          <p className="text-xs text-[#766B73]">{t.oy}: <strong>{month}</strong></p>
          <Input id="payment-amount" label={t.summa_som} type="number" min={1} inputMode="numeric" value={form.amount} required
            onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount?.[0]} />
          <Input id="payment-date" label={t.sana} type="date" max={todayIso()} value={form.paid_at} required
            onChange={(e) => setForm({ ...form, paid_at: e.target.value })} error={errors.paid_at?.[0]} />
          <Input id="payment-note" label={t.izoh} value={form.note} maxLength={255}
            onChange={(e) => setForm({ ...form, note: e.target.value })} error={errors.note?.[0]} />
          {formError && <p role="alert" className="text-sm text-[#B91C1C]">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!clearing}
        title={t.bekor_sarlavha}
        message={t.bekor_tasdiq}
        confirmLabel={t.bekor}
        danger
        onConfirm={clear}
        onClose={() => setClearing(null)}
      />
    </div>
  );
}
