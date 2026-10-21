'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api';
import type { User } from './types';

interface AppState {
  user: User | null;
  ready: boolean;
  cartCount: number;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshCart: () => Promise<void>;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2200);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!getToken()) return setCartCount(0);
    try {
      const items = await api<unknown[]>('/cart');
      setCartCount(items.length);
    } catch {
      setCartCount(0);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await api<User>('/auth/me'));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshCart();
  }, [refreshUser, refreshCart]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
    setToken(r.token);
    setUser(r.user);
    refreshCart();
    return r.user;
  }, [refreshCart]);

  const register = useCallback(async (data: { name: string; email: string; password: string; phone?: string }) => {
    const r = await api<{ token: string; user: User }>('/auth/register', { body: data });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setCartCount(0);
  }, []);

  const value = useMemo(
    () => ({ user, ready, cartCount, login, register, logout, refreshUser, refreshCart, toast }),
    [user, ready, cartCount, login, register, logout, refreshUser, refreshCart, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {msg && (
        <div className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-5 py-3 text-sm text-white shadow-lg" role="status">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp phải nằm trong AppProvider');
  return c;
}
