import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fetchViewer,
  login as loginRequest,
  logout as logoutRequest,
  readSessionToken,
  type ShowcaseViewer,
} from '../api/showcaseAuth';

export type ShowcaseAuthStatus = 'loading' | 'anonymous' | 'signed-in';

interface ShowcaseAuth {
  status: ShowcaseAuthStatus;
  viewer: ShowcaseViewer | null;
  /** Whether adults-only entries are visible: signed in AND age-verified. */
  seesNsfw: boolean;
  login: (username: string, password: string) => Promise<ShowcaseViewer>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ShowcaseAuthContext = createContext<ShowcaseAuth | null>(null);

export function ShowcaseAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ShowcaseAuthStatus>('loading');
  const [viewer, setViewer] = useState<ShowcaseViewer | null>(null);

  const refresh = useCallback(async () => {
    const token = readSessionToken();
    if (!token) {
      setViewer(null);
      setStatus('anonymous');
      return;
    }
    const current = await fetchViewer(token).catch(() => null);
    if (!current) {
      setViewer(null);
      setStatus('anonymous');
      return;
    }
    setViewer(current);
    setStatus('signed-in');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const signedIn = await loginRequest(username, password);
    setViewer(signedIn);
    setStatus('signed-in');
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setViewer(null);
    setStatus('anonymous');
  }, []);

  return (
    <ShowcaseAuthContext.Provider
      value={{ status, viewer, seesNsfw: viewer?.isAdultVerified === true, login, logout, refresh }}
    >
      {children}
    </ShowcaseAuthContext.Provider>
  );
}

export function useShowcaseAuth(): ShowcaseAuth {
  const auth = useContext(ShowcaseAuthContext);
  if (!auth) {
    throw new Error('useShowcaseAuth must be used inside ShowcaseAuthProvider');
  }
  return auth;
}
