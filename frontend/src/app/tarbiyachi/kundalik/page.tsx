"use client";

import { IS_DEMO } from "@/lib/demo-data";
import PageHeader from "@/components/ui/PageHeader";
import DailyManager from "@/components/daily/DailyManager";
import uz from "@/i18n/uz";

export default function TarbiyachiKundalikPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title={uz.kundalik.sarlavha} description={uz.kundalik.tavsif_tarbiyachi} />
      {IS_DEMO ? (
        <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-4 py-3">
          {uz.kundalik.demo}
        </p>
      ) : (
        <DailyManager basePath="/v1/teacher/daily" noGroupsText={uz.kundalik.guruh_yoq_tarbiyachi} />
      )}
    </div>
  );
}
