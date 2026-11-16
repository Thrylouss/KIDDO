"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadFile, uploadFile } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { REGIONS } from "@/lib/organizations";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import uz from "@/i18n";
import uzDict from "@/i18n/uz";
import type { OrganizationImportPreview, OrganizationImportRow } from "@/types";
import { useLocale } from "@/contexts/PreferencesContext";

const t = uz.bogcha_import;

type Field = "name" | "number" | "address" | "mfy" | "capacity" | "director_name" | "director_phone";

const FIELD_LABELS: Record<Field, string> = {
  get name() { return t.nomi; }, get number() { return t.raqami; }, get address() { return t.manzili; }, get mfy() { return t.mfy; },
  get capacity() { return t.quvvati; }, get director_name() { return t.rahbar; }, get director_phone() { return t.rahbar_tel; },
};

const DERIVED_LABELS: Record<string, string> = { get name() { return t.nomdan; }, get address() { return t.manzildan; } };

/** Yetishmayotgan qiymat — to'ldirilmaydi, faqat belgilanadi. */
const Missing = () => <span className="text-[var(--warning-text)]">{t.yoq}</span>;

const STATUS: Record<OrganizationImportRow["status"], { label: string; variant: "success" | "warning" | "error" }> = {
  ok: { get label() { return t.tayyor; },        variant: "success" },
  warning: { get label() { return t.ogohlantirish; }, variant: "warning" },
  error: { get label() { return t.xato; },          variant: "error"   },
};

export default function BogchaImportPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  const router = useRouter();
  const [district, setDistrict] = useState<string>(uzDict.bogcha_import.tuman_standart) /* backend ma'lumoti — doim O'zbekcha */;
  // Barcha qatorlarga qo'llanadi: reyestr DMTT lari — davlat (standart)
  const [orgType,  setOrgType]  = useState<"davlat" | "xususiy">("davlat");
  const [region,   setRegion]   = useState<string>("");
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<OrganizationImportPreview | null>(null);
  // Tanlangan qatorlar: «ok» — standart tanlangan; «warning» — faqat qo'lda tasdiqlansa
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const [error,    setError]    = useState("");
  const [created,  setCreated]  = useState<number | null>(null);
  const [skipped,  setSkipped]  = useState(0);
  const [totalRows, setTotalRows] = useState<number | null>(null);

  async function runPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError(t.fayl_tanlang); return; }
    setLoading(true);
    setError("");
    setCreated(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("district", district.trim());
      form.append("type", orgType);
      if (region) form.append("region", region);
      const res = await uploadFile<{ data: OrganizationImportPreview }>("/v1/super-admin/organizations/import/preview", form);
      setPreview(res.data);
      setSelected(new Set(res.data.rows.filter((r) => r.status === "ok").map((r) => r.row)));
    } catch (err) {
      setPreview(null);
      setError(errorMessage(err) || t.xato_umumiy);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(row)) next.delete(row); else next.add(row);
      return next;
    });
  }

  async function runImport() {
    if (!preview || !file || blocked) return;
    const rows = preview.rows.filter((r) => r.status !== "error" && selected.has(r.row));
    setSaving(true);
    setError("");
    try {
      // Fayl qayta yuboriladi — server asl qiymatlarni fayldan qayta o'qiydi va qayta tekshiradi
      const form = new FormData();
      form.append("file", file);
      form.append("district", district.trim());
      form.append("type", orgType);
      if (region) form.append("region", region);
      rows.forEach((r) => form.append("rows[]", String(r.row)));
      rows.filter((r) => r.status === "warning").forEach((r) => form.append("confirmed_rows[]", String(r.row)));
      const res = await uploadFile<{ data: { created: { id: number }[]; summary?: { total: number; skipped: number } } }>("/v1/super-admin/organizations/import", form);
      setCreated(res.data.created.length);
      setSkipped(res.data.summary?.skipped ?? 0);
      setTotalRows(res.data.summary?.total ?? null);
      setPreview(null);
      setFile(null);
    } catch (err) {
      // Server rad etgan qatorlar (masalan, oraliqda bazaga qo'shilgan takror) jadvalda yangilanadi
      const rejected = (err as { data?: { data?: { rejected?: OrganizationImportRow[] } } }).data?.data?.rejected;
      if (rejected?.length) {
        const byRow = new Map(rejected.map((r) => [r.row, r]));
        setPreview((p) => p && { ...p, rows: p.rows.map((r) => byRow.get(r.row) ?? r) });
      }
      setError(errorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  }

  function reset() {
    setPreview(null);
    setFile(null);
    setCreated(null);
    setError("");
  }

  const importable = preview?.rows.filter((r) => r.status !== "error" && selected.has(r.row)).length ?? 0;
  // Bitta xatoli qator bo'lsa ham import bloklanadi (backend ham rad etadi)
  const blocked = !!preview && (preview.can_import === false || preview.summary.error > 0);
  const errorIssues = (preview?.rows ?? []).flatMap((r) =>
    (r.issues ?? r.errors.map((m) => ({ level: "error" as const, field: "", column: "", message: m })))
      .filter((i) => i.level === "error").map((i) => ({ ...i, row: r.row })));

  return (
    <div className="space-y-6">
      <Link href="/admin/bogchalar" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--primary)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t.ortga}
      </Link>

      <PageHeader
        title={t.sarlavha}
        description={t.tavsif}
        action={
          <Button variant="secondary" disabled={IS_DEMO}
            onClick={() => downloadFile("/v1/super-admin/organizations/import/template", "bogchalar-import-namuna.xlsx").catch((err) => setError(errorMessage(err)))}>
            {t.namuna}
          </Button>
        }
      />

      {IS_DEMO && (
        <p role="note" className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning-text)]">{t.demo}</p>
      )}

      {created !== null && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--success)]">
            <span data-testid="import-result">
              {totalRows !== null && <span className="font-normal text-[var(--text-2)]">{t.natija_jami}: {totalRows} · </span>}
              {created} {t.yaratildi}{skipped > 0 && <span className="font-normal text-[var(--text-2)]"> · {skipped} {t.otkazildi}</span>}
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={reset}>{t.yana}</Button>
            <Button size="sm" onClick={() => router.push("/admin/bogchalar")}>{uz.super_admin.bogchalar}</Button>
          </div>
        </div>
      )}

      {!preview && (
        <form onSubmit={runPreview} className="bg-white rounded-xl border border-[var(--border)] p-6 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select id="import-type" label={t.turi} value={orgType} onChange={(e) => setOrgType(e.target.value as "davlat" | "xususiy")}>
              <option value="davlat">{uz.bogchalar.turi_davlat}</option>
              <option value="xususiy">{uz.bogchalar.turi_xususiy}</option>
            </Select>
            <Select id="import-region" label={t.viloyat} value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{uz.bogchalar.f_viloyat_ph}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Input id="import-district" label={t.tuman} value={district} maxLength={100} required
              onChange={(e) => setDistrict(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="import-file" className="text-sm font-medium text-[var(--text)]">
                {t.fayl} <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }}
                className="block w-full text-sm text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-lt)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--primary)] hover:file:bg-[var(--primary-lt)]"
              />
            </div>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-2)]">
            <li>{t.ustunlar}</li>
            <li>{t.login_yoq}</li>
            <li>{t.telefon_izoh}</li>
          </ul>
          <div className="flex justify-end">
            <Button type="submit" loading={loading} disabled={IS_DEMO || !district.trim()}>{t.korib_chiqish}</Button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error-text)]">{error}</p>}

      {preview && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)]">
            {[
              { id: "total",   label: t.jami,          value: preview.summary.total },
              { id: "ok",      label: t.tayyor,        value: preview.summary.ok },
              { id: "warning", label: t.ogohlantirish, value: preview.summary.warning },
              { id: "error",   label: t.xato,          value: preview.summary.error },
            ].map((s) => (
              <div key={s.id} className="bg-white px-4 py-3">
                <p className="text-[11px] text-[var(--text-3)] font-medium uppercase tracking-wide">{s.label}</p>
                <p data-testid={`import-${s.id}`} className="text-2xl font-bold text-[var(--text)] leading-tight">{s.value}</p>
              </div>
            ))}
          </div>

          {preview.columns && (
            <section aria-labelledby="import-columns" className="bg-white rounded-xl border border-[var(--border)] p-4">
              <h2 id="import-columns" className="text-sm font-semibold text-[var(--text)] mb-2">{t.ustunlar_sarlavha}</h2>
              <ul className="flex flex-wrap gap-2" data-testid="import-columns">
                {preview.columns.map((c) => (
                  <li key={c.field} data-testid={`col-${c.field}`}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs ${c.header ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--label)]" : "border-dashed border-[var(--border)] text-[var(--text-3)]"}`}>
                    <span className="font-medium">{c.label}</span>
                    <span className={`ml-1.5 rounded px-1 py-px text-[10px] font-semibold uppercase ${c.required ? "bg-[var(--primary)] text-white" : "bg-[var(--border-2)] text-[var(--text-2)]"}`}>
                      {c.required ? t.majburiy : t.ixtiyoriy}
                    </span>
                    <span className="ml-1.5">{c.header ? `${t.faylda_topildi}: «${c.header}»` : t.faylda_topilmadi}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {blocked && (
            <section role="alert" data-testid="import-blocked" className="rounded-xl border border-[var(--error-border)] bg-[var(--error-soft)] p-4">
              <p className="text-sm font-medium text-[var(--error-text)]">{t.bloklangan}</p>
              {errorIssues.length > 0 && (
                <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm text-[var(--error)]" aria-label={t.xatolar_sarlavha}>
                  {errorIssues.map((i, idx) => (
                    <li key={`${i.row}-${idx}`} data-testid={`issue-${i.row}-${i.field}`}>
                      <span className="font-semibold">{i.row}-{t.xato_qator}</span>
                      {i.column && <> · «{i.column}»</>} — {i.message}
                    </li>
                  ))}
                </ul>
              )}
              <Button size="sm" variant="secondary" className="mt-3" onClick={reset}>{t.qayta_yuklash}</Button>
            </section>
          )}

          <p role="note" className="text-xs text-[var(--text-2)]">{t.preview_izoh} {district} · {t.turi}: {orgType === "davlat" ? uz.bogchalar.turi_davlat : uz.bogchalar.turi_xususiy}{region ? ` · ${region}` : ""}</p>

          <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{t.tanlash}</th>
                  <th className="px-3 py-2.5 font-medium">{t.qator}</th>
                  <th className="px-3 py-2.5 font-medium">{t.holat}</th>
                  <th className="px-3 py-2.5 font-medium">{t.nomi}</th>
                  <th className="px-3 py-2.5 font-medium">{t.turi_qisqa}</th>
                  <th className="px-3 py-2.5 font-medium">{t.raqami}</th>
                  <th className="px-3 py-2.5 font-medium">{t.manzili}</th>
                  <th className="px-3 py-2.5 font-medium">{t.mfy}</th>
                  <th className="px-3 py-2.5 font-medium">{t.quvvati}</th>
                  <th className="px-3 py-2.5 font-medium">{t.rahbar}</th>
                  <th className="px-3 py-2.5 font-medium">{t.rahbar_tel}</th>
                  <th className="px-3 py-2.5 font-medium">{t.izoh}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-2)]">
                {preview.rows.map((r) => (
                  <tr key={r.row} data-testid={`import-row-${r.row}`} className={r.status === "error" ? "bg-[var(--error-soft)]/60" : r.status === "warning" ? "bg-[var(--warning-soft)]/60" : ""}>
                    <td className="px-3 py-2.5 align-top">
                      <input
                        type="checkbox"
                        data-testid={`select-${r.row}`}
                        aria-label={r.status === "warning" ? `${t.qator} ${r.row}: ${t.baribir}` : `${t.qator} ${r.row}`}
                        checked={r.status !== "error" && selected.has(r.row)}
                        disabled={r.status === "error"}
                        onChange={() => toggle(r.row)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top text-[var(--text-2)]">{r.row}</td>
                    <td className="px-3 py-2.5 align-top"><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></td>
                    <td className="px-3 py-2.5 align-top font-medium text-[var(--text)]">
                      {r.name ?? <Missing />}
                      {Object.keys(r.source).length > 0 && (
                        <details className="mt-1 text-xs font-normal text-[var(--text-2)]">
                          <summary className="cursor-pointer text-[var(--primary)]">{t.asl_qiymatlar}</summary>
                          <dl data-testid={`source-${r.row}`} className="mt-1 space-y-0.5">
                            {Object.entries(r.source).map(([h, v]) => (
                              <div key={h} className="flex gap-1">
                                <dt className="text-[var(--text-3)]">{h}:</dt>
                                <dd className="whitespace-pre-wrap">«{v}»</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap" data-testid={`type-${r.row}`}>
                      {r.type ? (r.type === "davlat" ? uz.bogchalar.turi_davlat : uz.bogchalar.turi_xususiy)
                        : <span className="text-[var(--text-3)]">{orgType === "davlat" ? uz.bogchalar.turi_davlat : uz.bogchalar.turi_xususiy} ({t.standart})</span>}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {r.number ?? <Missing />}
                      {r.derived.number && <p className="text-[11px] text-[var(--text-3)]">{DERIVED_LABELS[r.derived.number]}</p>}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[var(--text-2)]">{r.address ?? <Missing />}</td>
                    <td className="px-3 py-2.5 align-top text-[var(--text-2)]">
                      {r.mfy ?? <Missing />}
                      {r.derived.mfy && <p className="text-[11px] text-[var(--text-3)]">{DERIVED_LABELS[r.derived.mfy]}</p>}
                    </td>
                    <td className="px-3 py-2.5 align-top">{r.capacity ?? <Missing />}</td>
                    <td className="px-3 py-2.5 align-top">{r.director_name ?? <Missing />}</td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">{r.director_phone ?? <Missing />}</td>
                    <td className="px-3 py-2.5 align-top text-xs">
                      {r.missing.length > 0 && (
                        <p data-testid={`missing-${r.row}`} className="text-[var(--warning-text)]">
                          {t.faylda_yoq}: {r.missing.map((f) => FIELD_LABELS[f as Field] ?? f).join(", ")}
                        </p>
                      )}
                      {r.issues
                        ? r.issues.map((i, idx) => (
                            <p key={idx} className={i.level === "error" ? "text-[var(--error-text)]" : "text-[var(--warning-text)]"}>
                              <span className="font-medium">«{i.column}»:</span> {i.message}
                            </p>
                          ))
                        : <>
                            {r.errors.map((m) => <p key={m} className="text-[var(--error-text)]">{m}</p>)}
                            {r.warnings.map((m) => <p key={m} className="text-[var(--warning-text)]">{m}</p>)}
                          </>}
                      {r.status === "warning" && <p className="text-[var(--text-2)]">{t.baribir_izoh}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={reset}>{t.yana}</Button>
            <span className="flex-1" />
            <p className="text-xs text-[var(--text-2)]">{t.login_yoq}</p>
            <Button disabled={blocked || importable === 0} onClick={() => setConfirm(true)}>{t.import_qilish} ({importable})</Button>
          </div>
        </>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.tasdiq_sarlavha}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{uz.common.bekor_qilish}</Button>
            <Button loading={saving} onClick={runImport}>{t.import_qilish}</Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text)]">{importable} {t.tasdiq_matn}</p>
        <p className="mt-2 text-xs text-[var(--text-2)]">{t.login_yoq}</p>
      </Modal>
    </div>
  );
}
