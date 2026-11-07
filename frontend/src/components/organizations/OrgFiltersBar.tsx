"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_FILTERS, ORG_STATUSES, PER_PAGE_OPTIONS, REGIONS, STATUS_LABELS, activeFilterCount, type OrgFilters } from "@/lib/organizations";
import uz from "@/i18n/uz";

const t = uz.bogchalar;

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: t.sort_yangi },
  { value: "oldest", label: t.sort_eski },
  { value: "name_asc", label: t.sort_az },
  { value: "name_desc", label: t.sort_za },
  { value: "children_desc", label: t.sort_bola_kop },
  { value: "children_asc", label: t.sort_bola_kam },
];

const ctl = "h-10 w-full rounded-lg border border-[#EDE3E8] bg-white px-3 text-sm text-[#29232A] outline-none focus:border-[#8E315D] focus:ring-2 focus:ring-[#8E315D]/15";

/** Qidiruv (debounce), turi/holat/tuman, qo'shimcha filtrlar (sana, bolalar soni, ma'lumot turi), saralash. */
export default function OrgFiltersBar({ filters, districts, regions, mfys, onChange, onReset }: {
  filters: OrgFilters; districts: string[]; regions: string[]; mfys: string[];
  onChange: (patch: Partial<OrgFilters>) => void; onReset: () => void;
}) {
  const [search, setSearch] = useState(filters.search);
  const advanced = !!(filters.region || filters.mfy || filters.created_from || filters.created_to || filters.children_min
    || filters.children_max || filters.groups_min || filters.groups_max || filters.turi !== "real");
  const [more, setMore] = useState(advanced);
  const [mfy, setMfy] = useState(filters.mfy);
  const mfyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // URL'dan tiklangan qo'shimcha filtrlar bo'lsa — panel ochiq ko'rinsin
  useEffect(() => { if (advanced) setMore(true); }, [advanced]);
  useEffect(() => { setMfy(filters.mfy); }, [filters.mfy]);
  useEffect(() => () => clearTimeout(mfyTimer.current), []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Tashqaridan tozalansa (filtrlarni tozalash) — input ham yangilanadi
  useEffect(() => { setSearch(filters.search); }, [filters.search]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(v: string) {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ search: v.trim() }), 350);
  }

  const sortValue = SORTS.some((s) => s.value === filters.sort) ? filters.sort : "";
  const count = activeFilterCount(filters);

  return (
    <div className="mb-4 rounded-xl border border-[#EDE3E8] bg-white p-3 sm:p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,170px))]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={t.qidiruv} aria-label={t.qidiruv}
            className={`${ctl} pl-9`} />
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8AAB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <select aria-label={t.turi} value={filters.type} onChange={(e) => onChange({ type: e.target.value as OrgFilters["type"] })} className={ctl}>
          <option value="">{t.filtr_barcha_turlar}</option>
          <option value="davlat">{t.turi_davlat}</option>
          <option value="xususiy">{t.turi_xususiy}</option>
        </select>
        <select aria-label={t.holat} value={filters.status} onChange={(e) => onChange({ status: e.target.value as OrgFilters["status"] })} className={ctl}>
          <option value="">{t.filtr_barcha_holat}</option>
          {ORG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select aria-label={t.filtr_tuman} value={filters.district} onChange={(e) => onChange({ district: e.target.value })} className={ctl}>
          <option value="">{t.filtr_barcha_tuman}</option>
          {[...new Set([...districts, ...(filters.district ? [filters.district] : [])])].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label={t.saralash} value={sortValue} onChange={(e) => onChange({ sort: e.target.value, direction: "" })} className={ctl}>
          {!sortValue && <option value="">{t.saralash}</option>}
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-controls="org-more-filters"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#8E315D] hover:bg-[#FDF2F6]">
          {t.qoshimcha_filtr}
          <span aria-hidden="true" className={`transition-transform ${more ? "rotate-180" : ""}`}>▾</span>
        </button>
        {count > 0 && (
          <button type="button" onClick={onReset} className="rounded-lg px-2.5 py-1.5 text-sm text-[#766B73] hover:bg-[#F2ECF0] hover:text-[#29232A]">
            {t.filtr_tozalash} ({count})
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-[#766B73]">
          {t.sahifada}
          <select value={filters.per_page} onChange={(e) => onChange({ per_page: Number(e.target.value) })} className="h-9 rounded-lg border border-[#EDE3E8] bg-white px-2 text-sm outline-none focus:border-[#8E315D]">
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {more && (
        <div id="org-more-filters" className="grid grid-cols-1 gap-3 border-t border-[#F2ECF0] pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-[#766B73]">{t.f_viloyat}
            <select value={filters.region} onChange={(e) => onChange({ region: e.target.value })} className={`${ctl} mt-1`}>
              <option value="">{t.filtr_barcha_viloyat}</option>
              {[...new Set([...REGIONS, ...regions, ...(filters.region ? [filters.region] : [])])].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.f_mfy}
            <input list="org-filter-mfy" value={mfy} className={`${ctl} mt-1`} placeholder={t.filtr_mfy_ph}
              onChange={(e) => { const v = e.target.value; setMfy(v); clearTimeout(mfyTimer.current); mfyTimer.current = setTimeout(() => onChange({ mfy: v.trim() }), 350); }} />
            <datalist id="org-filter-mfy">{mfys.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_sana_dan}
            <input type="date" value={filters.created_from} max={filters.created_to || undefined} onChange={(e) => onChange({ created_from: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_sana_gacha}
            <input type="date" value={filters.created_to} min={filters.created_from || undefined} onChange={(e) => onChange({ created_to: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_bola_min}
            <input type="number" min={0} inputMode="numeric" value={filters.children_min} onChange={(e) => onChange({ children_min: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_bola_max}
            <input type="number" min={0} inputMode="numeric" value={filters.children_max} onChange={(e) => onChange({ children_max: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_guruh_min}
            <input type="number" min={0} inputMode="numeric" value={filters.groups_min} onChange={(e) => onChange({ groups_min: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_guruh_max}
            <input type="number" min={0} inputMode="numeric" value={filters.groups_max} onChange={(e) => onChange({ groups_max: e.target.value })} className={`${ctl} mt-1`} />
          </label>
          <label className="text-xs font-medium text-[#766B73]">{t.filtr_malumot}
            <select data-testid="filter-turi" value={filters.turi} onChange={(e) => onChange({ turi: e.target.value as OrgFilters["turi"] })} className={`${ctl} mt-1`}>
              <option value="real">{uz.super_admin.turi_haqiqiy}</option>
              <option value="demo">{uz.super_admin.turi_demo}</option>
              <option value="all">{uz.super_admin.turi_hammasi}</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_FILTERS };
