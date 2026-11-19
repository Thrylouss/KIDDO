"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/contexts/PreferencesContext";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import ContentCard from "@/components/kids/ContentCard";
import VideoPlayerModal from "@/components/kids/VideoPlayerModal";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import uz from "@/i18n";
import { KIDS_CATEGORIES, KIDS_LANGUAGES, type KidsCategory, type KidsContent, type KidsGroup, type KidsPage } from "@/lib/kids";

type Tab = "all" | KidsCategory | "favorites";
const TABS: Tab[] = ["all", ...KIDS_CATEGORIES, "favorites"];

const filterCls = "h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

/** KIDDO Kids → Ta'lim va hordiq: faqat o'z guruh(lar)iga biriktirilgan va yoshiga mos kontent (backend filtrlaydi). */
export default function TeacherKiddoKidsPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const t = uz.kids;
  const [rows, setRows] = useState<KidsContent[]>([]);
  const [groups, setGroups] = useState<KidsGroup[]>([]);
  // groupId — foydalanuvchi tanlovi (so'rovga ketadi); activeGroupId — server qaytargan faol guruh (ikkinchi so'rov yuborilmaydi)
  const [groupId, setGroupId] = useState<number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [language, setLanguage] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState<KidsContent | null>(null);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (groupId) qs.set("group_id", String(groupId));
      if (tab === "favorites") qs.set("favorites", "1");
      else if (tab !== "all") qs.set("category", tab);
      if (language) qs.set("language", language);
      if (q.trim()) qs.set("q", q.trim());
      const res = await api.get<KidsPage<KidsContent>>(`/v1/teacher/kids/contents?${qs}`);
      setRows(res?.data ?? []);
      setGroups(res?.groups ?? []);
      setActiveGroupId(res?.group_id ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [groupId, tab, language, q]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  async function toggleFavorite(c: KidsContent) {
    const next = !c.is_favorite;
    setRows((p) => p.map((r) => (r.id === c.id ? { ...r, is_favorite: next } : r)));   // optimistik
    try {
      await api.put(`/v1/teacher/kids/contents/${c.id}/favorite`, { favorite: next });
      if (tab === "favorites" && !next) setRows((p) => p.filter((r) => r.id !== c.id));
    } catch (e) {
      setRows((p) => p.map((r) => (r.id === c.id ? { ...r, is_favorite: !next } : r)));
      setError(errorMessage(e));
    }
  }

  async function logUsage(c: KidsContent) {
    if (!activeGroupId) return;
    setLogging(true);
    try {
      await api.post(`/v1/teacher/kids/contents/${c.id}/usage`, { group_id: activeGroupId });
      setNotice(t.foydalanish_qayd);
      setPlaying(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLogging(false);
    }
  }

  const noGroups = loaded && !error && groups.length === 0;
  const tabLabel = (k: Tab) => (k === "all" ? t.hammasi : k === "favorites" ? t.sevimlilar : t.kat[k]);
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={`${t.bolim} — ${t.talim_hordiq}`} description={t.talim_tavsif} />

      {noGroups ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]"><EmptyState title={t.guruh_yoq} /></div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {groups.length > 1 ? (
              <select aria-label={t.guruh} value={activeGroupId ?? ""} onChange={(e) => setGroupId(Number(e.target.value) || null)} className={filterCls}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.age_category ? ` · ${g.age_category}` : ""}</option>)}
              </select>
            ) : activeGroup && (
              <span className="inline-flex h-10 items-center rounded-lg bg-[var(--primary-lt)] px-3 text-sm font-medium text-[var(--primary)]">
                {activeGroup.name}{activeGroup.age_category ? ` · ${activeGroup.age_category}` : ""}
              </span>
            )}
            <select aria-label={t.til} value={language} onChange={(e) => setLanguage(e.target.value)} className={filterCls}>
              <option value="">{t.barcha_tillar}</option>
              {KIDS_LANGUAGES.map((l) => <option key={l} value={l}>{t.til_nomi[l]}</option>)}
            </select>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.qidirish} aria-label={t.qidirish}
              className={`${filterCls} flex-1 min-w-[200px]`} />
          </div>

          <div role="tablist" aria-label={t.kategoriya} className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex-shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${tab === k ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--label)] hover:bg-[var(--hover)]"}`}>
                {k === "favorites" && <span aria-hidden="true" className="mr-1">♥</span>}{tabLabel(k)}
              </button>
            ))}
          </div>

          {notice && <p role="status" className="mb-4 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">{notice}</p>}
          {error && <p role="alert" className="mb-4 rounded-lg bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error-text)]">{error}</p>}

          {loading && rows.length === 0 ? (
            <SkeletonCards count={8} />
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              {tab !== "all" || language || q
                ? <EmptyState title={t.topilmadi} description={t.topilmadi_tavsif} />
                : <EmptyState title={t.tarbiyachi_bosh} description={t.tarbiyachi_bosh_tavsif} />}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="kids-grid">
              {rows.map((c) => (
                <ContentCard key={c.id} content={c} onPlay={() => { setNotice(""); setPlaying(c); }}
                  actions={<>
                    <Button size="sm" onClick={() => { setNotice(""); setPlaying(c); }}>{t.tomosha}</Button>
                    <button type="button" onClick={() => toggleFavorite(c)} aria-pressed={!!c.is_favorite}
                      aria-label={c.is_favorite ? t.sevimlidan_olish : t.sevimli_qoshish} title={c.is_favorite ? t.sevimlidan_olish : t.sevimli_qoshish}
                      className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${c.is_favorite ? "text-[var(--primary)] bg-[var(--primary-lt)]" : "text-[var(--text-3)] hover:text-[var(--primary)] hover:bg-[var(--hover)]"}`}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={c.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinejoin="round" d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />
                      </svg>
                    </button>
                  </>}
                />
              ))}
            </div>
          )}
        </>
      )}

      {playing && (
        <VideoPlayerModal content={playing} onClose={() => setPlaying(null)}
          footer={<Button onClick={() => logUsage(playing)} loading={logging} className="sm:mr-auto">{t.foydalandim}</Button>} />
      )}
    </div>
  );
}
