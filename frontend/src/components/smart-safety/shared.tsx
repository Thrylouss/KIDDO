"use client";

import { useSyncExternalStore } from "react";
import uz, { intlLocale } from "@/i18n";
import Badge from "@/components/ui/Badge";
import { getServerSnapshot, getSnapshot, subscribe, type Snapshot } from "@/lib/smart-safety/store";
import { CHILDREN, PICKUP_PERSONS, STAFF } from "@/lib/smart-safety/model";
import type { DeviceKind, IncidentStatus, IncidentType, LogEntry, Severity } from "@/lib/smart-safety/engine";

export function useSafety(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const ZONE_KEYS: Record<string, keyof typeof uz.ss.zone> = {
  "z-class-a": "class_a", "z-class-b": "class_b", "z-kitchen": "kitchen", "z-tech": "tech", "z-corridor": "corridor",
  "z-playground": "playground", "z-hall": "hall", "z-entrance": "entrance", "z-exit": "exit", "z-assembly": "assembly",
};

export const zoneName = (id: string | null | undefined) => (id && ZONE_KEYS[id] ? uz.ss.zone[ZONE_KEYS[id]] : "—");
export const childName = (id: string | null | undefined) => CHILDREN.find((c) => c.id === id)?.name ?? "—";
export const personName = (id: string | null | undefined) => PICKUP_PERSONS.find((p) => p.id === id)?.name ?? "—";
export const staffName = (id: string) => STAFF.find((s) => s.id === id)?.name ?? "—";
export const kindLabel = (k: DeviceKind) => uz.ss.device_kind[k];
export const incidentLabel = (t: IncidentType | string) => uz.ss.incident.type[t as IncidentType] ?? t;

export function fmtTime(ms: number | null | undefined, withSeconds = false): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
}

/** Jurnal yozuvini joriy tilda matnga aylantiradi (ism/zona/tur parametrlari ham tarjima qilinadi). */
export function fmtLog(e: LogEntry): string {
  const tpl = (uz.ss.audit.codes as Record<string, string>)[e.code] ?? e.code;
  const p = e.params;
  const values: Record<string, string> = {
    ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    child: childName(String(p.child ?? "")), person: personName(String(p.person ?? "")),
    zone: zoneName(String(p.zone ?? "")), type: incidentLabel(String(p.type ?? "")),
    key: (uz.ss.features as Record<string, string>)[String(p.key ?? "")] ?? String(p.key ?? ""),
  };
  return tpl.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
}

export function Card({ title, action, children, className = "" }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-2)] px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, tone = "default", hint }: { label: string; value: React.ReactNode; tone?: "default" | "danger" | "warning" | "success"; hint?: string }) {
  const color = { default: "text-[var(--text)]", danger: "text-[var(--error-text)]", warning: "text-[var(--warning-text)]", success: "text-[var(--success)]" }[tone];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-2)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text-3)]">{hint}</p>}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={severity === "critical" ? "error" : severity === "high" ? "warning" : "neutral"}>{uz.ss.incident.severity[severity]}</Badge>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={status === "open" ? "error" : status === "acknowledged" ? "warning" : "success"}>{uz.ss.incident.status[status]}</Badge>;
}

export function DemoBadge() {
  return <span className="inline-flex items-center rounded-md bg-[var(--warning-bg)] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[var(--warning-text)]" data-testid="demo-badge">{uz.ss.demo}</span>;
}

export function SoonBadge({ text }: { text?: string }) {
  return <span className="inline-flex items-center rounded-md bg-[var(--primary-lt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">{text ?? uz.ss.soon}</span>;
}

export function BatteryBar({ level }: { level: number }) {
  const tone = level <= 15 ? "bg-[var(--error-text)]" : level <= 35 ? "bg-[var(--warning-text)]" : "bg-[var(--success)]";
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${uz.ss.table.battery}: ${level}%`}>
      <span className="relative h-2.5 w-8 overflow-hidden rounded-sm border border-[var(--border-strong)]">
        <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${level}%` }} />
      </span>
      <span className="tabular-nums text-xs text-[var(--label)]">{level}%</span>
    </span>
  );
}

/** Oddiy gorizontal ustunli diagramma (SVG/CSS, tashqi kutubxonasiz). */
export function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-2 text-xs">
          <span className="truncate text-[var(--label)]">{r.label}</span>
          <span className="h-2.5 rounded-full bg-[var(--border-2)]">
            <span className="block h-full rounded-full bg-[var(--primary)] transition-all duration-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-[var(--text)]">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 text-sm font-medium text-white hover:bg-[var(--primary-h)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:opacity-50",
  secondary: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:opacity-50",
  danger: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--error-text)] px-3.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error-text)]/40 disabled:opacity-50",
};
