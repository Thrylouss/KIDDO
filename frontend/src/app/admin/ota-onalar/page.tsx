"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { ApiResponse, ParentProfile } from "@/types";
import uz from "@/i18n/uz";

const parentIcon = (
  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function OtaOnalarPage() {
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ParentProfile[]>>("/v1/admin/parents");
      setParents(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={uz.ota_onalar.sarlavha}
        description={uz.ota_onalar.sahifa_tavsif}
      />

      <div className="bg-white rounded-xl border border-[#EDE3E8] overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : error ? (
          <EmptyState title={uz.common.yuklash_xatosi} action={{ label: uz.common.qayta_urinish, onClick: load }} icon={parentIcon} />
        ) : parents.length === 0 ? (
          <EmptyState
            icon={parentIcon}
            title={uz.ota_onalar.bosh_sarlavha}
            description={uz.ota_onalar.bosh_tavsif}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EDE3E8] bg-[#FAF5F8]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">Ota-ona</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide hidden sm:table-cell">{uz.ota_onalar.telefon}</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#766B73] uppercase tracking-wide">{uz.ota_onalar.bola}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECF0]">
              {parents.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF5F8] transition-colors duration-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                      <div>
                        <p className="font-medium text-[#29232A]">{p.last_name} {p.first_name}</p>
                        <p className="text-xs text-[#B8AAB2] sm:hidden">{p.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[#766B73] hidden sm:table-cell">{p.phone}</td>
                  <td className="px-5 py-4">
                    {p.children && p.children.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.children.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-[#F2ECF0] text-[#3D3240] px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#B8AAB2]" />
                            {c.last_name} {c.first_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#D9C9D1]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
