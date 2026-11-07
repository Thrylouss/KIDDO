"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, impersonation } from "@/lib/api";
import { errorMessage } from "@/lib/apiErrors";
import { BILLING_ENABLED } from "@/lib/features";
import { STATUS_LABELS, copyText, formatDate, formatUzPhone, orgAddress, orgClipboardText, orgStatus } from "@/lib/organizations";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import AdminAccountCard from "@/components/organizations/AdminAccountCard";
import SendNotificationModal from "@/components/organizations/SendNotificationModal";
import OrgFormModal from "@/components/organizations/OrgFormModal";
import OrgStatusDialog from "@/components/organizations/OrgStatusDialog";
import OrgDeleteDialog from "@/components/organizations/OrgDeleteDialog";
import OrgBillingPanel from "@/components/organizations/OrgBillingPanel";
import { OrgStatusBadge, OrgTypeBadge } from "@/components/organizations/OrgBadges";
import { AttendanceTab, ChildrenTab, GroupsTab, HistoryTab, TeachersTab } from "@/components/organizations/OrgDetailTabs";
import uz from "@/i18n/uz";
import type { OrganizationDetail, OrgStatus } from "@/types";

const t = uz.bogchalar;

type Tab = "umumiy" | "guruhlar" | "tarbiyachilar" | "bolalar" | "davomat" | "akkaunt" | "tarix";
const TABS: { key: Tab; label: string }[] = [
  { key: "umumiy", label: t.tab_umumiy },
  { key: "guruhlar", label: t.tab_guruhlar },
  { key: "tarbiyachilar", label: t.tab_tarbiyachilar },
  { key: "bolalar", label: t.tab_bolalar },
  { key: "davomat", label: t.tab_davomat },
  { key: "akkaunt", label: t.tab_akkaunt },
  { key: "tarix", label: t.tab_tarix },
];

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#EDE3E8] bg-white px-4 py-3.5">
      <p className="text-2xl font-bold leading-none text-[#29232A] tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs text-[#766B73]">{label}{sub && <span className="text-[#B8AAB2]"> · {sub}</span>}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4 border-b border-[#F2ECF0] last:border-0">
      <dt className="text-sm text-[#766B73]">{label}</dt>
      <dd className="text-sm font-medium text-[#29232A] break-words">{children || <span className="font-normal text-[#D9C9D1]">—</span>}</dd>
    </div>
  );
}

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast  = useToast();
  const id     = String(params.id);

  const [org, setOrg]         = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState<Tab>("umumiy");
  const [version, setVersion] = useState(0);   // holat o'zgarganda tarixni qayta yuklash

  const [editOpen, setEditOpen]       = useState(false);
  const [statusOpen, setStatusOpen]   = useState(false);
  const [statusPreset, setStatusPreset] = useState<OrgStatus | undefined>(undefined);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [notifyOpen, setNotifyOpen]   = useState(false);
  const [moreOpen, setMoreOpen]       = useState(false);
  const [entering, setEntering]       = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get<{ data: OrganizationDetail }>(`/v1/super-admin/organizations/${id}`);
      if (!res?.data || typeof res.data.id !== "number") throw Object.assign(new Error("not found"), { status: 404, data: {} });
      setOrg(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Tab URL hash'da (#guruhlar) — yangilanganda saqlanadi
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((x) => x.key === h)) setTab(h);
  }, []);
  function selectTab(k: Tab) {
    setTab(k);
    window.history.replaceState(null, "", `#${k}`);
  }
  function onTabKey(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(idx + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    selectTab(next.key);
    tabRefs.current[next.key]?.focus();
  }

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [moreOpen]);

  async function enterPanel() {
    if (!org) return;
    setEntering(true);
    try {
      await api.post(`/v1/super-admin/organizations/${org.id}/enter`, {});
      impersonation.start(org.id, org.name);
      router.push("/bogcha/dashboard");
    } catch (err) {
      toast.error(errorMessage(err));
      setEntering(false);
    }
  }

  async function copy(text: string) {
    setMoreOpen(false);
    if (text && await copyText(text)) toast.success(t.nusxalandi);
    else toast.error(t.nusxa_xato);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 animate-pulse" aria-busy="true">
        <div className="h-4 w-32 rounded bg-[#F2ECF0]" />
        <div className="h-28 rounded-xl bg-white border border-[#EDE3E8]" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 rounded-xl bg-[#F2ECF0]" />)}</div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-6xl mx-auto">
        <div role="alert" className="bg-white rounded-xl border border-[#EDE3E8] p-12 text-center space-y-3">
          <p className="text-[#766B73]">{error || uz.common.yuklash_xatosi}</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/admin/bogchalar")}>{t.ortga}</Button>
            <Button onClick={() => { setLoading(true); load(); }}>{uz.common.qayta_urinish}</Button>
          </div>
        </div>
      </div>
    );
  }

  const status  = orgStatus(org);
  const address = orgAddress(org);
  const today   = org.bugungi_davomat;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link href="/admin/bogchalar" className="inline-flex items-center gap-1.5 text-sm text-[#B8AAB2] hover:text-[#3D3240] transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t.ortga}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-[#EDE3E8] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-[#FDF2F6] flex items-center justify-center text-[#8E315D] text-xl font-bold" aria-hidden="true">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#29232A] break-words">{org.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <OrgTypeBadge type={org.type} />
                <OrgStatusBadge org={org} />
                {org.is_demo && <Badge variant="warning">{uz.super_admin.dev_belgi}</Badge>}
                {org.official_code && <span className="text-xs text-[#766B73]">{t.f_kod}: {org.official_code}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#766B73]">
                {(org.phone || org.director_phone) && (
                  <a href={`tel:${org.phone ?? org.director_phone}`} className="hover:text-[#8E315D]">{formatUzPhone(org.phone ?? org.director_phone)}</a>
                )}
                {address && <span className="break-words">{address}</span>}
                <span>{t.royxatdan_otgan}: {formatDate(org.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>{t.tahrirlash}</Button>
            <Button variant="secondary" onClick={() => { setStatusPreset(undefined); setStatusOpen(true); }}>{t.holatni_ozgartirish}</Button>
            <Button onClick={enterPanel} loading={entering}>{uz.super_admin.bogcha_panel}</Button>
            <div ref={moreRef} className="relative">
              <Button variant="secondary" aria-haspopup="menu" aria-expanded={moreOpen} aria-label={t.amallar_menyu} onClick={() => setMoreOpen((v) => !v)}>⋯</Button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-11 z-30 min-w-[230px] rounded-xl border border-[#EDE3E8] bg-white py-1 shadow-lg">
                  <button role="menuitem" type="button" onClick={() => { setMoreOpen(false); setNotifyOpen(true); }} className="w-full px-3.5 py-2 text-left text-sm text-[#3D3240] hover:bg-[#F2ECF0]">{uz.bildirishnoma.yuborish}</button>
                  <button role="menuitem" type="button" onClick={() => copy(orgClipboardText(org))} className="w-full px-3.5 py-2 text-left text-sm text-[#3D3240] hover:bg-[#F2ECF0]">{t.malumot_nusxa}</button>
                  <button role="menuitem" type="button" onClick={() => copy(address)} className="w-full px-3.5 py-2 text-left text-sm text-[#3D3240] hover:bg-[#F2ECF0]">{t.manzil_nusxa}</button>
                  <div className="my-1 border-t border-[#F2ECF0]" role="separator" />
                  <button role="menuitem" type="button" onClick={() => { setMoreOpen(false); setDeleteOpen(true); }} className="w-full px-3.5 py-2 text-left text-sm text-[#991B1B] hover:bg-[#FEF2F2]">{t.ochirish}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {status !== "active" && (
          <div data-testid="status-banner" className={`mt-4 rounded-xl px-4 py-3 text-sm ${status === "suspended" ? "bg-[#FFFBEB] text-[#92400E]" : "bg-[#F2ECF0] text-[#3D3240]"}`}>
            <span className="font-semibold">{STATUS_LABELS[status]}</span>
            {org.status_reason && <> · {t.sababi}: {org.status_reason}</>}
            {org.status_changed_at && <> · {formatDate(org.status_changed_at)}{org.status_changed_by ? ` (${org.status_changed_by})` : ""}</>}
          </div>
        )}
      </div>

      {/* Statistika — backend'dagi real ma'lumotlardan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t.st_bolalar} value={org.children_count} />
        <Kpi label={t.st_guruhlar} value={org.groups_count} />
        <Kpi label={t.st_tarbiyachilar} value={org.teacher_profiles_count} />
        <Kpi label={t.st_ota_onalar} value={org.parent_profiles_count} />
        <Kpi label={t.st_bugun} value={today ? `${today.keldi}/${today.jami}` : "—"} sub={today ? formatDate(today.sana) : undefined} />
      </div>

      {/* Tablar */}
      <div className="rounded-xl border border-[#EDE3E8] bg-white">
        <div role="tablist" aria-label={org.name} className="flex gap-1 overflow-x-auto border-b border-[#EDE3E8] px-2">
          {TABS.map((x, i) => (
            <button key={x.key} ref={(el) => { tabRefs.current[x.key] = el; }} role="tab" id={`tab-${x.key}`} aria-controls={`panel-${x.key}`}
              aria-selected={tab === x.key} tabIndex={tab === x.key ? 0 : -1} onClick={() => selectTab(x.key)} onKeyDown={(e) => onTabKey(e, i)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:bg-[#FDF2F6]
                ${tab === x.key ? "border-[#8E315D] text-[#8E315D]" : "border-transparent text-[#766B73] hover:text-[#29232A]"}`}>
              {x.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "umumiy" && (
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_320px]">
              <section>
                <h2 className="mb-2 text-sm font-semibold text-[#29232A]">{t.profil}</h2>
                <dl>
                  <Field label={t.f_turi}>{org.type ? (org.type === "davlat" ? t.turi_davlat : t.turi_xususiy) : t.turi_yoq}</Field>
                  <Field label={t.f_kod}>{org.official_code}</Field>
                  <Field label={t.f_raqami}>{org.number}</Field>
                  <Field label={t.f_telefon}>{org.phone && <a href={`tel:${org.phone}`} className="hover:text-[#8E315D]">{formatUzPhone(org.phone)}</a>}</Field>
                  <Field label={t.f_email}>{org.email && <a href={`mailto:${org.email}`} className="hover:text-[#8E315D]">{org.email}</a>}</Field>
                  <Field label={t.f_sayt}>{org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#8E315D]">{org.website}</a>}</Field>
                  <Field label={t.f_viloyat}>{org.region}</Field>
                  <Field label={t.f_tuman}>{org.district}</Field>
                  <Field label={t.f_mfy}>{org.mfy}</Field>
                  <Field label={t.f_kocha}>{org.street}</Field>
                  <Field label={t.f_manzil}>{org.address}</Field>
                  <Field label={t.f_rahbar}>{org.director_name}</Field>
                  <Field label={t.f_rahbar_tel}>{org.director_phone && <a href={`tel:${org.director_phone}`} className="hover:text-[#8E315D]">{formatUzPhone(org.director_phone)}</a>}</Field>
                  <Field label={t.f_rahbar_email}>{org.director_email}</Field>
                  <Field label={t.f_quvvat}>{org.capacity}</Field>
                  <Field label={t.f_izoh}>{org.notes}</Field>
                </dl>
              </section>
              <aside className="space-y-4">
                {today && (
                  <section data-testid="org-attendance" className="rounded-xl border border-[#EDE3E8] p-4">
                    <h2 className="text-sm font-semibold text-[#29232A]">{uz.platforma.tafsilot_davomat} · {formatDate(today.sana)}</h2>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      {[[uz.davomat.jami, today.jami, "text-[#29232A]"], [uz.davomat.keldi, today.keldi, "text-[#166534]"],
                        [uz.davomat.kelmadi, today.kelmadi, "text-[#991B1B]"], [uz.davomat.sababli, today.sababli, "text-[#92400E]"],
                        [uz.davomat.belgilanmagan, today.belgilanmagan, "text-[#766B73]"]].map(([l, v, c]) => (
                        <div key={l as string}><dt className="text-xs text-[#B8AAB2]">{l as string}</dt><dd className={`text-lg font-bold ${c}`}>{v as number}</dd></div>
                      ))}
                    </dl>
                  </section>
                )}
                {BILLING_ENABLED && <OrgBillingPanel org={org} onChanged={load} />}
              </aside>
            </div>
          )}
          {tab === "guruhlar" && <GroupsTab orgId={org.id} />}
          {tab === "tarbiyachilar" && <TeachersTab orgId={org.id} />}
          {tab === "bolalar" && <ChildrenTab orgId={org.id} />}
          {tab === "davomat" && <AttendanceTab orgId={org.id} />}
          {tab === "akkaunt" && (
            <div className="p-5 max-w-xl">
              <AdminAccountCard key={org.admins.map((a) => a.id).join(",") || "none"} org={org} onChanged={load} />
            </div>
          )}
          {tab === "tarix" && <HistoryTab orgId={org.id} version={version} />}
        </div>
      </div>

      <SendNotificationModal orgId={org.id} open={notifyOpen} onClose={() => setNotifyOpen(false)} onSent={(msg) => toast.success(msg)} />

      <OrgFormModal open={editOpen} org={org} onClose={() => setEditOpen(false)}
        onSaved={() => { toast.success(t.f_saqlandi); load(); setVersion((v) => v + 1); }} />

      <OrgStatusDialog org={statusOpen ? org : null} initialStatus={statusPreset} onClose={() => setStatusOpen(false)}
        onChanged={() => { toast.success(t.holat_ozgardi); load(); setVersion((v) => v + 1); }} />

      <OrgDeleteDialog org={deleteOpen ? org : null} onClose={() => setDeleteOpen(false)}
        onDeleted={() => { toast.success(t.ochirildi); router.push("/admin/bogchalar"); }}
        onArchive={() => { setStatusPreset("archived"); setStatusOpen(true); }} />
    </div>
  );
}
