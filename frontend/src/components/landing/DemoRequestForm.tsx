"use client";

import { useEffect, useRef, useState } from "react";
import { submitDemoRequest } from "@/lib/api";
import { fieldErrors } from "@/lib/apiErrors";
import { Icon } from "./icons";
import uz from "@/i18n/uz";

const t = uz.landing;

type Fields = {
  kindergarten_name: string;
  kindergarten_type: "davlat" | "xususiy";
  region: string;
  district: string;
  address: string;
  director_name: string;
  phone: string;
  children_count: string;
  groups_count: string;
  comment: string;
  consent: boolean;
  website: string; // honeypot — odam ko'rmaydi va to'ldirmaydi
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = {
  kindergarten_name: "", kindergarten_type: "davlat", region: "", district: "", address: "",
  director_name: "", phone: "", children_count: "", groups_count: "", comment: "", consent: false, website: "",
};

/** «901234567», «+998 (90) 123-45-67» → «+998 90 123 45 67» (yozish davomida ham). */
export function formatUzPhone(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return value.trim().startsWith("+") ? "+998 " : "";
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(" ")}`;
}

export function isValidUzPhone(value: string): boolean {
  return /^\+998\d{9}$/.test(value.replace(/[\s()-]/g, ""));
}

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.kindergarten_name.trim().length < 2) e.kindergarten_name = t.f_majburiy;
  if (!f.region) e.region = t.f_majburiy;
  if (!f.district.trim()) e.district = t.f_majburiy;
  if (f.director_name.trim().length < 3) e.director_name = t.f_majburiy;
  if (!f.phone.trim()) e.phone = t.f_majburiy;
  else if (!isValidUzPhone(f.phone)) e.phone = t.f_telefon_xato;
  for (const k of ["children_count", "groups_count"] as const) {
    if (f[k] && !/^[1-9]\d{0,3}$/.test(f[k].trim())) e[k] = t.f_son_xato;
  }
  if (!f.consent) e.consent = t.f_rozilik_xato;
  return e;
}

const inputCls = (err?: string) =>
  `w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-[#29232A] placeholder:text-[#B8AAB2] outline-none transition
   ${err ? "border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/15" : "border-[#EDE3E8] focus:border-[#D95F87] focus:ring-4 focus:ring-[#D95F87]/15"}`;

function Field({ id, label, required, optional, error, children }: {
  id: string; label: string; required?: boolean; optional?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#3D3240]">
        {label}
        {required && <span className="text-[#D95F87] ml-0.5" aria-hidden="true">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-[#B8AAB2]">({t.f_ixtiyoriy})</span>}
      </label>
      {children}
      {error && <p id={`${id}-xato`} role="alert" className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}

export default function DemoRequestForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const sendingRef = useRef(false); // ikki marta bosishdan himoya (state yangilanguncha)
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Forma qisqaradi — tasdiqlash xabari ko'rinadigan joyga suriladi va ekran o'quvchiga e'lon qilinadi
  useEffect(() => {
    if (!done) return;
    doneRef.current?.focus({ preventScroll: true });
    doneRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [done]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
    if (formError) setFormError("");
  };

  const a11y = (k: keyof Fields) => ({
    id: `demo-${k}`,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `demo-${k}-xato` : undefined,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendingRef.current) return;
    setFormError("");

    const local = validate(f);
    setErrors(local);
    if (Object.keys(local).length) {
      setFormError(t.f_xato_tekshiring);
      const first = Object.keys(local)[0];
      formRef.current?.querySelector<HTMLElement>(`#demo-${first}`)?.focus();
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      const res = await submitDemoRequest({
        ...f,
        phone: f.phone.replace(/\s/g, ""),
        children_count: f.children_count.trim() || null,
        groups_count: f.groups_count.trim() || null,
      });
      setDone(res?.message || t.f_muvaffaqiyat);
      setF(EMPTY);
    } catch (err) {
      const server = fieldErrors(err);
      if (Object.keys(server).length) {
        setErrors(Object.fromEntries(Object.entries(server).map(([k, v]) => [k, v[0]])) as Errors);
        setFormError(t.f_xato_tekshiring);
      } else {
        setFormError((err as { status?: number })?.status === 429 ? t.f_kop_urinish : t.f_xato_umumiy);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (done) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" data-testid="demo-success" className="outline-none flex flex-col items-center text-center rounded-3xl bg-white border border-[#EDE3E8] p-8 sm:p-12 shadow-[0_30px_80px_-40px_rgba(143,49,88,0.5)]">
        <span className="h-16 w-16 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center landing-rise">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <p className="mt-6 text-xl font-semibold text-[#29232A] max-w-md text-balance">{done}</p>
        <button type="button" onClick={() => setDone("")} className="mt-8 text-sm font-semibold text-[#8F3158] hover:underline">
          {t.f_yana}
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate method="post" aria-label={t.demo_form_sarlavha}
      className="relative rounded-3xl bg-white border border-[#EDE3E8] p-5 sm:p-8 shadow-[0_30px_80px_-40px_rgba(143,49,88,0.5)]">
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="demo-kindergarten_name" label={t.f_nomi} required error={errors.kindergarten_name}>
            <input {...a11y("kindergarten_name")} className={inputCls(errors.kindergarten_name)} value={f.kindergarten_name} maxLength={255}
              autoComplete="organization" placeholder={t.f_nomi_ph} onChange={(e) => set("kindergarten_name", e.target.value)} />
          </Field>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-[#3D3240] mb-1.5">{t.f_turi}</legend>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#FAF5F8] p-1">
            {(["davlat", "xususiy"] as const).map((v) => (
              <label key={v} className={`cursor-pointer rounded-xl py-2.5 text-center text-sm font-semibold transition
                ${f.kindergarten_type === v ? "bg-white text-[#8F3158] shadow-sm" : "text-[#746873] hover:text-[#29232A]"}`}>
                <input type="radio" name="demo-turi" value={v} checked={f.kindergarten_type === v} onChange={() => set("kindergarten_type", v)} className="sr-only" />
                {v === "davlat" ? t.f_davlat : t.f_xususiy}
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="demo-region" label={t.f_viloyat} required error={errors.region}>
          <select {...a11y("region")} className={inputCls(errors.region)} value={f.region} onChange={(e) => set("region", e.target.value)}>
            <option value="">{t.f_viloyat_ph}</option>
            {t.viloyatlar.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
        <Field id="demo-district" label={t.f_tuman} required error={errors.district}>
          <input {...a11y("district")} className={inputCls(errors.district)} value={f.district} maxLength={100}
            placeholder={t.f_tuman_ph} onChange={(e) => set("district", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field id="demo-address" label={t.f_manzil} optional error={errors.address}>
            <input {...a11y("address")} className={inputCls(errors.address)} value={f.address} maxLength={500}
              autoComplete="street-address" onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>

        <Field id="demo-director_name" label={t.f_rahbar} required error={errors.director_name}>
          <input {...a11y("director_name")} className={inputCls(errors.director_name)} value={f.director_name} maxLength={255}
            autoComplete="name" placeholder={t.f_rahbar_ph} onChange={(e) => set("director_name", e.target.value)} />
        </Field>
        <Field id="demo-phone" label={t.f_telefon} required error={errors.phone}>
          <input {...a11y("phone")} type="tel" inputMode="tel" autoComplete="tel" className={inputCls(errors.phone)} value={f.phone}
            placeholder={t.f_telefon_ph} onChange={(e) => set("phone", formatUzPhone(e.target.value))} />
        </Field>

        <Field id="demo-children_count" label={t.f_bolalar} optional error={errors.children_count}>
          <input {...a11y("children_count")} type="number" inputMode="numeric" min={1} max={5000} list="demo-bolalar-variant"
            className={inputCls(errors.children_count)} value={f.children_count} onChange={(e) => set("children_count", e.target.value)} />
          <datalist id="demo-bolalar-variant">
            {[30, 50, 100, 150, 200, 300].map((n) => <option key={n} value={n} />)}
          </datalist>
        </Field>
        <Field id="demo-groups_count" label={t.f_guruhlar} optional error={errors.groups_count}>
          <input {...a11y("groups_count")} type="number" inputMode="numeric" min={1} max={300}
            className={inputCls(errors.groups_count)} value={f.groups_count} onChange={(e) => set("groups_count", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <Field id="demo-comment" label={t.f_izoh} optional error={errors.comment}>
            <textarea {...a11y("comment")} rows={3} maxLength={2000} className={`${inputCls(errors.comment)} resize-y`} value={f.comment}
              placeholder={t.f_izoh_ph} onChange={(e) => set("comment", e.target.value)} />
          </Field>
        </div>

        {/* Honeypot: ekran o'quvchilar va foydalanuvchidan yashirin */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="demo-website">Website</label>
          <input id="demo-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="demo-consent" className="flex items-start gap-3 cursor-pointer">
            <input {...a11y("consent")} type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-[#EDE3E8] accent-[#8F3158]" />
            <span className="text-sm text-[#5A4E58] leading-relaxed">{t.f_rozilik}<span className="text-[#D95F87] ml-0.5" aria-hidden="true">*</span></span>
          </label>
          {errors.consent && <p id="demo-consent-xato" role="alert" className="mt-1.5 text-xs text-[#DC2626]">{errors.consent}</p>}
        </div>
      </div>

      {formError && (
        <p role="alert" data-testid="demo-form-error" className="mt-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-sm text-[#B91C1C]">{formError}</p>
      )}

      <button type="submit" disabled={sending} aria-busy={sending || undefined}
        className="mt-6 group inline-flex w-full h-13 py-3.5 items-center justify-center gap-2 rounded-full bg-[#8F3158] px-7 text-base font-semibold text-white shadow-lg shadow-[#8F3158]/25 hover:bg-[#742544] active:scale-[0.99] disabled:opacity-70 disabled:cursor-wait transition">
        {sending ? (
          <><span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />{t.f_yuborilmoqda}</>
        ) : (
          <>{t.demo_cta}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
        )}
      </button>
    </form>
  );
}
