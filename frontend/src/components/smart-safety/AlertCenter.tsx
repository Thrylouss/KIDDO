"use client";

import { useEffect, useState } from "react";
import uz from "@/i18n";
import { dispatch } from "@/lib/smart-safety/store";
import { enableSound, setAlarm, soundAvailable } from "@/lib/smart-safety/alarm";
import { needsAlarm, type Actor, type Incident } from "@/lib/smart-safety/engine";
import { Card, SeverityBadge, StatusBadge, btn, childName, fmtTime, incidentLabel, useSafety, zoneName } from "./shared";

const inScope = (i: Incident, childIds: string[] | null) => !childIds || (i.childId !== null && childIds.includes(i.childId));

/** Kritik banner: qabul qilinmagan kritik/yuqori insidentlar bo'lsa — miltillovchi banner va (ruxsat bo'lsa) takroriy ovoz. */
export function AlertBanner({ childIds, actor }: { childIds: string[] | null; actor: Actor }) {
  const { state } = useSafety();
  const t = uz.ss.incident;
  const [sound, setSound] = useState(false);
  const urgent = state.incidents.filter((i) => i.status === "open" && i.severity !== "warning" && inScope(i, childIds));
  const alarm = needsAlarm(state, childIds ?? undefined);

  useEffect(() => {
    setAlarm(sound && alarm);
    return () => setAlarm(false);
  }, [sound, alarm]);

  if (!urgent.length) return null;
  const top = urgent[0];

  return (
    <div role="alert" data-testid="critical-banner"
      className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-[var(--error-text)] bg-[var(--error-soft)] p-4 ring-4 ring-[var(--error-text)]/15 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--error-text)]">
          {/* Vizual signal: matn doim to'liq o'qiladi, faqat indikator miltillaydi */}
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--error-text)] opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--error-text)]" />
          </span>{t.banner_title}{urgent.length > 1 ? ` · +${urgent.length - 1} ${t.more}` : ""}</p>
        <p className="mt-1 text-base font-semibold text-[var(--text)]">{incidentLabel(top.type)} — {childName(top.childId)}</p>
        <p className="text-sm text-[var(--label)]">{zoneName(top.zoneId)} · {fmtTime(top.openedAt, true)} · <SeverityBadge severity={top.severity} />
          {top.escalatedAt && <span className="ml-2 font-semibold text-[var(--error-text)]">{t.escalated}</span>}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!sound && (
          <button type="button" className={btn.secondary} onClick={() => setSound(enableSound())} title={uz.ss.sim.sound_hint}>🔔 {uz.ss.sim.sound_on}</button>
        )}
        {sound && soundAvailable() && <span className="self-center text-xs text-[var(--text-2)]">🔊 {uz.ss.sim.sound_active}</span>}
        <button type="button" className={btn.danger} onClick={() => dispatch({ type: "ack", incidentId: top.id, by: actor })}>{t.acknowledge}</button>
      </div>
    </div>
  );
}

/** Ogohlantirishlar markazi: ro'yxat, qabul qilish, izohli yechish, tarix. */
export default function AlertCenter({ childIds, actor, readOnly = false }: { childIds: string[] | null; actor: Actor; readOnly?: boolean }) {
  const { state } = useSafety();
  const t = uz.ss.incident;
  const rows = state.incidents.filter((i) => inScope(i, childIds));
  const open = rows.filter((i) => i.status !== "resolved");
  const done = rows.filter((i) => i.status === "resolved");

  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--primary)]">{t.ack_hint}</p>
      <Card title={`${uz.ss.kpi.open_incidents} (${open.length})`}>
        {open.length === 0 ? <p className="text-sm text-[var(--text-2)]">{t.none}</p> : (
          <ul className="divide-y divide-[var(--border-2)]" data-testid="open-incidents">
            {open.map((i) => <IncidentRow key={i.id} incident={i} actor={actor} readOnly={readOnly} />)}
          </ul>
        )}
      </Card>
      <Card title={t.history}>
        {done.length === 0 ? <p className="text-sm text-[var(--text-2)]">—</p> : (
          <ul className="divide-y divide-[var(--border-2)] text-sm">
            {done.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                <code className="text-xs text-[var(--text-3)]">{i.id}</code>
                <span className="font-medium text-[var(--text)]">{incidentLabel(i.type)}</span>
                <span className="text-[var(--text-2)]">{childName(i.childId)}</span>
                <StatusBadge status={i.status} />
                <span className="text-xs text-[var(--text-3)]">{fmtTime(i.openedAt)} → {fmtTime(i.resolvedAt)}</span>
                {i.note && <span className="w-full text-xs text-[var(--text-2)]">“{i.note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function IncidentRow({ incident: i, actor, readOnly }: { incident: Incident; actor: Actor; readOnly: boolean }) {
  const t = uz.ss.incident;
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function resolve() {
    if (note.trim().length < 3) { setError(t.note_required); return; }
    setError("");
    dispatch({ type: "resolve", incidentId: i.id, by: actor, note });
  }

  return (
    <li className="py-3" data-testid={`incident-${i.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs text-[var(--text-3)]">{i.id}</code>
        <span className="font-semibold text-[var(--text)]">{incidentLabel(i.type)}</span>
        <SeverityBadge severity={i.severity} />
        <StatusBadge status={i.status} />
        {i.escalatedAt && <span className="text-xs font-semibold text-[var(--error-text)]">{t.escalated}</span>}
      </div>
      <p className="mt-1 text-sm text-[var(--label)]">{childName(i.childId)} · {zoneName(i.zoneId)} · {t.opened}: {fmtTime(i.openedAt, true)}{i.deviceId ? ` · ${i.deviceId}` : ""}</p>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          {i.status === "open" && <button type="button" className={btn.danger} onClick={() => dispatch({ type: "ack", incidentId: i.id, by: actor })}>{t.acknowledge}</button>}
          {i.status === "acknowledged" && (
            <>
              <label className="sr-only" htmlFor={`note-${i.id}`}>{t.note_ph}</label>
              <input id={`note-${i.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.note_ph} maxLength={500}
                className="h-9 min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]" />
              <button type="button" className={btn.primary} onClick={resolve}>{t.resolve}</button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-[var(--error-text)]">{error}</p>}
    </li>
  );
}
