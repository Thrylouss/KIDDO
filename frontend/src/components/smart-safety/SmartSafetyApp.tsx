"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";
import { setResolveNote } from "@/lib/smart-safety/store";
import { SECTIONS, sectionHref } from "@/lib/smart-safety/nav";
import { CHILDREN, DEMO_TEACHER_ID, GROUPS, type Role } from "@/lib/smart-safety/model";
import { SMART_SAFETY_DEMO } from "@/lib/smart-safety/features";
import { AlertBanner } from "./AlertCenter";
import ParentApp from "./ParentApp";
import { sectionLabel, useSections } from "./SmartNav";
import {
  ActivityView, AlertsView, AttendanceView, ChildrenHub, DevicesView, DirectorOverview, DirectorSettings, HeadcountView, MapView,
  PageTitle, PickupView, ReportsView, SADevices, SAKindergartens, SAOverview, SASettings, TeacherOverview, subLabel, type ViewCtx,
} from "./Views";
import Icon from "./Icons";
import { useSafety } from "./shared";

type StaffRole = Exclude<Role, "parent">;

/** Rol doirasidagi bolalar: tarbiyachi — faqat o'z guruhi; rahbar — butun bog'cha; Super Admin — hech biri (faqat agregat). */
export function scopeFor(role: Role): string[] {
  if (role === "teacher") {
    const g = GROUPS.find((x) => x.teacherId === DEMO_TEACHER_ID)!;
    return CHILDREN.filter((c) => c.groupId === g.id).map((c) => c.id);
  }
  return role === "director" ? CHILDREN.map((c) => c.id) : [];
}

/** Bitta kichik DEMO + «Tez kunda» belgisi. */
export function DemoChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warning-text)]" data-testid="demo-badge" title={uz.ss.demo_banner}>
      {uz.ss.demo}<span aria-hidden="true">·</span><span className="font-medium">{uz.ss.soon}</span>
    </span>
  );
}

/** Joriy sahifa manzilidan «?bola=» ni o'qiydi (useSearchParams talab qiladigan Suspense'siz). */
function useFocusParam(): string | null {
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setFocus(new URLSearchParams(window.location.search).get("bola"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  });
  return focus;
}

export default function SmartSafetyApp({ role, base, path, presentation = false }: { role: Role; base: string; path: string[]; presentation?: boolean }) {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  useEffect(() => { setResolveNote(uz.ss.resolve_note); });
  if (!SMART_SAFETY_DEMO) {
    return <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{uz.ss.disabled}</p>;
  }
  if (role === "parent") return <ParentApp />;
  return <StaffApp role={role} base={base} path={path} presentation={presentation} />;
}

function StaffApp({ role, base, path, presentation }: { role: StaffRole; base: string; path: string[]; presentation: boolean }) {
  const { state } = useSafety();
  const focus = useFocusParam();
  const sections = useSections(role);
  const [slug = "", sub, rest] = path;
  const section = sections.find((s) => s.slug === slug) ?? null;
  const known = SECTIONS[role].some((s) => s.slug === slug);
  const ctx: ViewCtx = {
    role, actor: role, childIds: scopeFor(role),
    href: (s, q = "") => sectionHref(base, s, q),
  };
  const title = section ? sectionLabel(role, section) : uz.ssx.sections.overview;
  const crumbs: [string, string][] = [[uz.ss.nav, base]];
  if (section?.slug) crumbs.push([title, sectionHref(base, section.slug)]);
  if (section && sub) crumbs.push([subLabel(sub, state), sectionHref(base, `${section.slug}/${sub}`)]);
  if (section && sub && rest) crumbs.push([subLabel(rest, state), ""]);

  const view = () => {
    if (!section) {
      return known
        ? <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm text-[var(--text-2)]">{uz.ss.disabled}</p>
        : <p className="text-sm text-[var(--text-2)]"><Link className="text-[var(--primary)] hover:underline" href={base}>{uz.ssx.sections.overview} →</Link></p>;
    }
    switch (`${role}:${section.slug}`) {
      case "super_admin:": return <SAOverview ctx={ctx} />;
      case "super_admin:bogchalar": return <SAKindergartens />;
      case "super_admin:qurilmalar": return <SADevices />;
      case "super_admin:hisobotlar": return <ReportsView anonymous />;
      case "super_admin:sozlamalar": return <SASettings ctx={ctx} />;
      case "director:": return <DirectorOverview ctx={ctx} />;
      case "director:xarita": return <MapView ctx={ctx} focus={focus} withTabs />;
      case "director:bolalar": return <ChildrenHub ctx={ctx} sub={sub} rest={rest} />;
      case "director:davomat": return <AttendanceView ctx={ctx} />;
      case "director:ogohlantirishlar": return <AlertsView ctx={ctx} />;
      case "director:qurilmalar": return <DevicesView ctx={ctx} sub={sub} />;
      case "director:hisobotlar": return <ReportsView />;
      case "director:sozlamalar": return <DirectorSettings ctx={ctx} />;
      case "teacher:": return <TeacherOverview ctx={ctx} />;
      case "teacher:xarita": return <MapView ctx={ctx} focus={focus} withTabs={false} />;
      case "teacher:davomat": return <AttendanceView ctx={ctx} />;
      case "teacher:sanash": return <HeadcountView ctx={ctx} canEvacuate={false} />;
      case "teacher:topshirish": return <PickupView ctx={ctx} />;
      case "teacher:ogohlantirishlar": return <AlertsView ctx={ctx} />;
      case "teacher:faollik": return <ActivityView ctx={ctx} sub={sub} />;
    }
    return null;
  };

  const showBanner = role !== "super_admin" && section?.slug !== "ogohlantirishlar";
  const lastTitle = crumbs.length > 1 ? crumbs[crumbs.length - 1][0] : title;

  return (
    <div className="min-w-0" data-testid={`workspace-${role}`}>
      {(crumbs.length > 1 || !presentation) && <div className="mb-3 flex flex-wrap items-center gap-2">
        {crumbs.length > 1 && (
          <nav aria-label="breadcrumb" className="min-w-0 flex-1">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-[var(--text-2)]">
              {crumbs.map(([label, href], i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <Icon name="chevron" className="h-3.5 w-3.5 text-[var(--text-3)]" />}
                  {i < crumbs.length - 1 && href ? <Link href={href} className="hover:text-[var(--primary)]">{label}</Link> : <span aria-current="page" className="text-[var(--text)]">{label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {!presentation && <span className="ml-auto"><DemoChip /></span>}
      </div>}
      {showBanner && (
        <AlertBanner childIds={role === "teacher" ? ctx.childIds : null} actor={role}
          alertsHref={ctx.href("ogohlantirishlar")} mapHref={(id) => ctx.href("xarita", `?bola=${id}`)} />
      )}
      <PageTitle title={crumbs.length > 1 ? lastTitle : uz.ss.nav} />
      {view()}
    </div>
  );
}
