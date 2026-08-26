import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearServerSession,
  login as doLogin,
  logout as doLogout,
  probeAdminAccess,
} from '../api/AdminAuthService';
import {
  getStoredUsername,
  getToken,
  SESSION_CLEARED_EVENT,
  setStoredUsername,
} from '../api/apiClient';

interface AuthState {
  isAuthenticated: boolean;
  /** True while a persisted token is being re-validated against the API. */
  isBootstrapping: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => getStoredUsername());
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [isBootstrapping, setIsBootstrapping] = useState(() => !!getToken());

  const markLoggedOut = useCallback(() => {
    setUsername(null);
    setIsAuthenticated(false);
    setIsBootstrapping(false);
  }, []);

  useEffect(() => {
    const onSessionCleared = () => {
      markLoggedOut();
      void clearServerSession();
    };
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
  }, [markLoggedOut]);

  useEffect(() => {
    if (!getToken()) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    setIsBootstrapping(true);
    probeAdminAccess()
      .then(() => {
        if (cancelled) return;
        setIsAuthenticated(true);
        setUsername(getStoredUsername());
      })
      .catch(() => {
        if (cancelled) return;
        void doLogout().finally(() => {
          if (!cancelled) markLoggedOut();
        });
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [markLoggedOut]);

  const login = useCallback(async (u: string, p: string) => {
    const result = await doLogin(u, p);
    setStoredUsername(result.username);
    setUsername(result.username);
    setIsAuthenticated(true);
    setIsBootstrapping(false);
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    markLoggedOut();
  }, [markLoggedOut]);

  const value = useMemo(
    () => ({ isAuthenticated, isBootstrapping, username, login, logout }),
    [isAuthenticated, isBootstrapping, username, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
