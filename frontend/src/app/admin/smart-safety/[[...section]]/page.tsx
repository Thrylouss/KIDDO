"use client";

import { useParams } from "next/navigation";
import SmartSafetyApp from "@/components/smart-safety/SmartSafetyApp";

/** Smart xavfsizlik (super_admin) — DEMO; har bir bo'lim alohida sahifa (/admin/smart-safety/<bo'lim>). Flag o'chiq bo'lsa ko'rsatilmaydi. */
export default function SuperAdminSmartSafetyPage() {
  const params = useParams<{ section?: string[] }>();
  return (
    <div className="mx-auto max-w-7xl">
      <SmartSafetyApp role="super_admin" base="/admin/smart-safety" path={params?.section ?? []} />
    </div>
  );
}
