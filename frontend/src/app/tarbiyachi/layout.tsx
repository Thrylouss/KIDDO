"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import TarbiyachiSidebar from "@/components/TarbiyachiSidebar";
import Topbar from "@/components/Topbar";
import DemoBanner from "@/components/DemoBanner";
import { IS_DEMO } from "@/lib/demo-data";
import uz from "@/i18n/uz";

function TarbiyachiGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "teacher") { router.push("/login"); }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
          <p className="text-sm text-[var(--text-2)]">{uz.common.yuklanmoqda}</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] overflow-hidden">
      {IS_DEMO && <DemoBanner />}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex flex-shrink-0">
          <TarbiyachiSidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full z-50 animate-slide-up">
              <TarbiyachiSidebar onClose={() => setSidebarOpen(false)} />
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

export default function TarbiyachiLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TarbiyachiGuard>{children}</TarbiyachiGuard>
    </AuthProvider>
  );
}
