"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, impersonation, setUnauthorizedHandler } from "@/lib/api";
import { PASSWORD_CHANGE_ROUTE } from "@/lib/roles";
import { IS_DEMO, DEMO_USER, getDemoUser, clearDemoRole } from "@/lib/demo-data";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** login — foydalanuvchi nomi yoki telefon raqami */
  login: (login: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Server qaytargan yangilangan foydalanuvchi (masalan, parol almashtirilgandan keyin) */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (IS_DEMO) {
      setUser(getDemoUser());
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ user: User }>("/v1/me");
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Expired session: clearing the user lets the layout guards redirect to /login.
  // Impersonatsiya belgisi ham tozalanadi — keyingi foydalanuvchiga eski bog'cha konteksti o'tmasin.
  useEffect(() => setUnauthorizedHandler(() => { impersonation.end(); setUser(null); }), []);

  // Vaqtinchalik parol: parol almashtirilmaguncha istalgan paneldan parol sahifasiga (backend ham 403 qaytaradi)
  useEffect(() => {
    if (user?.must_change_password && window.location.pathname !== PASSWORD_CHANGE_ROUTE) {
      window.location.replace(PASSWORD_CHANGE_ROUTE);
    }
  }, [user]);

  const login = useCallback(async (login: string, password: string): Promise<User> => {
    if (IS_DEMO) {
      const demoUser = getDemoUser() ?? DEMO_USER;
      setUser(demoUser);
      return demoUser;
    }
    // Yangi sessiya oldingi foydalanuvchining impersonatsiya kontekstini meros qilib olmasin
    impersonation.end();
    const res = await api.post<{ user: User }>("/v1/login", { login: login.trim(), password });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    if (IS_DEMO) {
      clearDemoRole();
      setUser(null);
      return;
    }
    try {
      await api.post("/v1/logout");
    } catch (err) {
      // 401 means the server session is already gone — safe to clear locally.
      // Any other failure may have left the token valid, so keep the user
      // and let the caller report the error instead of faking a logout.
      if ((err as { status?: number })?.status !== 401) throw err;
    }
    impersonation.end();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
