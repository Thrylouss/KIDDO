"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationDetail, OrgPayment, ApiResponse, Plan } from "@/types";

/**
 * Bog'cha obunasi va to'lovlari (KIDDO SaaS billing). Faqat BILLING_ENABLED=true bo'lganda ko'rsatiladi —
 * MVP'da yashirin. Avvalgi tafsilot sahifasidagi kod o'zgarishsiz shu yerga ko'chirilgan.
 * Faollik holati (organization.status) va obuna holati alohida tushunchalar.
 */

function subVariant(status: string): "success" | "info" | "warning" | "error" | "neutral" {
  if (status === "active")   return "success";
  if (status === "trial")    return "info";
  if (status === "past_due") return "warning";
  if (status === "expired")  return "error";
  return "neutral";
}

function subLabel(status: string): string {
  return {
    active:   uz.super_admin.faol,
    trial:    uz.super_admin.sinov,
    past_due: uz.super_admin.past_due,
    expired:  uz.super_admin.muddati_tugagan,
    cancelled: uz.super_admin.bekor,
  }[status] ?? status;
}

function payVariant(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid")    return "success";
  if (status === "pending") return "warning";
  if (status === "failed")  return "error";
  return "neutral";
}

function payLabel(status: string): string {
  return {
    paid:     uz.super_admin.to_langan,
    pending:  uz.super_admin.kutilmoqda_pay,
    failed:   uz.super_admin.muvaffaqiyatsiz,
    refunded: uz.super_admin.qaytarilgan,
  }[status] ?? status;
}

function formatMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });
}

function SectionCard({ title, children, action }: {
  title: string; children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#EDE3E8]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE3E8]">
        <h2 className="text-sm font-semibold text-[#29232A]">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F2ECF0] last:border-0">
      <span className="text-sm text-[#766B73]">{label}</span>
      <div className="text-sm font-medium text-[#29232A]">{children}</div>
    </div>
  );
}

interface RenewForm {
  plan_id:        string;
  ends_at:        string;
  payment_status: string;
  notes:          string;
}

const emptyRenew: RenewForm = { plan_id: "", ends_at: "", payment_status: "paid", notes: "" };

export default function OrgBillingPanel({ org, onChanged }: { org: OrganizationDetail; onChanged: () => void }) {
  const id = String(org.id);
  const [payments, setPayments] = useState<OrgPayment[]>([]);
  const [plans, setPlans]       = useState<Plan[]>([]);

  const [showRenew,     setShowRenew]     = useState(false);
  const [renewForm,     setRenewForm]     = useState<RenewForm>(emptyRenew);
  const [renewing,      setRenewing]      = useState(false);
  const [renewErrors,   setRenewErrors]   = useState<Record<string, string[]>>({});

  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancel,     setShowCancel]     = useState(false);
  const [changePlanForm, setChangePlanForm] = useState({ plan_id: "" });
  const [cancelForm,     setCancelForm]     = useState({ reason: "" });
  const [changingPlan,   setChangingPlan]   = useState(false);
  const [cancelling,     setCancelling]     = useState(false);

  const minRenewDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  async function load() {
    const [pymRes, plnRes] = await Promise.all([
      api.get<ApiResponse<OrgPayment[]>>(`/v1/super-admin/organizations/${id}/payments`).catch(() => ({ data: [] as OrgPayment[] })),
      api.get<ApiResponse<Plan[]>>("/v1/super-admin/plans").catch(() => ({ data: [] as Plan[] })),
    ]);
    setPayments(pymRes?.data ?? []);
    setPlans(plnRes?.data ?? []);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const sub = org.subscription;
  const daysLeft = sub?.days_remaining ?? 0;
  const daysBarPct = sub?.ends_at
    ? Math.min(100, Math.max(0, Math.round(daysLeft / 30 * 100)))
    : 0;
  const daysBarColor = daysLeft > 14 ? "bg-[#22C55E]" : daysLeft > 7 ? "bg-[#F59E0B]" : "bg-[#EF4444]";

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    setRenewErrors({});
    setRenewing(true);
    try {
      await api.post(`/v1/super-admin/organizations/${id}/renew`, {
        plan_id:        parseInt(renewForm.plan_id),
        ends_at:        renewForm.ends_at,
        payment_status: renewForm.payment_status,
        notes:          renewForm.notes || null,
      });
      setShowRenew(false);
      setRenewForm(emptyRenew);
      onChanged(); await load();
    } catch (err: unknown) {
      const e = err as { data?: { errors?: Record<string, string[]> } };
      if (e?.data?.errors) setRenewErrors(e.data.errors);
    } finally {
      setRenewing(false);
    }
  }

  async function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!sub) return;
    setChangingPlan(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${sub.id}/change-plan`, {
        plan_id: parseInt(changePlanForm.plan_id),
        effective_immediately: true,
      });
      setShowChangePlan(false);
      setChangePlanForm({ plan_id: "" });
      onChanged(); await load();
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!sub) return;
    setCancelling(true);
    try {
      await api.post(`/v1/super-admin/subscriptions/${sub.id}/cancel`, {
        reason: cancelForm.reason || null,
      });
      setShowCancel(false);
      setCancelForm({ reason: "" });
      onChanged(); await load();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
          {/* Subscription */}
          <SectionCard
            title={uz.super_admin.obuna_malumotlari}
            action={
              <button
                onClick={() => setShowRenew(true)}
                className="text-xs text-[#8E315D] hover:text-[#742548] font-medium transition-colors"
              >
                {uz.super_admin.obuna_uzaytirish}
              </button>
            }
          >
            <div className="px-6 py-4">
              {sub ? (
                <div className="space-y-1">
                  <Row label={uz.super_admin.tarif}>
                    <span>{sub.plan?.name ?? "—"}</span>
                  </Row>
                  <Row label={uz.super_admin.obuna}>
                    <Badge variant={subVariant(sub.status)}>{subLabel(sub.status)}</Badge>
                  </Row>
                  <Row label={uz.super_admin.tugash}>
                    {fmtDate(sub.ends_at ?? sub.trial_ends_at)}
                  </Row>
                  <Row label={uz.super_admin.qolgan}>
                    <span className={daysLeft <= 7 ? "text-[#EF4444] font-semibold" : daysLeft <= 14 ? "text-[#F59E0B] font-semibold" : ""}>
                      {daysLeft} {uz.super_admin.qolgan_kun}
                    </span>
                  </Row>
                  {sub.ends_at && (
                    <div className="pt-3">
                      <div className="w-full h-1.5 bg-[#F2ECF0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${daysBarColor}`}
                          style={{ width: `${daysBarPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#B8AAB2] py-2">{uz.super_admin.obuna_yoq}</p>
              )}
            </div>
          </SectionCard>

          {/* Payment history */}
          <SectionCard title={uz.super_admin.tolov_tarixi}>
            {payments.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-[#B8AAB2]">
                {uz.super_admin.hech_tolov_yoq}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#F2ECF0] bg-[#FAF5F8]">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.sana}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.summa}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{uz.super_admin.tarif}</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.super_admin.holat}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECF0]">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF5F8] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[#29232A]">{fmtDate(p.paid_at ?? p.created_at)}</p>
                          {p.invoice_number && (
                            <p className="text-xs text-[#C9B8C0] font-mono mt-0.5">{p.invoice_number}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[#29232A]">
                          {formatMoney(p.amount, p.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-[#766B73] hidden sm:table-cell">
                          {p.plan_name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={payVariant(p.status)}>{payLabel(p.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>


      <div className="bg-white rounded-xl border border-[#EDE3E8] p-5 space-y-2">
            <button
              onClick={() => setShowRenew(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#EDE3E8] text-sm font-medium text-[#3D3240] hover:bg-[#FFF9F5] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {uz.super_admin.obuna_uzaytirish}
            </button>

            {sub && sub.status !== "cancelled" && sub.status !== "expired" && (
              <button
                onClick={() => setShowChangePlan(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#EDE3E8] text-sm font-medium text-[#3D3240] hover:bg-[#FFF9F5] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {uz.super_admin.tarif_almashtirish}
              </button>
            )}

            {sub && sub.status !== "cancelled" && (
              <button
                onClick={() => setShowCancel(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#FEF3C7] text-sm font-medium text-[#92400E] hover:bg-[#FFFBEB] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Obunani bekor qilish
              </button>
            )}
      </div>

      {/* Renew Subscription Modal */}
      <Modal
        open={showRenew}
        onClose={() => { setShowRenew(false); setRenewForm(emptyRenew); setRenewErrors({}); }}
        title={uz.super_admin.obuna_uzaytirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRenew(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="renew-form" type="submit" loading={renewing}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="renew-form" onSubmit={handleRenew} className="space-y-4">
          <Select
            label={uz.super_admin.tarif}
            value={renewForm.plan_id}
            onChange={(e) => setRenewForm({ ...renewForm, plan_id: e.target.value })}
            error={renewErrors.plan_id?.[0]}
            required
          >
            <option value="">— Tanlang —</option>
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
            min={minRenewDate}
            error={renewErrors.ends_at?.[0]}
            required
          />

          <Select
            label={uz.super_admin.tolov_holati}
            value={renewForm.payment_status}
            onChange={(e) => setRenewForm({ ...renewForm, payment_status: e.target.value })}
            required
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

      {/* Change Plan Modal */}
      <Modal
        open={showChangePlan}
        onClose={() => { setShowChangePlan(false); setChangePlanForm({ plan_id: "" }); }}
        title={uz.super_admin.tarif_almashtirish}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChangePlan(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="change-plan-form" type="submit" loading={changingPlan}>{uz.common.saqlash}</Button>
          </>
        }
      >
        <form id="change-plan-form" onSubmit={handleChangePlan} className="space-y-4">
          {sub?.plan && (
            <div className="px-4 py-3 bg-[#FAF5F8] rounded-lg">
              <p className="text-xs text-[#B8AAB2] mb-1">{uz.super_admin.joriy_tarif}</p>
              <p className="text-sm font-medium text-[#29232A]">{sub.plan.name}</p>
            </div>
          )}
          <Select
            label={uz.super_admin.yangi_tarif}
            value={changePlanForm.plan_id}
            onChange={(e) => setChangePlanForm({ plan_id: e.target.value })}
            required
          >
            <option value="">— Tanlang —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {Number(p.price_monthly).toLocaleString("uz-UZ")} UZS
              </option>
            ))}
          </Select>
          <p className="text-xs text-[#B8AAB2]">{uz.super_admin.darhol} kuchga kiradi</p>
        </form>
      </Modal>

      {/* Cancel Subscription Modal */}
      <Modal
        open={showCancel}
        onClose={() => { setShowCancel(false); setCancelForm({ reason: "" }); }}
        title="Obunani bekor qilish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancel(false)}>{uz.common.bekor_qilish}</Button>
            <Button form="cancel-form" type="submit" loading={cancelling} variant="danger">
              {uz.super_admin.obuna_bekor_tasdiq.split("?")[0]}
            </Button>
          </>
        }
      >
        <form id="cancel-form" onSubmit={handleCancel} className="space-y-4">
          <p className="text-sm text-[#766B73]">{uz.super_admin.obuna_bekor_tasdiq}</p>
          <div>
            <label className="block text-sm font-medium text-[#3D3240] mb-1.5">
              {uz.super_admin.bekor_qilish_sababi} (ixtiyoriy)
            </label>
            <textarea
              value={cancelForm.reason}
              onChange={(e) => setCancelForm({ reason: e.target.value })}
              rows={3}
              placeholder="Sabab..."
              className="w-full px-3.5 py-2.5 text-sm border border-[#EDE3E8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8E315D]/20 focus:border-[#8E315D] resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
