"use client";

/**
 * Ported from zemfi-mobile's state/auth.tsx. Same contract (useAuth: user,
 * status, signIn, signOut, refreshUser); the web build has no push device to
 * register and listens to the browser's `online` event instead of NetInfo.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "@/lib/api";
import { secureStorage } from "@/lib/secureStorage";
import { logout } from "@/lib/sessions";
import type { AuthUser, SignInResponse } from "@/types/api";

interface AuthState {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  /** The profile came from the offline cache, not from the server. */
  stale: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isUnauthorized = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { status?: unknown }).status === 401;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({ user: null, status: "loading", stale: false });

  const signOut = useCallback(async () => {
    const refreshToken = await secureStorage.getRefreshToken();
    if (refreshToken) await logout(refreshToken);
    await secureStorage.clear();
    setState({ user: null, status: "unauthenticated", stale: false });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void secureStorage.clear();
      setState({ user: null, status: "unauthenticated", stale: false });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ data: { user: AuthUser } }>("/user/me");
      setState({ user: res.data.user, status: "authenticated", stale: false });
      await secureStorage.setUser(res.data.user);
    } catch (err) {
      // Only a 401 ends the session (api.ts has already cleared it). Offline
      // or a 5xx falls back to the last known profile.
      if (isUnauthorized(err)) return;
      const cached = await secureStorage.getUser();
      if (cached) {
        setState({ user: cached, status: "authenticated", stale: true });
        return;
      }
      setState({ user: null, status: "unauthenticated", stale: false });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await secureStorage.getAccessToken();
      if (!token) {
        setState({ user: null, status: "unauthenticated", stale: false });
        return;
      }
      await refreshUser();
    })();
  }, [refreshUser]);

  // Replace a cached profile as soon as the browser is back online.
  useEffect(() => {
    if (!state.stale) return;
    const onOnline = () => void refreshUser();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [state.stale, refreshUser]);

  const signIn = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    const res = await api.post<SignInResponse>("/authentication/login", {
      email,
      password,
      ...(twoFactorCode ? { twoFactorCode } : {}),
    });
    const { user, accessToken, refreshToken } = res.data;
    await secureStorage.setAccessToken(accessToken);
    await secureStorage.setRefreshToken(refreshToken);
    await secureStorage.setUser(user);
    setState({ user, status: "authenticated", stale: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, refreshUser }),
    [state, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
