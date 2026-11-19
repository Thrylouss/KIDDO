"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/contexts/PreferencesContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import ContentCard from "@/components/kids/ContentCard";
import ContentFormModal from "@/components/kids/ContentFormModal";
import VideoPlayerModal from "@/components/kids/VideoPlayerModal";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { formatUzDate } from "@/lib/dates";
import uz, { plural } from "@/i18n";
import { KIDS_CATEGORIES, KIDS_LANGUAGES, type KidsContent, type KidsGroup, type KidsPage, type KidsUsage } from "@/lib/kids";

type Tab = "library" | "usage";

const filterCls = "h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

/** KIDDO Kids → Kontent kutubxonasi: faqat bog'cha rahbari (Super Admin uchun ko'rsatilmaydi — backend ham 403). */
export default function KiddoKidsLibraryPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const t = uz.kids;
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("library");

  if (user?.role === "super_admin") {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title={`${t.bolim} — ${t.kutubxona}`} />
        <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{t.sa_taqiq}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={`${t.bolim} — ${t.kutubxona}`} description={t.kutubxona_tavsif} />
      <div role="tablist" aria-label={t.bolim} className="mb-5 inline-flex rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
        {(["library", "usage"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${tab === k ? "bg-[var(--primary)] text-white" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}>
            {k === "library" ? t.kutubxona_tab : t.tarix_tab}
          </button>
        ))}
      </div>
      {tab === "library" ? <Library /> : <UsageHistory />}
    </div>
  );
}

function Library() {
  const t = uz.kids;
  const [rows, setRows] = useState<KidsContent[]>([]);
  const [groups, setGroups] = useState<KidsGroup[]>([]);
  const [meta, setMeta] = useState<KidsPage<KidsContent>["meta"] | null>(null);
  const [filters, setFilters] = useState({ q: "", language: "", category: "", status: "", group_id: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<KidsContent | null | "new">(null);
  const [playing, setPlaying] = useState<KidsContent | null>(null);
  const [deleting, setDeleting] = useState<KidsContent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([k, v]) => { if (v.trim()) qs.set(k, v.trim()); });
      const res = await api.get<KidsPage<KidsContent>>(`/v1/admin/kids/contents?${qs}`);
      setRows(res?.data ?? []);
      setGroups(res?.groups ?? []);
      setMeta(res?.meta ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const id = setTimeout(load, filters.q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, filters.q]);

  const setFilter = (k: keyof typeof filters, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const hasFilters = Object.values(filters).some(Boolean);

  async function toggleStatus(c: KidsContent) {
    setNotice("");
    try {
      const res = await api.patch<{ data: KidsContent }>(`/v1/admin/kids/contents/${c.id}/status`, { status: c.status === "active" ? "hidden" : "active" });
      if (res?.data) setRows((p) => p.map((r) => (r.id === c.id ? { ...r, ...res.data } : r)));
      setNotice(t.holat_ozgardi);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await api.delete(`/v1/admin/kids/contents/${deleting.id}`);
    setDeleting(null);
    setNotice(t.ochirildi);
    if (rows.length === 1 && page > 1) setPage(page - 1); else await load();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder={t.qidirish} aria-label={t.qidirish}
          className={`${filterCls} flex-1 min-w-[200px]`} />
        <select aria-label={t.til} value={filters.language} onChange={(e) => setFilter("language", e.target.value)} className={filterCls}>
          <option value="">{t.barcha_tillar}</option>
          {KIDS_LANGUAGES.map((l) => <option key={l} value={l}>{t.til_nomi[l]}</option>)}
        </select>
        <select aria-label={t.kategoriya} value={filters.category} onChange={(e) => setFilter("category", e.target.value)} className={filterCls}>
          <option value="">{t.barcha_kategoriyalar}</option>
          {KIDS_CATEGORIES.map((c) => <option key={c} value={c}>{t.kat[c]}</option>)}
        </select>
        <select aria-label={t.holat} value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={filterCls}>
          <option value="">{t.barcha_holatlar}</option>
          <option value="active">{t.faol}</option>
          <option value="hidden">{t.yashirin}</option>
        </select>
        <select aria-label={t.guruh} value={filters.group_id} onChange={(e) => setFilter("group_id", e.target.value)} className={filterCls}>
          <option value="">{t.barcha_guruhlar}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <Button onClick={() => { setNotice(""); setEditing("new"); }}>{t.qoshish}</Button>
      </div>

      {notice && <p role="status" className="mb-4 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error-text)]">{error}</p>}

      {loading && rows.length === 0 ? (
        <SkeletonCards count={8} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {hasFilters
            ? <EmptyState title={t.topilmadi} description={t.topilmadi_tavsif} />
            : <EmptyState title={t.bosh} description={t.bosh_tavsif} action={{ label: t.qoshish, onClick: () => setEditing("new") }} />}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="kids-grid">
          {rows.map((c) => (
            <ContentCard key={c.id} content={c} onPlay={() => setPlaying(c)}
              extra={
                <div className="text-xs text-[var(--text-2)] space-y-0.5">
                  <p className="line-clamp-2">{c.groups?.length ? c.groups.map((g) => g.name).join(", ") : <span className="text-[var(--warning-text)]">{t.guruhlarsiz}</span>}</p>
                  {!!c.usage_count && <p>{c.usage_count} {plural(c.usage_count, t.foydalanildi)}</p>}
                </div>
              }
              actions={<>
                <Button size="sm" variant="secondary" onClick={() => { setNotice(""); setEditing(c); }}>{uz.common.tahrirlash}</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(c)}>{c.status === "active" ? t.yashirish : t.faollashtirish}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNotice(""); setDeleting(c); }} aria-label={`${t.ochirish}: ${c.title}`}>
                  <span className="text-[var(--error-text)]">{t.ochirish}</span>
                </Button>
              </>}
            />
          ))}
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--text-2)]">{uz.common.jami} {meta.total}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{uz.common.oldingi}</Button>
            <Button size="sm" variant="secondary" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>{uz.common.keyingi}</Button>
          </div>
        </div>
      )}

      {editing && (
        <ContentFormModal groups={groups} content={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={(_c, created) => { setEditing(null); setNotice(created ? t.qoshildi : t.saqlandi); load(); }} />
      )}
      {playing && <VideoPlayerModal content={playing} onClose={() => setPlaying(null)} />}
      <ConfirmDialog open={deleting !== null} title={t.ochirish_sarlavha} danger confirmLabel={t.ochirish}
        message={deleting ? `«${deleting.title}» — ${t.ochirish_matn}` : ""} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  );
}

function UsageHistory() {
  const t = uz.kids;
  const [rows, setRows] = useState<KidsUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ data: KidsUsage[]; meta: { last_page: number } }>(`/v1/admin/kids/usage?page=${page}`)
      .then((res) => { if (!cancelled) { setRows(res?.data ?? []); setLastPage(res?.meta?.last_page ?? 1); } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {error && <p role="alert" className="px-5 py-4 text-sm text-[var(--error-text)]">{error}</p>}
      {loading ? (
        <p className="p-8 text-center text-sm text-[var(--text-2)]">{uz.common.yuklanmoqda}</p>
      ) : rows.length === 0 ? (
        <EmptyState title={t.t_bosh} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="kids-usage">
            <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wide text-[var(--text-2)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t.t_sana}</th>
                <th className="px-4 py-3 font-medium">{t.t_material}</th>
                <th className="px-4 py-3 font-medium">{t.guruh}</th>
                <th className="px-4 py-3 font-medium">{t.t_tarbiyachi}</th>
                <th className="px-4 py-3 font-medium">{t.t_izoh}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-2)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--hover)]">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--label)]">{formatUzDate(r.used_on)}</td>
                  <td className="px-4 py-3 text-[var(--text)]">{r.content?.title ?? "—"}{r.content?.deleted && <span className="ml-1.5 text-xs text-[var(--text-3)]">({t.t_ochirilgan})</span>}</td>
                  <td className="px-4 py-3 text-[var(--label)]">{r.group?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--label)]">{r.teacher ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-2)]">{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lastPage > 1 && (
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{uz.common.oldingi}</Button>
          <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>{uz.common.keyingi}</Button>
        </div>
      )}
    </div>
  );
}
