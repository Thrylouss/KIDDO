"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage, RELATION_LABELS } from "@/lib/apiErrors";
import { formatAge, formatUzDate } from "@/lib/dates";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import ChildPhotoUploader from "@/components/ChildPhotoUploader";
import ChildDailyHistory from "@/components/ChildDailyHistory";
import MonthlyAttendance from "@/components/attendance/MonthlyAttendance";
import type { TeacherChildProfile } from "@/types";
import uz from "@/i18n/uz";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[#766B73]">{label}</dt>
      <dd className="text-sm text-[#29232A] mt-0.5">{children}</dd>
    </div>
  );
}

/** Bola profili — faqat tarbiyachiga biriktirilgan guruh bolasi (server 404 qaytaradi). */
export default function BolaProfiliPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [child,   setChild]   = useState<TeacherChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setChild((await api.get<{ data: TeacherChildProfile }>(`/v1/teacher/children/${id}`)).data);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (IS_DEMO) return;
    if (Number.isInteger(id) && id > 0) load();
    else { setError(uz.common.topilmadi); setLoading(false); }
  }, [id, load]);

  const back = (
    <Link href="/tarbiyachi/guruh" className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline">
      ← {uz.guruh.orqaga}
    </Link>
  );

  if (IS_DEMO) {
    return <div className="max-w-5xl mx-auto space-y-4">{back}<p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-4 py-3">{uz.kundalik.demo}</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {back}

      {loading && !child ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#EDE3E8] p-8 text-center">
          <p role="alert" className="text-sm text-[#766B73] mb-3">{error}</p>
          {error !== uz.common.topilmadi && <Button size="sm" variant="secondary" onClick={load}>{uz.common.qayta_urinish}</Button>}
        </div>
      ) : child ? (
        <>
          <section className="bg-white rounded-2xl border border-[#EDE3E8] p-5 flex flex-col sm:flex-row gap-5">
            <div className="flex justify-center sm:block">
              <ChildPhotoUploader
                childId={child.id}
                firstName={child.first_name}
                lastName={child.last_name}
                photoUrl={child.photo_url}
                basePath="/v1/teacher/children"
                onChange={(photo_url) => setChild({ ...child, photo_url })}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-[#29232A]">
                    {child.last_name} {child.first_name}{child.middle_name ? ` ${child.middle_name}` : ""}
                  </h1>
                  <p className="text-sm text-[#766B73]">{child.group?.name}{child.group?.age_category ? ` · ${child.group.age_category}` : ""}</p>
                </div>
                <Badge variant={child.is_active ? "success" : "neutral"}>{child.is_active ? uz.common.faol : uz.common.nofaol}</Badge>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label={uz.guruh.tugilgan}>{formatUzDate(child.birth_date)}</Field>
                <Field label={uz.guruh.yosh}>{formatAge(child.birth_date) || "—"}</Field>
                <Field label={uz.guruh.jinsi}>{child.gender === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz}</Field>
                <Field label={uz.guruh.guruh}>{child.group?.name ?? "—"}</Field>
                <Field label={uz.guruh.qabul_sanasi}>{child.admitted_at ? formatUzDate(child.admitted_at) : uz.guruh.korsatilmagan}</Field>
                <Field label={uz.guruh.aloqa}>
                  {child.contact ? <a href={`tel:${child.contact.phone}`} className="text-[var(--primary)] hover:underline">{child.contact.phone}</a> : "—"}
                </Field>
              </dl>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white rounded-2xl border border-[#EDE3E8] p-5">
              <h2 className="text-sm font-semibold text-[#29232A] mb-3">{uz.guruh.ota_onalar}</h2>
              {child.parents.length === 0 ? (
                <p className="text-sm text-[#766B73]">{uz.guruh.ota_ona_yoq}</p>
              ) : (
                <ul className="divide-y divide-[#F2ECF0]">
                  {child.parents.map((p) => (
                    <li key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#29232A]">{p.last_name} {p.first_name}</p>
                        <p className="text-xs text-[#766B73]">
                          {RELATION_LABELS[p.relation_type] ?? p.relation_type}{p.is_primary ? ` · ${uz.guruh.asosiy}` : ""}
                        </p>
                      </div>
                      <a href={`tel:${p.phone}`} className="text-sm text-[var(--primary)] hover:underline">{p.phone}</a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-[#EDE3E8] p-5">
              <h2 className="text-sm font-semibold text-[#29232A]">{uz.guruh.tibbiy}</h2>
              <p className="text-[11px] text-[#B8AAB2] mb-3">{uz.guruh.tibbiy_izoh}</p>
              <p data-testid="medical-notes" className="text-sm text-[#3D3240] whitespace-pre-line">{child.medical_notes || uz.guruh.tibbiy_yoq}</p>
            </section>
          </div>

          <ChildDailyHistory childId={child.id} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#29232A]">{uz.guruh.davomat_oylik}</h2>
            <MonthlyAttendance basePath="/v1/teacher/attendance" childId={child.id} groupId={child.group?.id} />
          </section>
        </>
      ) : null}
    </div>
  );
}
