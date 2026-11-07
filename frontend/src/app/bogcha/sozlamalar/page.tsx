"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import AccountSettings from "@/components/settings/AccountSettings";
import uz from "@/i18n/uz";

const t = uz.sozlamalar;

interface Bogcha {
  name: string; address: string | null; phone: string | null; district?: string | null; number?: string | null;
  mfy?: string | null; capacity?: number | null; director_name?: string | null; director_phone?: string | null;
}

/** Rahbar sozlamalari: bog'cha ma'lumotlari (faqat ko'rish — Super Admin yangilaydi) va o'z paroli. */
export default function BogchaSozlamalarPage() {
  const [bogcha, setBogcha] = useState<Bogcha | null>(null);
  const [error, setError]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<{ bogcha: Bogcha | null }>("/v1/admin/dashboard")
      .then((r) => setBogcha(r?.bogcha ?? null))
      .catch(() => setError(true))
      .finally(() => setLoaded(true));
  }, []);

  const rows: [string, string | number | null | undefined][] = bogcha ? [
    [uz.bogcha_import.nomi, bogcha.name], [t.raqami, bogcha.number], [t.tuman, bogcha.district], [t.mfy, bogcha.mfy],
    [t.manzil, bogcha.address], [t.quvvati, bogcha.capacity], [t.rahbar, bogcha.director_name], [t.telefon, bogcha.director_phone ?? bogcha.phone],
  ] : [];

  return (
    <AccountSettings>
      <section className="bg-white rounded-xl border border-[#EDE3E8]">
        <div className="px-5 py-4 border-b border-[#EDE3E8]">
          <h2 className="text-sm font-semibold text-[#29232A]">{t.bogcha}</h2>
          <p className="text-xs text-[#766B73] mt-0.5">{t.bogcha_izoh}</p>
        </div>
        {error ? (
          <p role="alert" className="px-5 py-4 text-sm text-[#B91C1C]">{uz.common.yuklash_xatosi}</p>
        ) : !loaded ? (
          <p className="px-5 py-4 text-sm text-[#B8AAB2]">{uz.common.yuklanmoqda}</p>
        ) : !bogcha ? (
          <p className="px-5 py-4 text-sm text-[#B8AAB2]">—</p>
        ) : (
          <dl data-testid="bogcha-info" className="divide-y divide-[#F2ECF0]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3 text-sm">
                <dt className="sm:w-40 text-[#766B73]">{label}</dt>
                <dd className="text-[#29232A] font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </AccountSettings>
  );
}
