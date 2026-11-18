"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { formatAge, formatUzDate } from "@/lib/dates";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import ChildPhoto from "@/components/ChildPhoto";
import type { TeacherChild } from "@/types";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

interface ChildrenResponse {
  groups: { id: number; name: string; age_category: string | null; capacity: number | null }[];
  data:   TeacherChild[];
}

type View = "card" | "table";

const genderLabel = (g: TeacherChild["gender"]) => (g === "erkak" ? uz.bolalar.jins_erkak : uz.bolalar.jins_qiz);

/** Tarbiyachiga biriktirilgan guruh(lar) bolalari: qidiruv, filtrlar, kartochka/jadval ko'rinishi. */
export default function MeningGuruhimPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const [res,     setRes]     = useState<ChildrenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [groupId, setGroupId] = useState("");
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");
  const [gender,  setGender]  = useState("");
  const [view,    setView]    = useState<View>("card");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRes(await api.get<ChildrenResponse>(groupId ? `/v1/teacher/children?group_id=${groupId}` : "/v1/teacher/children"));
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      setError(e?.status === 403 && e.data?.message ? e.data.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { if (!IS_DEMO) load(); }, [load]);

  const children = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (res?.data ?? []).filter((c) =>
      (!q || [c.first_name, c.last_name, c.middle_name ?? "", c.contact?.name ?? ""].join(" ").toLowerCase().includes(q))
      && (!status || (status === "faol") === c.is_active)
      && (!gender || c.gender === gender));
  }, [res, search, status, gender]);

  const group = res?.groups.find((g) => String(g.id) === groupId) ?? (res?.groups.length === 1 ? res.groups[0] : null);

  if (IS_DEMO) {
    return (
      <div className="max-w-6xl mx-auto">
        <PageHeader title={uz.guruh.sarlavha} description={uz.guruh.tavsif} />
        <p role="note" className="rounded-lg bg-[var(--warning-soft)] border border-[var(--warning-border)] text-[var(--warning-text)] text-sm px-4 py-3">{uz.kundalik.demo}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader title={uz.guruh.sarlavha} description={uz.guruh.tavsif} />

      {group && (
        <div data-testid="group-summary" className="bg-[var(--primary)] rounded-2xl p-5 text-white flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{uz.guruh.guruh}</p>
            <h2 className="text-xl font-bold">{group.name}</h2>
            {group.age_category && <p className="text-white/70 text-sm">{group.age_category}</p>}
          </div>
          <p className="text-2xl font-bold">
            {res?.data.filter((c) => c.is_active).length ?? 0}
            {group.capacity ? <span className="text-white/70 text-base font-medium"> / {group.capacity} {uz.guruh.sigim}</span> : null}
          </p>
        </div>
      )}

      {/* Filtrlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,180px))_auto] gap-3 items-end">
        <Input id="guruh-qidiruv" placeholder={uz.guruh.qidirish} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={uz.guruh.qidirish} />
        {res && res.groups.length > 1 && (
          <Select id="guruh-tanlov" aria-label={uz.guruh.guruh} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{uz.bolalar.hammasi}</option>
            {res.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        )}
        <Select id="guruh-holat" aria-label={uz.guruh.holat} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{uz.guruh.holat_hammasi}</option>
          <option value="faol">{uz.guruh.faol}</option>
          <option value="nofaol">{uz.guruh.nofaol}</option>
        </Select>
        <Select id="guruh-jins" aria-label={uz.guruh.jinsi} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">{uz.guruh.jins_hammasi}</option>
          <option value="erkak">{uz.bolalar.jins_erkak}</option>
          <option value="ayol">{uz.bolalar.jins_qiz}</option>
        </Select>
        <div role="group" aria-label={uz.guruh.kartochka} className="inline-flex rounded-lg border border-[var(--border)] bg-white p-0.5">
          {([["card", uz.guruh.kartochka], ["table", uz.guruh.jadval]] as [View, string][]).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded-md ${view === v ? "bg-[var(--primary-lt)] text-[var(--primary)] font-medium" : "text-[var(--text-2)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !res ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-8 text-center">
          <p role="alert" className="text-sm text-[var(--text-2)] mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={load}>{uz.common.qayta_urinish}</Button>
        </div>
      ) : res && res.groups.length === 0 ? (
        <p className="bg-white rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-2)]">{uz.guruh.guruh_yoq}</p>
      ) : children.length === 0 ? (
        <p className="bg-white rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-2)]">
          {res?.data.length ? uz.guruh.natija_yoq : uz.guruh.bola_yoq}
        </p>
      ) : view === "card" ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="children-cards">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/tarbiyachi/bolalar/${c.id}`}
                className="flex gap-3 bg-white rounded-xl border border-[var(--border)] p-4 hover:shadow-sm hover:border-[var(--border-strong)] transition">
                <ChildPhoto firstName={c.first_name} lastName={c.last_name} photoUrl={c.photo_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[var(--text)] truncate">{c.last_name} {c.first_name}</p>
                    {!c.is_active && <Badge variant="neutral">{uz.common.nofaol}</Badge>}
                  </div>
                  <p className="text-xs text-[var(--text-2)] mt-0.5">{formatAge(c.birth_date)} · {genderLabel(c.gender)}</p>
                  {c.contact && <p className="text-xs text-[var(--text-3)] mt-1 truncate">{c.contact.name} · {c.contact.phone}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm" data-testid="children-table">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                <th className="px-4 py-3">{uz.guruh.fish}</th>
                <th className="px-4 py-3">{uz.guruh.tugilgan}</th>
                <th className="px-4 py-3">{uz.guruh.yosh}</th>
                <th className="px-4 py-3">{uz.guruh.jinsi}</th>
                <th className="px-4 py-3">{uz.guruh.aloqa}</th>
                <th className="px-4 py-3">{uz.guruh.holat}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-2)]">
              {children.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3">
                    <Link href={`/tarbiyachi/bolalar/${c.id}`} className="font-medium text-[var(--text)] hover:text-[var(--primary)] whitespace-nowrap">
                      {c.last_name} {c.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-2)] whitespace-nowrap">{formatUzDate(c.birth_date)}</td>
                  <td className="px-4 py-3 text-[var(--text-2)] whitespace-nowrap">{formatAge(c.birth_date)}</td>
                  <td className="px-4 py-3 text-[var(--text-2)]">{genderLabel(c.gender)}</td>
                  <td className="px-4 py-3 text-[var(--text-2)] whitespace-nowrap">{c.contact ? `${c.contact.name} · ${c.contact.phone}` : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.is_active ? "success" : "neutral"}>{c.is_active ? uz.common.faol : uz.common.nofaol}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
