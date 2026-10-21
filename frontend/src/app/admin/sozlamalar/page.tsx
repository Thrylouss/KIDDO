"use client";
import uz from "@/i18n/uz";

export default function SozlamalarPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-[#29232A]">Sozlamalar</h1>
        <span className="text-xs font-medium text-[#766B73] bg-[#F2ECF0] px-2 py-1 rounded-full">
          {uz.common.tez_kunda}
        </span>
      </div>
      <div className="bg-white rounded-xl border border-[#EDE3E8] p-12 flex items-center justify-center">
        <p className="text-[#B8AAB2]">{uz.common.tez_kunda}</p>
      </div>
    </div>
  );
}
