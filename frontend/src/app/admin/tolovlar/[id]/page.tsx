"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import uz from "@/i18n/uz";

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
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtMoney(amount: string | number, currency = "UZS"): string {
  return `${Number(amount).toLocaleString("uz-UZ")} ${currency}`;
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
    <div className="flex items-start gap-4 py-3.5 border-b border-[#F2ECF0] last:border-0">
      <span className="w-44 flex-shrink-0 text-sm text-[#766B73]">{label}</span>
      <span className="flex-1 text-sm font-medium text-[#29232A]">{children}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function TolovDetailPage() {
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
          className="p-2 rounded-lg text-[#766B73] hover:text-[#29232A] hover:bg-[#F2ECF0] transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#29232A]">To&apos;lov tafsiloti</h1>
          {payment && (
            <p className="text-sm text-[#B8AAB2] mt-0.5">
              #{payment.id}
              {payment.invoice_number && (
                <span className="ml-2 font-mono">· {payment.invoice_number}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-6 animate-pulse space-y-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3.5 border-b border-[#F2ECF0]">
              <div className="h-4 w-40 bg-[#F2ECF0] rounded" />
              <div className="h-4 w-56 bg-[#F2ECF0] rounded" />
            </div>
          ))}
        </div>
      ) : error || !payment ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-12 text-center space-y-3">
          <p className="text-[#766B73]">{uz.common.yuklash_xatosi}</p>
          <Link href="/admin/tolovlar" className="text-sm text-[#8E315D] hover:underline">
            To&apos;lovlar ro&apos;yxatiga qaytish
          </Link>
        </div>
      ) : (
        <>
          {/* Status banner */}
          <div className={`flex items-center gap-3 rounded-xl px-5 py-4 ${
            payment.status === "paid"    ? "bg-[#F0FDF4] border border-[#BBF7D0]" :
            payment.status === "pending" ? "bg-[#FFFBEB] border border-[#FDE68A]" :
            payment.status === "failed"  ? "bg-[#FEF2F2] border border-[#FECACA]" :
                                           "bg-[#FAF5F8] border border-[#EDE3E8]"
          }`}>
            <Badge variant={payStatusVariant(payment.status)}>
              {payStatusLabel(payment.status)}
            </Badge>
            <span className="text-sm font-bold text-[#29232A]">
              {fmtMoney(payment.amount, payment.currency)}
            </span>
            {payment.paid_at && (
              <span className="text-sm text-[#766B73] ml-auto">{fmtDate(payment.paid_at)}</span>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-[#EDE3E8] px-6 py-2">
            <h2 className="text-sm font-semibold text-[#3D3240] uppercase tracking-wide py-3.5 border-b border-[#F2ECF0]">
              To&apos;lov ma&apos;lumotlari
            </h2>

            <Row label="To'lov ID">#{payment.id}</Row>
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
          <div className="bg-white rounded-xl border border-[#EDE3E8] px-6 py-2">
            <h2 className="text-sm font-semibold text-[#3D3240] uppercase tracking-wide py-3.5 border-b border-[#F2ECF0]">
              Tashkilot va obuna
            </h2>

            <Row label="Bog'cha">
              {payment.organization ? (
                <Link
                  href={`/admin/bogchalar/${payment.organization.id}`}
                  className="text-[#8E315D] hover:text-[#742548] transition-colors"
                >
                  {payment.organization.name}
                </Link>
              ) : "—"}
            </Row>
            <Row label={uz.super_admin.tarif}>{payment.plan_name ?? "—"}</Row>
            <Row label="Obuna ID">
              {payment.subscription_id ? `#${payment.subscription_id}` : "—"}
            </Row>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-xl border border-[#EDE3E8] px-6 py-2">
            <h2 className="text-sm font-semibold text-[#3D3240] uppercase tracking-wide py-3.5 border-b border-[#F2ECF0]">
              Sanalar
            </h2>

            <Row label="Yaratilgan sana">{fmtDate(payment.created_at)}</Row>
            <Row label="To'langan sana">{fmtDate(payment.paid_at)}</Row>
            <Row label="Muddati">{fmtDate(payment.due_at)}</Row>
          </div>

          {/* Back link */}
          <div className="pb-4">
            <Link
              href="/admin/tolovlar"
              className="text-sm text-[#8E315D] hover:text-[#742548] font-medium transition-colors"
            >
              ← To&apos;lovlar ro&apos;yxatiga qaytish
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
