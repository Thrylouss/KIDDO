"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BogchaSidebar from "@/components/BogchaSidebar";
import Topbar from "@/components/Topbar";
import { impersonation } from "@/lib/api";

function ImpersonationBanner({ onExit }: { onExit: () => void }) {
  const orgName = impersonation.orgName();
  return (
    <div className="flex items-center justify-between bg-[#7C3AED] text-white text-sm px-4 py-2 flex-shrink-0 z-10">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>Super Admin rejimi — <strong>{orgName}</strong> bog&apos;chasini ko&apos;rmoqdasiz</span>
      </div>
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-xs font-medium"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Chiqish
      </button>
    </div>
  );
}

function BogchaGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role === "super_admin") {
      if (impersonation.active()) {
        setIsImpersonating(true);
      } else {
        router.push("/admin/bogchalar");
      }
    } else if (user.role !== "admin") {
      router.push("/login");
    }
  }, [user, loading, router]);

  function handleExitImpersonation() {
    impersonation.end();
    router.push("/admin/bogchalar");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#2563EB] animate-spin" />
          <p className="text-sm text-[#6B7280]">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== "admin" && !(user.role === "super_admin" && isImpersonating))) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Impersonation banner for super admin */}
      {isImpersonating && <ImpersonationBanner onExit={handleExitImpersonation} />}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex flex-shrink-0">
          <BogchaSidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full z-50 animate-slide-up">
              <BogchaSidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function BogchaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BogchaGuard>{children}</BogchaGuard>
    </AuthProvider>
  );
}
