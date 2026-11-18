"use client";

import AccountSettings from "@/components/settings/AccountSettings";
import { BILLING_ENABLED } from "@/lib/features";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function SuperAdminSozlamalarPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return (
    <AccountSettings>
      {!BILLING_ENABLED && (
        <section className="bg-white rounded-xl border border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">{uz.sozlamalar.platforma}</h2>
          <p className="text-xs text-[var(--text-2)] mt-1">{uz.sozlamalar.platforma_izoh}</p>
        </section>
      )}
    </AccountSettings>
  );
}
