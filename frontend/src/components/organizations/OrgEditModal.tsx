"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import uz from "@/i18n/uz";
import type { OrganizationDetail } from "@/types";

interface OrgEditModalProps {
  org: OrganizationDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Field = "name" | "address" | "phone" | "district" | "number" | "mfy" | "capacity" | "director_name" | "director_phone";

const FIELDS: { key: Field; label: string; type?: string; placeholder?: string }[] = [
  { key: "name",           label: uz.bogcha_import.nomi },
  { key: "number",         label: uz.bogcha_import.raqami },
  { key: "district",       label: uz.bogcha_import.tuman },
  { key: "mfy",            label: uz.bogcha_import.mfy },
  { key: "address",        label: uz.bogcha_import.manzili },
  { key: "capacity",       label: uz.bogcha_import.quvvati, type: "number" },
  { key: "director_name",  label: uz.bogcha_import.rahbar },
  { key: "director_phone", label: uz.bogcha_import.rahbar_tel, placeholder: "+998XXXXXXXXX" },
  { key: "phone",          label: uz.auth.telefon, placeholder: "+998XXXXXXXXX" },
];

const initial = (org: OrganizationDetail): Record<Field, string> =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, org[key] == null ? "" : String(org[key])])) as Record<Field, string>;

/** Bog'cha ma'lumotlari va reyestr maydonlarini tahrirlash (Super Admin). */
export default function OrgEditModal({ org, open, onClose, onSaved }: OrgEditModalProps) {
  const [form, setForm]     = useState<Record<Field, string>>(() => initial(org));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError]   = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError("");
    try {
      const body = Object.fromEntries(FIELDS.map(({ key }) => {
        const v = form[key].trim();
        return [key, v === "" ? null : key === "capacity" ? Number(v) : v];
      }));
      await api.put(`/v1/super-admin/organizations/${org.id}`, { ...body, name: form.name.trim() });
      onSaved();
      onClose();
    } catch (err) {
      const d = (err as { data?: { errors?: Record<string, string[]> } }).data;
      if (d?.errors) setErrors(d.errors);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={uz.akkaunt.tahrirlash_sarlavha}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{uz.common.bekor_qilish}</Button>
          <Button form="org-edit-form" type="submit" loading={saving} disabled={!form.name.trim()}>{uz.common.saqlash}</Button>
        </>
      }
    >
      <form id="org-edit-form" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
        {error && <p role="alert" className="sm:col-span-2 text-sm text-[#B91C1C]">{error}</p>}
        {FIELDS.map(({ key, label, type, placeholder }) => (
          <div key={key} className={key === "name" || key === "address" ? "sm:col-span-2" : ""}>
            <Input id={`org-${key}`} label={label} type={type ?? "text"} value={form[key]} placeholder={placeholder}
              required={key === "name"} onChange={(e) => setForm({ ...form, [key]: e.target.value })} error={errors[key]?.[0]} />
          </div>
        ))}
      </form>
    </Modal>
  );
}
