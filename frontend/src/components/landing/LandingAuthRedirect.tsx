"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { landingFor } from "@/lib/roles";

function Redirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(landingFor(user));
  }, [loading, user, router]);

  return null;
}

/** Tizimga kirgan foydalanuvchi landing'ni ochsa — o'z paneliga (login sahifasi bilan bir xil qoida). Mehmon uchun hech narsa qilmaydi. */
export default function LandingAuthRedirect() {
  return (
    <AuthProvider>
      <Redirect />
    </AuthProvider>
  );
}
