"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadFile } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { formatUzDate, localIsoDate, monthNames } from "@/lib/dates";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EXCUSE_REASON_LABELS } from "@/components/attendance/AttendanceSheet";
import type { AttendanceState, MonthlyAttendance as MonthlyData } from "@/types";
import uz from "@/i18n";

export type AttendanceBasePath = "/v1/teacher/attendance" | "/v1/admin/attendance";

interface MonthlyAttendanceProps {
  basePath: AttendanceBasePath;
  /** Bola profili sahifasida — faqat shu bola, bola filtri yashiriladi. */
  childId?: number;
  /** Boshlang'ich guruh (masalan, bola profilida — bolaning guruhi). */
  groupId?: number;
  noGroupsText?: string;
}

const CELL: Record<AttendanceState, { mark: string; cls: string; label: string }> = {
  present: { get mark() { return uz.davomat.belgi_keldi; },   cls: "bg-[var(--success-bg)] text-[var(--success)]", get label() { return uz.davomat.keldi; } },
  absent: { get mark() { return uz.davomat.belgi_kelmadi; }, cls: "bg-[var(--error-bg)] text-[var(--error)]", get label() { return uz.davomat.kelmadi; } },
  excused: { get mark() { return uz.davomat.belgi_sababli; }, cls: "bg-[var(--warning-bg)] text-[var(--warning-text)]", get label() { return uz.davomat.sababli; } },
};

/** Oylik davomat: oy/yil, guruh, bola va sana oralig'i filtrlari, jadval, izohlar va Excel/PDF eksport. Faqat real API. */
export default function MonthlyAttendance({ basePath, childId, groupId: initialGroupId, noGroupsText }: MonthlyAttendanceProps) {
  const today = localIsoDate();
  const [month,    setMonth]    = useState(today.slice(0, 7));
  const [groupId,  setGroupId]  = useState(initialGroupId ? String(initialGroupId) : "");
  const [child,    setChild]    = useState(childId ? String(childId) : "");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [data,     setData]     = useState<MonthlyData | null>(null);
  // Bola filtri uchun to'liq ro'yxat (filtr qo'llanganda javobda faqat bitta bola qoladi)
  const [roster,   setRoster]   = useState<MonthlyData["children"]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState<string>("");
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const exportRef = useRef(false);

  const params = new URLSearchParams({ month });
  if (groupId) params.set("group_id", groupId);
  if (child)   params.set("child_id", child);
  if (from)    params.set("from", from);
  if (to)      params.set("to", to);
  const qs = params.toString();

  const load = useCallback(async (query: string, filtered: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<MonthlyData>(`${basePath}/monthly?${query}`);
      setData(res);
      if (!filtered) setRoster(res.children);
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string } };
      setError(e?.status === 403 && e.data?.message ? e.data.message : errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { load(qs, !!child); }, [load, qs, child]);

  function changeMonth(next: string) {
    setMonth(next);
    setFrom("");
    setTo("");
  }

  async function exportAs(format: "xlsx" | "pdf") {
    if (exportRef.current) return;
    exportRef.current = true;
    setExporting(format);
    setExportMsg(null);
    try {
      await downloadFile(`${basePath}/export?format=${format}&${qs}`, `davomat-${month}.${format}`);
      setExportMsg({ ok: true, text: uz.davomat.yuklab_olindi });
    } catch (err: unknown) {
      setExportMsg({ ok: false, text: errorMessage(err) });
    } finally {
      exportRef.current = false;
      setExporting("");
    }
  }

  const [year, mon] = month.split("-").map(Number);
  const currentYear = Number(today.slice(0, 4)), currentMonth = Number(today.slice(5, 7));
  const monthStart  = `${month}-01`;
  const monthEnd    = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;
  const [selChild, selDate] = selected.split("|");
  const selectedRow  = data?.children.find((c) => String(c.id) === selChild);
  const selectedCell = selectedRow?.days[selDate];

  return (
    <div className="space-y-4">
      {/* Filtrlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Select id="monthly-month" label={uz.davomat.oy} value={String(mon)}
          onChange={(e) => changeMonth(`${year}-${e.target.value.padStart(2, "0")}`)}>
          {monthNames().map((name, i) => (
            <option key={name} value={i + 1} disabled={year === currentYear && i + 1 > currentMonth}>{name}</option>
          ))}
        </Select>
        <Select id="monthly-year" label={uz.davomat.yil} value={String(year)}
          onChange={(e) => {
            const y = Number(e.target.value);
            changeMonth(`${y}-${String(y === currentYear ? Math.min(mon, currentMonth) : mon).padStart(2, "0")}`);
          }}>
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        {data && data.groups.length > 1 && (
          <Select id="monthly-group" label={uz.davomat.guruh} value={groupId || String(data.group.id)}
            onChange={(e) => { setGroupId(e.target.value); setChild(""); }}>
            {data.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        )}
        {!childId && (
          <Select id="monthly-child" label={uz.davomat.bola_filtri} value={child} onChange={(e) => setChild(e.target.value)}>
            <option value="">{uz.davomat.barcha_bolalar}</option>
            {roster.map((c) => <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>)}
          </Select>
        )}
        <Input id="monthly-from" label={uz.davomat.dan} type="date" value={from || monthStart}
          min={monthStart} max={to || monthEnd} onChange={(e) => setFrom(e.target.value)} />
        <Input id="monthly-to" label={uz.davomat.gacha} type="date" value={to || monthEnd}
          min={from || monthStart} max={monthEnd} onChange={(e) => setTo(e.target.value)} />
      </div>

      {/* Eksport */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--text-2)]">{uz.davomat.yuklab_olish}:</span>
        <Button size="sm" variant="secondary" loading={exporting === "xlsx"} disabled={!!exporting || !data} onClick={() => exportAs("xlsx")}>
          {uz.davomat.excel}
        </Button>
        <Button size="sm" variant="secondary" loading={exporting === "pdf"} disabled={!!exporting || !data} onClick={() => exportAs("pdf")}>
          {uz.davomat.pdf}
        </Button>
        {exportMsg && (
          <span role={exportMsg.ok ? "status" : "alert"} className={`text-sm ${exportMsg.ok ? "text-[var(--success)]" : "text-[var(--error-text)]"}`}>
            {exportMsg.text}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-8 text-center">
          <p role="alert" className="text-sm text-[var(--text-2)] mb-3">
            {error === uz.common.topilmadi && noGroupsText ? noGroupsText : error}
          </p>
          <Button size="sm" variant="secondary" onClick={() => load(qs, !!child)}>{uz.common.qayta_urinish}</Button>
        </div>
      ) : data ? (
        <div className={`space-y-4 ${loading ? "opacity-60 pointer-events-none" : ""}`} aria-busy={loading}>
          {/* Jami */}
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { k: uz.davomat.ish_kunlari,   v: data.totals.working_days },
              { k: uz.davomat.keldi,         v: data.totals.present },
              { k: uz.davomat.kelmadi,       v: data.totals.absent },
              { k: uz.davomat.sababli,       v: data.totals.excused },
              { k: uz.davomat.belgilanmagan, v: data.totals.unmarked },
            ].map((s) => (
              <div key={s.k} className="bg-white rounded-xl border border-[var(--border)] px-4 py-3">
                <dt className="text-xs text-[var(--text-2)]">{s.k}</dt>
                <dd className="text-xl font-semibold text-[var(--text)] mt-0.5">{s.v}</dd>
              </div>
            ))}
          </dl>

          {/* Belgilar */}
          <p className="text-xs text-[var(--text-2)] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{uz.davomat.belgilar}:</span>
            {(Object.keys(CELL) as AttendanceState[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${CELL[s].cls}`}>{CELL[s].mark}</span>
                {CELL[s].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="inline-block h-5 w-5 rounded bg-[var(--border-2)]" />{uz.davomat.dam_olish}</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-5 w-5 rounded border border-[var(--border)]" />{uz.davomat.belgilanmagan}</span>
          </p>

          {data.children.length === 0 ? (
            <p className="bg-white rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-2)]">{uz.davomat.oylik_bola_yoq}</p>
          ) : (
            <>
              <p className="text-xs text-[var(--text-3)] sm:hidden">{uz.davomat.jadval_izoh}</p>
              <div className="relative bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
                <table className="text-xs border-separate border-spacing-0" data-testid="monthly-table">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[var(--surface-2)] text-left px-3 py-2 font-semibold text-[var(--text-2)] border-b border-r border-[var(--border)] min-w-[150px]">
                        {uz.kundalik.bola}
                      </th>
                      {data.days.map((d) => (
                        <th key={d.date} className={`px-0 py-2 w-7 min-w-[28px] text-center font-medium border-b border-[var(--border)] ${d.weekend ? "bg-[var(--border-2)] text-[var(--text-3)]" : "bg-[var(--surface-2)] text-[var(--text-2)]"}`}>
                          {d.day}
                        </th>
                      ))}
                      {[uz.davomat.belgi_keldi, uz.davomat.belgi_kelmadi, uz.davomat.belgi_sababli, "?"].map((h, i) => (
                        <th key={i} className="px-2 py-2 text-center font-semibold text-[var(--text-2)] bg-[var(--surface-2)] border-b border-l border-[var(--border)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.children.map((c) => (
                      <tr key={c.id}>
                        <th scope="row" className="sticky left-0 z-10 bg-white text-left px-3 py-1.5 font-medium text-[var(--text)] border-b border-r border-[var(--border-2)] whitespace-nowrap">
                          {c.last_name} {c.first_name}
                        </th>
                        {data.days.map((d) => {
                          const cell = c.days[d.date];
                          const key  = `${c.id}|${d.date}`;
                          return (
                            <td key={d.date} className={`p-0.5 text-center border-b border-[var(--border-2)] ${d.weekend ? "bg-[var(--surface-2)]" : ""}`}>
                              {cell ? (
                                <button
                                  type="button"
                                  data-testid={`cell-${c.id}-${d.date}`}
                                  aria-label={`${c.last_name} ${c.first_name}, ${formatUzDate(d.date)}: ${CELL[cell.status].label}`}
                                  onClick={() => setSelected(selected === key ? "" : key)}
                                  className={`h-6 w-6 rounded text-[11px] font-bold ${CELL[cell.status].cls} ${selected === key ? "ring-2 ring-[var(--primary)]" : ""} ${cell.note ? "underline decoration-dotted" : ""}`}
                                >
                                  {CELL[cell.status].mark}
                                </button>
                              ) : (
                                <span className={`inline-block h-6 w-6 rounded ${d.weekend || d.future ? "" : "border border-[var(--border)]"}`} />
                              )}
                            </td>
                          );
                        })}
                        {[c.totals.present, c.totals.absent, c.totals.excused, c.totals.unmarked].map((v, i) => (
                          <td key={i} className="px-2 py-1.5 text-center font-semibold text-[var(--text)] border-b border-l border-[var(--border-2)]">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedRow && selectedCell && (
                <p role="status" data-testid="cell-detail" className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--label)]">
                  <span className="font-medium">{selectedRow.last_name} {selectedRow.first_name}</span>
                  {" · "}{formatUzDate(selDate)}{" · "}{CELL[selectedCell.status].label}
                  {selectedCell.excuse_reason ? ` (${EXCUSE_REASON_LABELS[selectedCell.excuse_reason]})` : ""}
                  {selectedCell.note ? ` — ${selectedCell.note}` : ""}
                </p>
              )}
            </>
          )}

          {/* Sababli izohlar */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)] mb-2">{uz.davomat.izohlar_sarlavha}</p>
            {data.excused_notes.length === 0 ? (
              <p className="text-sm text-[var(--text-2)]">{uz.davomat.izoh_yoq}</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-[var(--label)]">
                {data.excused_notes.map((n) => (
                  <li key={`${n.child_id}-${n.date}`}>
                    <span className="text-[var(--text-2)]">{formatUzDate(n.date)}</span> · <span className="font-medium">{n.child_name}</span>
                    {n.reason ? ` · ${EXCUSE_REASON_LABELS[n.reason]}` : ""}{n.note ? ` — ${n.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
