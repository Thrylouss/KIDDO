"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import uz from "@/i18n";
import { loadGuided, pause, reset, setResolveNote, start } from "@/lib/smart-safety/store";
import { SCENARIOS } from "@/lib/smart-safety/engine";
import { GUIDED, guidedState } from "@/lib/smart-safety/presenter";
import { PRESENT_ROLE, sectionHref } from "@/lib/smart-safety/nav";
import type { Role } from "@/lib/smart-safety/model";
import Icon from "./Icons";
import { btn, fmtTime, useSafety } from "./shared";

export const presentHref = (role: Role, section = "", query = "") => sectionHref(`/smart-safety/${PRESENT_ROLE[role]}`, section, query);

const ROLES: Role[] = ["director", "teacher", "parent", "super_admin"];
const OPEN_KEY = "kiddo.smartSafety.presenterOpen";

/** Boshqariladigan taqdimotning k-qadamini ochadi: holat toza boshlanishdan deterministik quriladi. */
export function useGuided() {
  const router = useRouter();
  return (k: number) => {
    const g = GUIDED[k];
    setResolveNote(uz.ss.resolve_note);
    loadGuided(guidedState(k, uz.ss.resolve_note), k);
    router.push(presentHref(g.role, g.section, g.query ?? ""));
  };
}

/**
 * Taqdimotchi paneli — faqat taqdimot rejimida (oddiy ish rejimida hech qachon ko'rsatilmaydi).
 * Yig'iladigan: yig'ilganda faqat kichik tugma qoladi va ekranni egallamaydi.
 */
export default function PresenterToolbar({ role }: { role: Role }) {
  const { state, runner } = useSafety();
  const t = uz.ssx.pres;
  const router = useRouter();
  const go = useGuided();
  const [open, setOpenState] = useState(true);
  // Yig'ilgan/ochiq holat shu tab sessiyasida bo'limlar o'rtasida saqlanadi
  useEffect(() => { try { if (sessionStorage.getItem(OPEN_KEY) === "0") setOpenState(false); } catch { /* e'tiborsiz */ } }, []);
  const setOpen = (v: boolean) => { setOpenState(v); try { sessionStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* e'tiborsiz */ } };
  const [pick, setPick] = useState("full");
  useEffect(() => { setResolveNote(uz.ss.resolve_note); });
  const g = runner.guided;
  const step = g >= 0 ? GUIDED[g] : null;
  const gt = step ? (uz.ssx.guided as Record<string, { title: string; desc: string }>)[step.key] : null;
  const scenarioName = (key: string) => (uz.ss.scenario as Record<string, string>)[key] ?? key;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="presenter-open"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] shadow-lg hover:bg-[var(--hover)]">
        <span className="h-2 w-2 rounded-full bg-[var(--warning-text)]" />{t.title}{step ? ` · ${g + 1}/${GUIDED.length}` : ""}
      </button>
    );
  }

  return (
    <aside aria-label={t.title} data-testid="presenter"
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[25rem]">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[var(--warning-bg)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[var(--warning-text)]">{uz.ss.demo}</span>
        <span className="text-sm font-semibold text-[var(--text)]">{t.title}</span>
        <span className="ml-auto text-xs tabular-nums text-[var(--text-2)]" data-testid="sim-clock">{fmtTime(state.now, true)}</span>
        <button type="button" onClick={() => setOpen(false)} aria-label={t.collapse} className="rounded-lg p-1 text-[var(--text-3)] hover:bg-[var(--hover)]"><Icon name="close" className="h-4 w-4" /></button>
      </div>

      {/* Bosqichma-bosqich taqdimot */}
      <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
        {step && gt ? (
          <>
            <p className="text-xs font-medium text-[var(--text-2)]" data-testid="guided-step">{t.step.replace("{n}", String(g + 1)).replace("{total}", String(GUIDED.length))}</p>
            <p className="mt-0.5 font-semibold text-[var(--text)]">{gt.title}</p>
            <p className="mt-1 text-sm text-[var(--label)]">{gt.desc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} disabled={g === 0} onClick={() => go(g - 1)}><Icon name="prev" className="h-4 w-4" />{t.prev}</button>
              {g < GUIDED.length - 1
                ? <button type="button" className={btn.primary} onClick={() => go(g + 1)} data-testid="guided-next">{t.next}<Icon name="next" className="h-4 w-4" /></button>
                : <button type="button" className={btn.primary} onClick={() => go(0)}>{t.restart}</button>}
            </div>
          </>
        ) : (
          <button type="button" className={`${btn.primary} w-full`} onClick={() => go(0)} data-testid="guided-start">{t.start_guided}</button>
        )}
      </div>

      {/* Rol almashtirish */}
      <p className="mt-3 mb-1.5 text-xs font-medium text-[var(--text-2)]">{t.roles}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {ROLES.map((r) => (
          <button key={r} type="button" onClick={() => router.push(presentHref(r))} aria-pressed={role === r}
            className={`rounded-lg px-2 py-1.5 text-sm font-medium ${role === r ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] text-[var(--label)] hover:bg-[var(--hover)]"}`}>{uz.ss.roles[r]}</button>
        ))}
      </div>

      {/* Barcha 17 ssenariy (yig'iladigan) */}
      <details className="mt-3">
        <summary className="cursor-pointer select-none text-xs font-medium text-[var(--text-2)]">{t.scenarios}</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="simulator">
          <label className="sr-only" htmlFor="ss-scenario">{uz.ss.sim.scenario}</label>
          <select id="ss-scenario" value={pick} onChange={(e) => setPick(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--text)]">
            <option value="full">{uz.ss.sim.full}</option>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.id}. {scenarioName(s.key)}</option>)}
          </select>
          {runner.running
            ? <button type="button" className={btn.secondary} onClick={pause} aria-label={uz.ss.sim.pause}><Icon name="pause" className="h-4 w-4" />{uz.ss.sim.pause}</button>
            : <button type="button" className={btn.primary} onClick={() => start(pick === "full" ? null : Number(pick))}><Icon name="play" className="h-4 w-4" />{pick === "full" ? uz.ss.sim.start : uz.ss.sim.run}</button>}
          <button type="button" className={btn.secondary} onClick={reset} aria-label={uz.ss.sim.reset}><Icon name="reset" className="h-4 w-4" /></button>
        </div>
        {!runner.full || runner.running ? (
          <p className="mt-1.5 text-[11px] text-[var(--text-2)]" aria-live="polite" data-testid="sim-scenario">
            {runner.running ? uz.ss.sim.running : uz.ss.sim.paused} · {runner.scenario}. {scenarioName(SCENARIOS.find((s) => s.id === runner.scenario)?.key ?? "")}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] text-[var(--text-3)]">{uz.ss.sim.tabs_hint}</p>
      </details>
    </aside>
  );
}
