"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import uz, { intlLocale } from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

// ── Local type ─────────────────────────────────────────────────────

interface PaymentDetail {
  id: number;
  organization: { id: number; name: string } | null;
  subscription_id: number | null;
  invoice_number: string | null;
  amount: string;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded";
  payment_method: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  due_at: string | null;
  plan_name: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(), {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString(intlLocale())} ${currency}`;
}

function payStatusVariant(s: string): "success" | "warning" | "error" | "neutral" {
  if (s === "paid")     return "success";
  if (s === "pending")  return "warning";
  if (s === "failed")   return "error";
  return "neutral";
}

function payStatusLabel(s: string): string {
  return ({
    paid:     uz.super_admin.to_langan,
    pending:  uz.super_admin.kutilmoqda_pay,
    failed:   uz.super_admin.muvaffaqiyatsiz,
    refunded: uz.super_admin.qaytarilgan,
  } as Record<string, string>)[s] ?? s;
}

function payMethodLabel(m: string | null): string {
  if (!m) return "—";
  return ({
    manual: uz.super_admin.manual_pay,
    payme:  uz.super_admin.payme_pay,
    click:  uz.super_admin.click_pay,
    uzcard: uz.super_admin.uzcard_pay,
    humo:   uz.super_admin.humo_pay,
    other:  uz.super_admin.other_pay,
  } as Record<string, string>)[m] ?? m;
}

// ── Row helper ─────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-[var(--border-2)] last:border-0">
      <span className="w-44 flex-shrink-0 text-sm text-[var(--text-2)]">{label}</span>
      <span className="flex-1 text-sm font-medium text-[var(--text)]">{children}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function TolovDetailPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await api.get<{ data: PaymentDetail }>(`/v1/super-admin/payments/${params.id}`);
        setPayment(res.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border-2)] transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{uz.matn.tolov_tafsiloti}</h1>
          {payment && (
            <p className="text-sm text-[var(--text-3)] mt-0.5">
              #{payment.id}
              {payment.invoice_number && (
                <span className="ml-2 font-mono">· {payment.invoice_number}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 animate-pulse space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3.5 border-b border-[var(--border-2)]">
              <div className="h-4 w-40 bg-[var(--border-2)] rounded" />
              <div className="h-4 w-56 bg-[var(--border-2)] rounded" />
            </div>
          ))}
        </div>
      ) : error || !payment ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-12 text-center space-y-3">
          <p className="text-[var(--text-2)]">{uz.common.yuklash_xatosi}</p>
          <Link href="/admin/tolovlar" className="text-sm text-[var(--primary)] hover:underline">
            {uz.matn.tolovlar_royxatiga_qaytish}
          </Link>
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div className={`flex items-center gap-3 rounded-xl px-5 py-4 ${
            payment.status === "paid"    ? "bg-[var(--success-soft)] border border-[var(--success-border)]" :
            payment.status === "pending" ? "bg-[var(--warning-soft)] border border-[var(--warning-border)]" :
            payment.status === "failed"  ? "bg-[var(--error-soft)] border border-[var(--error-border)]" :
                                           "bg-[var(--surface-2)] border border-[var(--border)]"
          }`}>
            <Badge variant={payStatusVariant(payment.status)}>
              {payStatusLabel(payment.status)}
            </Badge>
            <span className="text-sm font-bold text-[var(--text)]">
              {fmtMoney(payment.amount, payment.currency)}
            </span>
            {payment.paid_at && (
              <span className="text-sm text-[var(--text-2)] ml-auto">{fmtDate(payment.paid_at)}</span>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-[var(--border)] px-6 py-2">
            <h2 className="text-sm font-semibold text-[var(--label)] uppercase tracking-wide py-3.5 border-b border-[var(--border-2)]">
              {uz.matn.tolov_malumotlari}
            </h2>

            <Row label={uz.matn.tolov_id}>#{payment.id}</Row>
            <Row label={uz.super_admin.invoice_raqam}>
              {payment.invoice_number ? (
                <span className="font-mono">{payment.invoice_number}</span>
              ) : "—"}
            </Row>
            <Row label={uz.super_admin.holat}>
              <Badge variant={payStatusVariant(payment.status)}>{payStatusLabel(payment.status)}</Badge>
            </Row>
            <Row label={uz.super_admin.summa}>
              <span className="text-lg font-bold">{fmtMoney(payment.amount, payment.currency)}</span>
            </Row>
            <Row label={uz.super_admin.tolov_usuli}>{payMethodLabel(payment.payment_method)}</Row>
            <Row label={uz.super_admin.tranzaksiya}>
              {payment.transaction_id ? (
                <span className="font-mono text-xs">{payment.transaction_id}</span>
              ) : "—"}
            </Row>
          </div>

          {/* Organization & subscription */}
          <div className="bg-white rounded-xl border border-[var(--border)] px-6 py-2">
            <h2 className="text-sm font-semibold text-[var(--label)] uppercase tracking-wide py-3.5 border-b border-[var(--border-2)]">
              {uz.matn.tashkilot_va_obuna}
            </h2>

            <Row label={uz.matn.bogcha}>
              {payment.organization ? (
                <Link
                  href={`/admin/bogchalar/${payment.organization.id}`}
                  className="text-[var(--primary)] hover:text-[var(--primary-h)] transition-colors"
                >
                  {payment.organization.name}
                </Link>
              ) : "—"}
            </Row>
            <Row label={uz.super_admin.tarif}>{payment.plan_name ?? "—"}</Row>
            <Row label={uz.matn.obuna_id}>
              {payment.subscription_id ? `#${payment.subscription_id}` : "—"}
            </Row>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-xl border border-[var(--border)] px-6 py-2">
            <h2 className="text-sm font-semibold text-[var(--label)] uppercase tracking-wide py-3.5 border-b border-[var(--border-2)]">
              {uz.matn.sanalar}
            </h2>

            <Row label={uz.matn.yaratilgan_sana}>{fmtDate(payment.created_at)}</Row>
            <Row label={uz.matn.tolangan_sana}>{fmtDate(payment.paid_at)}</Row>
            <Row label={uz.matn.muddati}>{fmtDate(payment.due_at)}</Row>
          </div>

          {/* Back link */}
          <div className="pb-4">
            <Link
              href="/admin/tolovlar"
              className="text-sm text-[var(--primary)] hover:text-[var(--primary-h)] font-medium transition-colors"
            >
              {uz.matn.tolovlar_royxatiga_qaytish_2}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
