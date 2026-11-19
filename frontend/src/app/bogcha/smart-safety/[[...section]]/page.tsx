"use client";

import { useParams } from "next/navigation";
import SmartSafetyApp from "@/components/smart-safety/SmartSafetyApp";

/** Smart xavfsizlik (director) — DEMO; har bir bo'lim alohida sahifa (/bogcha/smart-safety/<bo'lim>). Flag o'chiq bo'lsa ko'rsatilmaydi. */
export default function DirectorSmartSafetyPage() {
  const params = useParams<{ section?: string[] }>();
  return (
    <div className="mx-auto max-w-7xl">
      <SmartSafetyApp role="director" base="/bogcha/smart-safety" path={params?.section ?? []} />
    </div>
  );
}
