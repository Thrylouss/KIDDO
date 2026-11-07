"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo-data";
import AccountSettings from "@/components/settings/AccountSettings";
import type { TeacherDashboard } from "@/types";
import uz from "@/i18n/uz";

const t = uz.sozlamalar;

/** Tarbiyachi sozlamalari: hisob, ish profili (faqat ko'rish — rahbar yangilaydi) va o'z paroli. */
export default function TarbiyachiSozlamalarPage() {
  const [info, setInfo]     = useState<Pick<TeacherDashboard, "teacher" | "groups"> | null>(null);
  const [error, setError]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (IS_DEMO) { setLoaded(true); return; }
    api.get<TeacherDashboard>("/v1/teacher/dashboard")
      .then((r) => setInfo(r ? { teacher: r.teacher, groups: r.groups } : null))
      .catch(() => setError(true))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <AccountSettings>
      {!IS_DEMO && (
        <section className="bg-white rounded-xl border border-[#EDE3E8]">
          <div className="px-5 py-4 border-b border-[#EDE3E8]">
            <h2 className="text-sm font-semibold text-[#29232A]">{t.ish_profili}</h2>
            <p className="text-xs text-[#766B73] mt-0.5">{t.ish_profili_izoh}</p>
          </div>
          {error ? (
            <p role="alert" className="px-5 py-4 text-sm text-[#B91C1C]">{uz.common.yuklash_xatosi}</p>
          ) : !loaded ? (
            <p className="px-5 py-4 text-sm text-[#B8AAB2]">{uz.common.yuklanmoqda}</p>
          ) : (
            <dl data-testid="teacher-profile" className="divide-y divide-[#F2ECF0]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3 text-sm">
                <dt className="sm:w-40 text-[#766B73]">{t.lavozim}</dt>
                <dd className="text-[#29232A] font-medium">{info?.teacher.position || "—"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-5 py-3 text-sm">
                <dt className="sm:w-40 text-[#766B73]">{t.guruhlarim}</dt>
                <dd className="text-[#29232A] font-medium min-w-0">
                  {info?.groups.length ? info.groups.map((g) => g.name).join(", ") : t.guruh_biriktirilmagan}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}
    </AccountSettings>
  );
}
