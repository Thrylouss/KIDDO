"use client";

import AccountSettings from "@/components/settings/AccountSettings";
import { BILLING_ENABLED } from "@/lib/features";
import uz from "@/i18n/uz";

export default function SuperAdminSozlamalarPage() {
  return (
    <AccountSettings>
      {!BILLING_ENABLED && (
        <section className="bg-white rounded-xl border border-[#EDE3E8] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#29232A]">{uz.sozlamalar.platforma}</h2>
          <p className="text-xs text-[#766B73] mt-1">{uz.sozlamalar.platforma_izoh}</p>
        </section>
      )}
    </AccountSettings>
  );
}
