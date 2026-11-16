"use client";

import { IS_DEMO } from "@/lib/demo-data";
import PageHeader from "@/components/ui/PageHeader";
import DailyManager from "@/components/daily/DailyManager";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function BogchaKundalikPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={uz.kundalik.sarlavha} description={uz.kundalik.tavsif_admin} />
      {IS_DEMO ? (
        <p role="note" className="rounded-lg bg-[var(--warning-soft)] border border-[var(--warning-border)] text-[var(--warning-text)] text-sm px-4 py-3">
          {uz.kundalik.demo}
        </p>
      ) : (
        <DailyManager basePath="/v1/admin/daily" noGroupsText={uz.kundalik.guruh_yoq_admin} />
      )}
    </div>
  );
}
