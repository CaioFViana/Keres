import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyResolvedTheme,
  cycleThemePreference,
  readThemePreference,
  resolveTheme,
  SITE_THEME_KEY,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

interface SiteThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  cyclePreference: () => void;
}

const SiteThemeContext = createContext<SiteThemeState | null>(null);

/**
 * Light / dark / system, system by default.
 *
 * Same mechanics as the server's public site (a `data-theme` attribute on `<html>`, the choice
 * in `localStorage`, live `matchMedia`). Its own key: the landing page and the showcase do not
 * share a preference.
 */
export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(SITE_THEME_KEY),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference(SITE_THEME_KEY)),
  );

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyResolvedTheme(next);
    writeThemePreference(preference, SITE_THEME_KEY);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = resolveTheme('system');
      setResolved(next);
      applyResolvedTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const cyclePreference = useCallback(() => {
    setPreference((current) => cycleThemePreference(current));
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      cyclePreference,
    }),
    [preference, resolved, cyclePreference],
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme(): SiteThemeState {
  const context = useContext(SiteThemeContext);
  if (!context) {
    throw new Error('useSiteTheme must be used within SiteThemeProvider');
  }
  return context;
}
