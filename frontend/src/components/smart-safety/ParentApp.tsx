"use client";

import uz from "@/i18n";
import Badge from "@/components/ui/Badge";
import { CHILDREN, DEMO_PARENT_CHILD_ID, PICKUP_PERSONS } from "@/lib/smart-safety/model";
import { deviceOf } from "@/lib/smart-safety/engine";
import { BatteryBar, DemoBadge, childName, fmtTime, incidentLabel, personName, useSafety } from "./shared";

/**
 * Ota-ona mobil ilovasi DEMO (responsive web) — native ilova alohida bosqich. Faqat o'z farzandi ko'rinadi:
 * boshqa bolalar, joylashuv xaritasi yoki ichki insident tafsilotlari ko'rsatilmaydi. Bildirishnomalar faqat shu demo ichida.
 */
export default function ParentApp({ childId = DEMO_PARENT_CHILD_ID }: { childId?: string }) {
  const { state } = useSafety();
  const t = uz.ss.parent;
  const child = CHILDREN.find((c) => c.id === childId)!;
  const st = state.children[childId];
  const dev = state.devices[deviceOf(childId)!];
  const notices = state.notices.filter((n) => n.childId === childId);
  const status = st.departedAt ? t.picked_up : st.arrivedAt ? t.at_kindergarten : t.not_arrived;
  const text = (code: string, params: Record<string, string | number>) => {
    const tpl = { arrival: t.n_arrival, departure: t.n_departure, safety: t.n_safety, device: t.n_device }[code] ?? code;
    return tpl.replace("{person}", personName(String(params.person ?? ""))).replace("{type}", incidentLabel(String(params.type ?? "")));
  };

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <p className="mb-3 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-text)]" role="note">{t.label}</p>
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--bg)] shadow-xl" data-testid="parent-app">
        <div className="flex items-center justify-between bg-[var(--primary)] px-4 py-3 text-white">
          <span className="text-sm font-semibold">KIDDO</span><DemoBadge />
        </div>
        <div className="space-y-3 p-3">
          <section className="rounded-2xl bg-[var(--card)] p-3">
            <p className="text-xs text-[var(--text-2)]">{t.child_status}</p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--text)]">{childName(childId)}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={st.departedAt ? "neutral" : st.arrivedAt ? "success" : "warning"}>{status}</Badge>
              <span className="text-xs text-[var(--text-2)]">{fmtTime(st.arrivedAt)}{st.departedAt ? ` → ${fmtTime(st.departedAt)}` : ""}</span>
            </div>
          </section>
          <section className="rounded-2xl bg-[var(--card)] p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--text-2)]">{t.notifications}</p>
            {notices.length === 0 ? <p className="text-sm text-[var(--text-3)]">{t.none}</p> : (
              <ul className="space-y-1.5 text-sm" data-testid="parent-notices">
                {notices.slice(0, 6).map((n) => (
                  <li key={n.id} className="flex justify-between gap-2"><span className="text-[var(--text)]">{text(n.code, n.params)}</span><span className="tabular-nums text-xs text-[var(--text-3)]">{fmtTime(n.at)}</span></li>
                ))}
              </ul>
            )}
          </section>
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--card)] p-3">
              <p className="text-xs text-[var(--text-2)]">{t.device_status}</p>
              <div className="mt-1"><BatteryBar level={dev.battery} /></div>
              <p className="mt-1 text-xs text-[var(--label)]">{uz.ss.device_status[dev.status]}</p>
            </div>
            <div className="rounded-2xl bg-[var(--card)] p-3">
              <p className="text-xs text-[var(--text-2)]">{t.activity_summary}</p>
              <p className="mt-1 text-xs text-[var(--label)]">{uz.ss.modules.meal}: {state.meals[childId] ? fmtTime(state.meals[childId]) : "—"}</p>
              <p className="text-xs text-[var(--label)]">{uz.ss.modules.activity}: {Math.round(state.distance[childId] ?? 0)} {uz.ss.v2.meters}</p>
            </div>
          </section>
          <section className="rounded-2xl bg-[var(--card)] p-3">
            <p className="mb-1 text-xs font-semibold text-[var(--text-2)]">{t.pickup_persons}</p>
            <ul className="text-sm text-[var(--text)]">
              {child.pickup.map((p) => <li key={p}>{personName(p)} · <span className="text-[var(--text-2)]">{uz.ss.relation[PICKUP_PERSONS.find((x) => x.id === p)!.relation]}</span></li>)}
            </ul>
          </section>
          <section className="rounded-2xl bg-[var(--card)] p-3">
            <p className="mb-1 text-xs font-semibold text-[var(--text-2)]">{t.history}</p>
            <p className="text-sm text-[var(--text)]">{t.today}: {st.arrivedAt ? `${fmtTime(st.arrivedAt)}${st.departedAt ? ` – ${fmtTime(st.departedAt)}` : ""}` : "—"}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
