"use client";

import { useParams } from "next/navigation";
import SmartSafetyApp from "@/components/smart-safety/SmartSafetyApp";

/** Smart xavfsizlik (teacher) — DEMO; har bir bo'lim alohida sahifa (/tarbiyachi/smart-safety/<bo'lim>). Flag o'chiq bo'lsa ko'rsatilmaydi. */
export default function TeacherSmartSafetyPage() {
  const params = useParams<{ section?: string[] }>();
  return (
    <div className="mx-auto max-w-7xl">
      <SmartSafetyApp role="teacher" base="/tarbiyachi/smart-safety" path={params?.section ?? []} />
    </div>
  );
}
