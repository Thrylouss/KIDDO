"use client";

import uz from "@/i18n";
import { CHILDREN, DEMO_PARENT_CHILD_ID } from "@/lib/smart-safety/model";
import { groupOf } from "@/lib/smart-safety/engine";
import Icon, { type AnyIcon } from "./Icons";
import { DemoBadge, childName, fmtTime, incidentLabel, personName, useSafety } from "./shared";

/**
 * Ota-ona mobil ilovasi — KONSEPT (responsive web namunasi). Faqat o'z farzandi: boshqa bolalar, xarita yoki joylashuv,
 * ichki hodisa tafsilotlari ko'rsatilmaydi. Bildirishnomalar faqat shu demo ichida (haqiqiy ota-onalarga yuborilmaydi).
 */
export default function ParentApp({ childId = DEMO_PARENT_CHILD_ID }: { childId?: string }) {
  const { state } = useSafety();
  const t = uz.ssx.parent;
  const old = uz.ss.parent;
  const child = CHILDREN.find((c) => c.id === childId)!;
  const st = state.children[childId];
  const notices = state.notices.filter((n) => n.childId === childId);
  const attention = state.incidents.some((i) => i.childId === childId && i.status !== "resolved" && i.severity !== "warning");
  const text = (code: string, params: Record<string, string | number>) => {
    const tpl = { arrival: old.n_arrival, departure: old.n_departure, safety: old.n_safety, device: old.n_device }[code] ?? code;
    return tpl.replace("{person}", personName(String(params.person ?? ""))).replace("{type}", incidentLabel(String(params.type ?? "")));
  };

  const answers: { q: string; a: string; ok: boolean | null; icon: AnyIcon; id: string }[] = [
    { id: "arrived", q: t.arrived_q, a: st.arrivedAt ? t.arrived_yes.replace("{time}", fmtTime(st.arrivedAt)) : t.arrived_no, ok: st.arrivedAt ? true : null, icon: "door" },
    { id: "handed", q: t.handed_q, a: st.departedAt ? t.handed_yes.replace("{person}", personName(st.pickedUpBy)).replace("{time}", fmtTime(st.departedAt)) : t.handed_no, ok: st.departedAt ? true : null, icon: "handover" },
    { id: "safety", q: t.alerts_q, a: attention ? t.alerts_attention : t.alerts_ok, ok: !attention, icon: "shield" },
  ];

  return (
    <div className="mx-auto w-full max-w-[390px]">
      <p className="mb-3 flex items-center justify-center gap-2 text-xs text-[var(--text-2)]" role="note"><DemoBadge />{t.concept}</p>
      <div className="overflow-hidden rounded-[2.2rem] border-[7px] border-[var(--ink)] bg-[var(--bg)] shadow-xl" data-testid="parent-app">
        <div className="bg-[var(--primary)] px-5 pb-5 pt-4 text-white">
          <p className="text-xs font-semibold tracking-wide opacity-80">KIDDO</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-lg font-bold">{child.name.split(" ").map((p) => p[0]).join("")}</span>
            <div><p className="text-xl font-bold">{childName(childId)}</p><p className="text-sm opacity-85">{groupOf(childId)?.name}</p></div>
          </div>
        </div>
        <div className="space-y-3 p-3">
          {answers.map((x) => (
            <section key={x.id} className="flex items-center gap-3 rounded-2xl bg-[var(--card)] p-4" data-testid={`parent-${x.id}`}>
              <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${x.ok === false ? "bg-[var(--warning-soft)] text-[var(--warning-text)]" : x.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-2)] text-[var(--text-3)]"}`}>
                <Icon name={x.ok ? (x.id === "safety" ? "shield" : "check") : x.icon} />
              </span>
              <div className="min-w-0"><p className="text-xs text-[var(--text-2)]">{x.q}</p><p className="text-base font-semibold text-[var(--text)]">{x.a}</p></div>
            </section>
          ))}
          <section className="rounded-2xl bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">{old.notifications}</p>
            {notices.length === 0 ? <p className="text-sm text-[var(--text-3)]">{old.none}</p> : (
              <ul className="space-y-2 text-sm" data-testid="parent-notices">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-2 text-[var(--text)]"><Icon name="bell" className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--primary)]" />{text(n.code, n.params)}</span>
                    <span className="tabular-nums text-xs text-[var(--text-3)]">{fmtTime(n.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl bg-[var(--card)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">{t.day}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-[11px] text-[var(--text-2)]">{uz.ssx.att.arrival}</dt><dd className="font-semibold tabular-nums">{fmtTime(st.arrivedAt)}</dd></div>
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-[11px] text-[var(--text-2)]">{uz.ss.modules.meal}</dt><dd className="font-semibold tabular-nums">{state.meals[childId] ? fmtTime(state.meals[childId]) : "—"}</dd></div>
              <div className="rounded-xl bg-[var(--surface-2)] py-2"><dt className="text-[11px] text-[var(--text-2)]">{uz.ssx.att.departure}</dt><dd className="font-semibold tabular-nums">{fmtTime(st.departedAt)}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-[var(--text-3)]">{uz.ssx.act.not_medical}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
