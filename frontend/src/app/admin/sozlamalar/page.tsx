"use client";
import uz from "@/i18n/uz";

export default function SozlamalarPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Sozlamalar</h1>
        <span className="text-xs font-medium text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-full">
          {uz.common.tez_kunda}
        </span>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 flex items-center justify-center">
        <p className="text-[#9CA3AF]">{uz.common.tez_kunda}</p>
      </div>
    </div>
  );
}
