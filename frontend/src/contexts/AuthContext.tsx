"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { IS_DEMO, DEMO_USER, getDemoUser, clearDemoRole } from "@/lib/demo-data";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
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

  const login = useCallback(async (phone: string, password: string): Promise<User> => {
    if (IS_DEMO) {
      const demoUser = getDemoUser() ?? DEMO_USER;
      setUser(demoUser);
      return demoUser;
    }
    const res = await api.post<{ user: User }>("/v1/login", { phone, password });
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
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
