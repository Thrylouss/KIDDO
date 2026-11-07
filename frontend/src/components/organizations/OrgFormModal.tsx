"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/apiErrors";
import { IS_DEMO } from "@/lib/demo-data";
import { REGIONS, copyText, normalizeUzPhone } from "@/lib/organizations";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationSummary, OrgFilterOptions, OrgType } from "@/types";

const t = uz.bogchalar;

interface FormState {
  name: string; type: "" | OrgType; official_code: string; number: string; phone: string; email: string; website: string;
  region: string; district: string; mfy: string; street: string; address: string;
  director_name: string; director_phone: string; director_email: string;
  capacity: string; notes: string;
  create_admin: boolean; admin_username: string;
}

const EMPTY: FormState = {
  name: "", type: "", official_code: "", number: "", phone: "", email: "", website: "",
  region: "", district: "", mfy: "", street: "", address: "",
  director_name: "", director_phone: "", director_email: "",
  capacity: "", notes: "", create_admin: false, admin_username: "",
};

type Field = keyof FormState;

/** Har bir qadam qaysi maydonlarni o'z ichiga oladi (server xatosini tegishli qadamga yo'naltirish uchun). */
const STEP_FIELDS: Field[][] = [
  ["name", "type", "official_code", "number", "phone", "email", "website"],
  ["region", "district", "mfy", "street", "address"],
  ["director_name", "director_phone", "director_email"],
  ["capacity", "notes"],
  ["admin_username"],
];

const USERNAME = /^[a-z][a-z0-9._-]{2,31}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fromOrg(o: OrganizationSummary): FormState {
  return {
    ...EMPTY,
    name: o.name ?? "", type: o.type ?? "", official_code: o.official_code ?? "", number: o.number ?? "",
    phone: o.phone ?? "", email: o.email ?? "", website: o.website ?? "",
    region: o.region ?? "", district: o.district ?? "", mfy: o.mfy ?? "", street: o.street ?? "", address: o.address ?? "",
    director_name: o.director_name ?? "", director_phone: o.director_phone ?? "", director_email: o.director_email ?? "",
    capacity: o.capacity != null ? String(o.capacity) : "", notes: o.notes ?? "",
  };
}

interface Created { id: number; admin: { username: string; temporary_password: string; name: string } | null }

interface Props {
  open: boolean;
  /** Berilsa — tahrirlash rejimi */
  org?: OrganizationSummary | null;
  onClose: () => void;
  /** Saqlangandan keyin (ro'yxat/profil yangilanadi) */
  onSaved: (id: number) => void;
  /** Yaratilgandan keyin profilga o'tish */
  onOpenProfile?: (id: number) => void;
}

export default function OrgFormModal({ open, org, onClose, onSaved, onOpenProfile }: Props) {
  const edit = !!org;
  const steps = edit ? [t.qadam_asosiy, t.qadam_manzil, t.qadam_masul, t.qadam_parametr]
                     : [t.qadam_asosiy, t.qadam_manzil, t.qadam_masul, t.qadam_parametr, t.qadam_akkaunt];

  const [f, setF]             = useState<FormState>(EMPTY);
  const [step, setStep]       = useState(0);
  const [visited, setVisited] = useState(0);
  const [errors, setErrors]   = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving]   = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied]   = useState("");
  const [options, setOptions] = useState<OrgFilterOptions>({ districts: [], regions: [], mfys: [] });
  // Tuman/MFY tanlovlari manbasi: rasmiy ma'lumotnoma yoki bazadagi mavjud qiymatlar
  const busy = useRef(false);

  useEffect(() => {
    if (!open) return;
    setF(org ? fromOrg(org) : EMPTY);
    setStep(0); setVisited(edit ? steps.length - 1 : 0);
    setErrors({}); setFormError(""); setCreated(null); setCopied("");
    api.get<{ data: OrgFilterOptions }>("/v1/super-admin/organizations/filter-options")
      .then((r) => { if (Array.isArray(r?.data?.districts)) setOptions(r.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, org?.id]);

  const set = <K extends Field>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  /** Mijoz tomonidagi tekshiruv — server validatsiyasi asosiy (u ham o'zbekcha xato qaytaradi). */
  function validate(idx: number): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {};
    const fields = STEP_FIELDS[idx] ?? [];
    if (fields.includes("name") && f.name.trim().length < 2) e.name = t.f_majburiy;
    if (fields.includes("type") && !f.type) e.type = t.f_majburiy;
    for (const k of ["phone", "director_phone"] as const) {
      if (fields.includes(k) && f[k].trim() && !normalizeUzPhone(f[k])) e[k] = t.f_telefon_xato;
    }
    for (const k of ["email", "director_email"] as const) {
      if (fields.includes(k) && f[k].trim() && !EMAIL.test(f[k].trim())) e[k] = t.f_email_xato;
    }
    if (fields.includes("capacity") && f.capacity && !/^[1-9]\d{0,4}$/.test(f.capacity)) e.capacity = t.f_son_xato;
    if (fields.includes("admin_username") && f.create_admin && !USERNAME.test(f.admin_username.trim().toLowerCase())) {
      e.admin_username = t.f_login_xato;
    }
    return e;
  }

  function goTo(idx: number) {
    if (idx > step) {
      const e = validate(step);
      if (Object.keys(e).length) { setErrors((p) => ({ ...p, ...e })); setFormError(t.f_tekshiring); return; }
    }
    setFormError("");
    setStep(idx);
    setVisited((v) => Math.max(v, idx));
  }

  function payload() {
    const val = (v: string) => v.trim() || null;
    return {
      name: f.name.trim(), type: f.type || null, official_code: val(f.official_code), number: val(f.number),
      phone: f.phone.trim() ? normalizeUzPhone(f.phone) ?? f.phone.trim() : null,
      email: val(f.email), website: val(f.website), region: val(f.region), district: val(f.district), mfy: val(f.mfy),
      street: val(f.street),
      address: val(f.address) ?? ([f.region, f.district, f.mfy, f.street].map((x) => x.trim()).filter(Boolean).join(", ") || null),
      director_name: val(f.director_name),
      director_phone: f.director_phone.trim() ? normalizeUzPhone(f.director_phone) ?? f.director_phone.trim() : null,
      director_email: val(f.director_email), capacity: f.capacity ? Number(f.capacity) : null, notes: val(f.notes),
      ...(!edit && f.create_admin ? { admin_username: f.admin_username.trim().toLowerCase() } : {}),
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < steps.length - 1) { goTo(step + 1); return; }
    if (busy.current) return;

    // Barcha qadamlarni tekshirish; xato bo'lgan birinchi qadamga qaytish
    for (let i = 0; i < steps.length; i++) {
      const err = validate(i);
      if (Object.keys(err).length) { setErrors(err); setStep(i); setFormError(t.f_tekshiring); return; }
    }

    busy.current = true;
    setSaving(true);
    setFormError("");
    try {
      if (edit && org) {
        await api.put(`/v1/super-admin/organizations/${org.id}`, payload());
        onSaved(org.id);
        onClose();
      } else {
        const res = await api.post<{ data?: Created }>("/v1/super-admin/organizations", payload());
        const data = res?.data;
        if (data?.id) onSaved(data.id);
        if (data?.admin) setCreated(data);
        else { onClose(); if (data?.id) onOpenProfile?.(data.id); }
      }
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) {
        const mapped = Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])) as Partial<Record<Field, string>>;
        setErrors(mapped);
        const first = STEP_FIELDS.findIndex((fields) => fields.some((k) => mapped[k]));
        if (first >= 0 && first < steps.length) setStep(first);
        setFormError(t.f_tekshiring);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function copy(label: string, text: string) {
    if (await copyText(text)) setCopied(label);
  }

  const title = created ? t.yaratildi_sarlavha : edit ? t.tahrir_sarlavha : t.yangi_sarlavha;
  const last = step === steps.length - 1;

  const footer = created ? (
    <>
      <Button variant="secondary" onClick={onClose}>{t.yopish}</Button>
      <Button onClick={() => { onClose(); onOpenProfile?.(created.id); }}>{t.profilga_otish}</Button>
    </>
  ) : (
    <>
      {step > 0
        ? <Button variant="secondary" type="button" onClick={() => goTo(step - 1)}>{t.oldingi}</Button>
        : <Button variant="secondary" type="button" onClick={onClose}>{uz.common.bekor_qilish}</Button>}
      <Button form="org-form" type="submit" loading={saving}>
        {last ? (edit ? t.saqlash : t.yaratish) : t.keyingi}
      </Button>
    </>
  );

  const optional = <span className="ml-1 text-xs font-normal text-[var(--text-3)]">({t.f_ixtiyoriy})</span>;
  const districts = useMemo(() => options.districts, [options.districts]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg" footer={footer}>
      {created ? (
        <div data-testid="org-created" className="space-y-4">
          <p className="text-sm text-[var(--text-2)]">{t.parol_bir_marta}</p>
          {[{ label: t.login, value: created.admin!.username }, { label: t.vaqtinchalik_parol, value: created.admin!.temporary_password }].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[#FAF5F8] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-3)]">{row.label}</p>
                <p className="font-mono text-base font-semibold text-[var(--text)] break-all">{row.value}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => copy(row.label, row.value)}>
                {copied === row.label ? t.nusxalandi : t.nusxalash}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <form id="org-form" onSubmit={submit} noValidate className="space-y-5">
          {IS_DEMO && (
            <div className="bg-[#FFF9F5] border border-[#EDE3E8] text-[#766B73] text-sm px-4 py-3 rounded-xl">
              {uz.super_admin.demo_modal_xabar}
            </div>
          )}

          {/* Qadamlar */}
          <ol className="flex flex-wrap gap-1.5" aria-label={t.qadam}>
            {steps.map((label, i) => (
              <li key={label}>
                <button type="button" disabled={i > visited} onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                    ${i === step ? "bg-[#8E315D] text-white" : i <= visited ? "bg-[#FDF2F6] text-[#8E315D] hover:bg-[#F9E3EC]" : "bg-[#F2ECF0] text-[#B8AAB2]"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i === step ? "bg-white/25" : "bg-white"}`}>{i + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          {formError && (
            <div role="alert" className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm px-4 py-3 rounded-xl">{formError}</div>
          )}

          {step === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input id="org-name" label={`${t.f_nomi} *`} value={f.name} maxLength={255} placeholder={t.f_nomi_ph}
                  onChange={(e) => set("name", e.target.value)} error={errors.name} />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium text-[var(--text)] mb-1.5">{t.f_turi} <span className="text-[#EF4444]">*</span></legend>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#FAF5F8] p-1" role="radiogroup">
                  {(["davlat", "xususiy"] as const).map((v) => (
                    <label key={v} className={`cursor-pointer rounded-lg py-2 text-center text-sm font-semibold transition
                      ${f.type === v ? "bg-white text-[#8E315D] shadow-sm" : "text-[#766B73] hover:text-[#29232A]"}`}>
                      <input type="radio" name="org-type" value={v} checked={f.type === v} onChange={() => set("type", v)} className="sr-only" />
                      {v === "davlat" ? t.turi_davlat : t.turi_xususiy}
                    </label>
                  ))}
                </div>
                {errors.type && <p role="alert" className="mt-1.5 text-xs text-[#EF4444]">{errors.type}</p>}
              </fieldset>
              <Input id="org-code" label={t.f_kod} hint={t.f_kod_izoh} value={f.official_code} maxLength={50}
                onChange={(e) => set("official_code", e.target.value)} error={errors.official_code} />
              <Input id="org-number" label={t.f_raqami} value={f.number} maxLength={20}
                onChange={(e) => set("number", e.target.value)} error={errors.number} />
              <Input id="org-phone" label={t.f_telefon} type="tel" inputMode="tel" placeholder="+998 71 123 45 67" value={f.phone}
                onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
              <Input id="org-email" label={t.f_email} type="email" value={f.email}
                onChange={(e) => set("email", e.target.value)} error={errors.email} />
              <div className="sm:col-span-2">
                <Input id="org-website" label={t.f_sayt} placeholder="kiddo.uz" value={f.website}
                  onChange={(e) => set("website", e.target.value)} error={errors.website} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select id="org-region" label={t.f_viloyat} value={f.region} onChange={(e) => set("region", e.target.value)} error={errors.region}>
                <option value="">{t.f_viloyat_ph}</option>
                {[...new Set([...REGIONS, ...options.regions, ...(f.region ? [f.region] : [])])].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <div>
                <Input id="org-district" label={t.f_tuman} hint={options.source === "directory" ? t.f_tuman_izoh_rasmiy : t.f_tuman_izoh} list="org-district-list" value={f.district} maxLength={100}
                  onChange={(e) => set("district", e.target.value)} error={errors.district} />
                <datalist id="org-district-list">{districts.map((d) => <option key={d} value={d} />)}</datalist>
              </div>
              <div>
                <Input id="org-mfy" label={t.f_mfy} list="org-mfy-list" value={f.mfy} maxLength={150}
                  onChange={(e) => set("mfy", e.target.value)} error={errors.mfy} />
                <datalist id="org-mfy-list">{options.mfys.map((d) => <option key={d} value={d} />)}</datalist>
              </div>
              <Input id="org-street" label={t.f_kocha} value={f.street} maxLength={255}
                onChange={(e) => set("street", e.target.value)} error={errors.street} />
              <div className="sm:col-span-2">
                <Input id="org-address" label={t.f_manzil} hint={t.f_manzil_izoh} value={f.address} maxLength={500}
                  onChange={(e) => set("address", e.target.value)} error={errors.address} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input id="org-director" label={t.f_rahbar} value={f.director_name} maxLength={255}
                  onChange={(e) => set("director_name", e.target.value)} error={errors.director_name} />
              </div>
              <Input id="org-director-phone" label={t.f_rahbar_tel} type="tel" inputMode="tel" placeholder="+998 90 123 45 67"
                value={f.director_phone} onChange={(e) => set("director_phone", e.target.value)} error={errors.director_phone} />
              <Input id="org-director-email" label={t.f_rahbar_email} type="email" value={f.director_email}
                onChange={(e) => set("director_email", e.target.value)} error={errors.director_email} />
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-4">
              <Input id="org-capacity" label={t.f_quvvat} type="number" inputMode="numeric" min={1} max={10000} value={f.capacity}
                onChange={(e) => set("capacity", e.target.value)} error={errors.capacity} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="org-notes" className="text-sm font-medium text-[var(--text)]">{t.f_izoh}{optional}</label>
                <textarea id="org-notes" rows={3} maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[#8E315D]/15 resize-y" />
                {errors.notes && <p className="text-xs text-[#EF4444]">{errors.notes}</p>}
              </div>
              <p className="rounded-xl bg-[#FAF5F8] px-4 py-3 text-xs text-[var(--text-2)]">{t.f_hisoblanadi}</p>
            </div>
          )}

          {step === 4 && !edit && (
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={f.create_admin} onChange={(e) => set("create_admin", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#8E315D]" />
                <span>
                  <span className="text-sm font-medium text-[var(--text)]">{t.f_akkaunt_yaratish}</span>
                  <span className="block text-xs text-[var(--text-2)] mt-0.5">{t.f_akkaunt_izoh}</span>
                </span>
              </label>
              {f.create_admin ? (
                <Input id="org-admin-username" label={`${t.f_login} *`} hint={t.f_login_izoh} autoComplete="off" value={f.admin_username}
                  onChange={(e) => set("admin_username", e.target.value.toLowerCase())} error={errors.admin_username} />
              ) : (
                <p className="text-xs text-[var(--text-3)]">{t.f_akkaunt_keyin}</p>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
