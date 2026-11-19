"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import uz, { getLocale } from "@/i18n";
import { dispatch } from "@/lib/smart-safety/store";
import { enableSound, setAlarm, soundEnabled } from "@/lib/smart-safety/alarm";
import { groupOf, needsAlarm, type Actor, type Incident } from "@/lib/smart-safety/engine";
import { CHILDREN, GROUPS } from "@/lib/smart-safety/model";
import Icon, { Avatar } from "./Icons";
import { btn, childName, fmtTime, incidentLabel, useSafety, zoneName } from "./shared";

const inScope = (i: Incident, childIds: string[] | null) => !childIds || (i.childId !== null && childIds.includes(i.childId));
const firstName = (id: string | null) => childName(id).split(" ")[0];

/** Oddiy tildagi xabar: «DIQQAT! Jasur oshxona hududiga kirdi.» */
export function incidentMessage(i: Incident): string {
  const tpl = (uz.ssx.msg as Record<string, string>)[i.type] ?? incidentLabel(i.type);
  let zone = zoneName(i.zoneId);
  if (getLocale() === "uz") zone = zone.charAt(0).toLowerCase() + zone.slice(1);
  return tpl.replace("{child}", firstName(i.childId)).replace("{zone}", zone);
}

/** Qizil — faqat haqiqiy kritik holat; qolgan e'tibor talab qiladigan holatlar — sariq. */
const tone = (i: Incident) => (i.severity === "critical" ? "danger" : "warning");

/**
 * Bitta banner: eng muhim hal qilinmagan xabar (kritik/yuqori). Qabul qilingandan keyin ham hodisa yopilmaguncha ko'rinadi.
 * Ovoz faqat brauzer ruxsatidan keyin va qabul qilinmaguncha takrorlanadi; ruxsatsiz — vizual signal.
 */
export function AlertBanner({ childIds, actor, alertsHref, mapHref }: { childIds: string[] | null; actor: Actor; alertsHref: string; mapHref: (childId: string) => string }) {
  const { state } = useSafety();
  const t = uz.ssx.alert;
  const [sound, setSound] = useState(false);
  useEffect(() => { setSound(soundEnabled()); }, []);
  const urgent = state.incidents
    .filter((i) => i.status !== "resolved" && i.severity !== "warning" && inScope(i, childIds))
    .sort((a, b) => Number(a.status !== "open") - Number(b.status !== "open") || Number(b.severity === "critical") - Number(a.severity === "critical"));
  const alarm = needsAlarm(state, childIds ?? undefined);

  useEffect(() => {
    setAlarm(sound && alarm);
    return () => setAlarm(false);
  }, [sound, alarm]);

  if (!urgent.length) return null;
  const top = urgent[0];
  const danger = tone(top) === "danger";
  const acked = top.status === "acknowledged";

  return (
    <div role="alert" data-testid="critical-banner" data-tone={danger ? "danger" : "warning"}
      className={`mb-5 rounded-2xl border-2 p-4 sm:p-5 ${danger ? "border-[var(--error-text)] bg-[var(--error-soft)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)]"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="relative mt-1 flex-shrink-0">
            <Avatar name={childName(top.childId)} size="lg" alert={danger} />
            {!acked && <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--card)] ${danger ? "bg-[var(--error-text)] motion-safe:animate-pulse" : "bg-[var(--warning-text)]"}`} />}
          </span>
          <div className="min-w-0">
            <p className={`text-lg font-bold leading-snug sm:text-xl ${danger ? "text-[var(--error-text)]" : "text-[var(--warning-text)]"}`} data-testid="banner-message">{incidentMessage(top)}</p>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--label)]">
              <div className="flex gap-1"><dt className="text-[var(--text-2)]">{t.group}:</dt><dd>{groupOf(top.childId ?? "")?.name ?? "—"}</dd></div>
              <div className="flex gap-1"><dt className="text-[var(--text-2)]">{t.location}:</dt><dd>{zoneName(top.zoneId)}</dd></div>
              <div className="flex gap-1"><dt className="text-[var(--text-2)]">{t.time}:</dt><dd className="tabular-nums">{fmtTime(top.openedAt)}</dd></div>
              <div className="flex gap-1"><dt className="text-[var(--text-2)]">{t.kind}:</dt><dd>{incidentLabel(top.type)}</dd></div>
            </dl>
            {top.escalatedAt && !acked && <p className="mt-1.5 text-sm font-semibold text-[var(--error-text)]" data-testid="escalated">{t.escalated}</p>}
            {acked && <p className="mt-1.5 text-sm font-medium text-[var(--label)]">{t.ack_note}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch lg:flex-row">
          {!acked
            ? <button type="button" className={`${danger ? btn.danger : btn.primary} h-11 px-5 text-base`} onClick={() => dispatch({ type: "ack", incidentId: top.id, by: actor })}>{t.ack}</button>
            : <Link href={alertsHref} className={`${btn.primary} h-11 px-5 text-base`}>{t.verify_btn}</Link>}
          {top.childId && <Link href={mapHref(top.childId)} className={`${btn.secondary} h-11 px-4`}><Icon name="map" className="h-4 w-4" />{t.show_map}</Link>}
          {!sound && !acked && (
            <button type="button" className={`${btn.secondary} h-11 px-4`} onClick={() => setSound(enableSound())} title={uz.ss.sim.sound_hint}>
              <Icon name="sound" className="h-4 w-4" />{uz.ss.sim.sound_on}
            </button>
          )}
        </div>
      </div>
      {urgent.length > 1 && <Link href={alertsHref} className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">{t.more.replace("{n}", String(urgent.length - 1))} →</Link>}
    </div>
  );
}

/** Ogohlantirishlar sahifasi: faol xabarlar, eslatmalar (sariq), yopilgan hodisalar tarixi. */
export default function AlertCenter({ childIds, actor, mapHref }: { childIds: string[] | null; actor: Actor; mapHref: (childId: string) => string }) {
  const { state } = useSafety();
  const t = uz.ssx.alert;
  const rows = state.incidents.filter((i) => inScope(i, childIds));
  const active = rows.filter((i) => i.status !== "resolved" && i.severity !== "warning");
  const warnings = rows.filter((i) => i.status !== "resolved" && i.severity === "warning");
  const done = rows.filter((i) => i.status === "resolved");

  return (
    <div className="grid gap-6">
      <section aria-labelledby="ss-active">
        <h2 id="ss-active" className="mb-3 text-base font-semibold text-[var(--text)]">{t.active} <span className="text-[var(--text-3)]">({active.length})</span></h2>
        {active.length === 0 ? <Empty text={t.none} /> : (
          <ul className="grid gap-3" data-testid="open-incidents">{active.map((i) => <IncidentCard key={i.id} incident={i} actor={actor} mapHref={mapHref} />)}</ul>
        )}
      </section>
      <section aria-labelledby="ss-warn">
        <h2 id="ss-warn" className="mb-3 text-base font-semibold text-[var(--text)]">{t.warnings} <span className="text-[var(--text-3)]">({warnings.length})</span></h2>
        {warnings.length === 0 ? <Empty text={t.none} /> : (
          <ul className="grid gap-3" data-testid="warnings">{warnings.map((i) => <IncidentCard key={i.id} incident={i} actor={actor} mapHref={mapHref} />)}</ul>
        )}
      </section>
      <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[var(--text)]">{t.closed} ({done.length})</summary>
        <ul className="divide-y divide-[var(--border-2)] border-t border-[var(--border-2)] text-sm" data-testid="closed-incidents">
          {done.length === 0 && <li className="px-4 py-3 text-[var(--text-2)]">—</li>}
          {done.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <p className="font-medium text-[var(--text)]">{incidentMessage(i)}</p>
              <p className="text-xs text-[var(--text-2)]">{fmtTime(i.openedAt)} → {fmtTime(i.resolvedAt)} · {uz.ss.audit.actors[i.resolvedBy ?? "system"]}{i.note ? ` · “${i.note}”` : ""}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-sm text-[var(--text-2)]"><Icon name="check" className="h-4 w-4 text-[var(--success)]" />{text}</p>;
}

function IncidentCard({ incident: i, actor, mapHref }: { incident: Incident; actor: Actor; mapHref: (childId: string) => string }) {
  const t = uz.ssx.alert;
  const [seen, setSeen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const danger = tone(i) === "danger";
  const child = CHILDREN.find((c) => c.id === i.childId);

  function resolve() {
    if (!seen || note.trim().length < 3) { setError(t.verify_need); return; }
    setError("");
    dispatch({ type: "resolve", incidentId: i.id, by: actor, note });
  }

  return (
    <li className={`rounded-2xl border bg-[var(--card)] p-4 ${danger ? "border-[var(--error-border)]" : "border-[var(--warning-border)]"}`} data-testid={`incident-${i.id}`} data-status={i.status}>
      <div className="flex items-start gap-3">
        {child ? <Avatar name={child.name} tone={child.groupId === GROUPS[0].id ? "primary" : "accent"} alert={danger && i.status === "open"} />
          : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--warning-soft)] text-[var(--warning-text)]"><Icon name="alert" /></span>}
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${danger ? "text-[var(--error-text)]" : "text-[var(--text)]"}`}>{incidentMessage(i)}</p>
          <p className="mt-0.5 text-sm text-[var(--text-2)]">{groupOf(i.childId ?? "")?.name ?? "—"} · {zoneName(i.zoneId)} · <span className="tabular-nums">{fmtTime(i.openedAt)}</span></p>
          {i.escalatedAt && i.status === "open" && <p className="mt-1 text-sm font-semibold text-[var(--error-text)]">{t.escalated}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {i.status === "open" && <button type="button" className={danger ? btn.danger : btn.primary} onClick={() => dispatch({ type: "ack", incidentId: i.id, by: actor })}>{t.ack}</button>}
        {i.childId && i.type !== "battery_low" && <Link href={mapHref(i.childId)} className={btn.secondary}><Icon name="map" className="h-4 w-4" />{t.show_map}</Link>}
      </div>
      {i.status === "acknowledged" && (
        <fieldset className="mt-3 rounded-xl bg-[var(--surface-2)] p-3" data-testid={`verify-${i.id}`}>
          <legend className="sr-only">{t.verify_title}</legend>
          <p className="mb-2 text-sm font-medium text-[var(--text)]">{t.verify_title}</p>
          <label className="mb-2 flex cursor-pointer items-start gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={seen} onChange={(e) => setSeen(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
            {t.verify_check}
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`note-${i.id}`}>{t.verify_note}</label>
            <input id={`note-${i.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.verify_note} maxLength={500}
              className="h-9 min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
            <button type="button" className={btn.primary} onClick={resolve}>{t.verify_btn}</button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-[var(--error-text)]">{error}</p>}
        </fieldset>
      )}
    </li>
  );
}
