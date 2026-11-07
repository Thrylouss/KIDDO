import { notFound } from "next/navigation";
import { BILLING_ENABLED } from "@/lib/features";

/**
 * Billing sahifalari (tariflar, obunalar, to'lovlar, hisob-fakturalar) uchun umumiy layout:
 * BILLING_ENABLED=false bo'lsa sahifa URL orqali ham ochilmaydi — 404. Backend ham bu API'larni yopadi
 * (config kiddo.billing.enabled → EnsureBillingEnabled middleware).
 */
export default function BillingGate({ children }: { children: React.ReactNode }) {
  if (!BILLING_ENABLED) notFound();
  return <>{children}</>;
}
