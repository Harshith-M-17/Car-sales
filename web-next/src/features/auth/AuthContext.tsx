'use client';

import { useQueryClient, type Query } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, session } from '@/lib/api';
import type { AuthPayload, User } from '@/lib/types';
import type { toDealerInput } from '@/lib/validation';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  accountType: 'buyer' | 'seller';
  sellerProfile?: ReturnType<typeof toDealerInput>;
}

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: User | null;
  login(email: string, password: string): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  /** Apply a fresh auth payload (e.g. after becoming a dealer or changing password). */
  applyAuth(payload: AuthPayload): void;
  setUser(user: User): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: AuthContextValue['status']; user: User | null }>({
    status: 'loading',
    user: null,
  });
  const userId = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = session.subscribe((payload) => {
      const nextId = payload?.user.id ?? null;
      if (nextId !== userId.current) {
        const notCatalog = (q: Query) => q.queryKey[0] !== 'catalog';
        // Signing in, or restoring a session on page load: cached data is public, so keep showing
        // the server-rendered copy while it refetches with personal details like saved cars.
        if (userId.current === null) void queryClient.invalidateQueries({ predicate: notCatalog });
        // Signing out or switching account: drop what belonged to the previous user.
        else queryClient.removeQueries({ predicate: notCatalog });
        userId.current = nextId;
      }
      setState(payload ? { status: 'authenticated', user: payload.user } : { status: 'anonymous', user: null });
    });

    // Stay signed in across reloads. The check picks up changes made on other devices, and drops
    // logins that were ended elsewhere or suspended. Any other failure leaves the login in place.
    if (session.restore()) {
      void api<User>('/auth/session', { method: 'POST', body: { refreshToken: session.refreshToken } })
        .then((user) => session.setUser(user))
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) session.set(null);
        });
    }

    const stopWatching = session.watchOtherTabs();
    return () => {
      unsubscribe();
      stopWatching();
    };
  }, [queryClient]);

  const applyAuth = useCallback((payload: AuthPayload) => session.set(payload), []);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await api<AuthPayload>('/auth/login', { method: 'POST', body: { email, password } });
    session.set(payload);
    return payload.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const payload = await api<AuthPayload>('/auth/register', { method: 'POST', body: input });
    session.set(payload);
    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken;
    try {
      if (refreshToken) await api('/auth/logout', { method: 'POST', body: { refreshToken } });
    } finally {
      session.set(null);
    }
  }, []);

  const setUser = useCallback((user: User) => session.setUser(user), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, applyAuth, setUser }),
    [state, login, register, logout, applyAuth, setUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
