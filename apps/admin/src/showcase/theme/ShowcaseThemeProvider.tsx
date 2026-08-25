import type {
  ReactNode} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyResolvedTheme,
  cycleThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../../theme/theme';

export const SHOWCASE_THEME_KEY = 'keres_showcase_theme_preference';

interface ShowcaseThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  cyclePreference: () => void;
}

const ShowcaseThemeContext = createContext<ShowcaseThemeState | null>(null);

/**
 * Claro / escuro / sistema, com sistema por padrão.
 *
 * Reaproveita `theme.ts` do painel: a mecânica é a mesma (atributo `data-theme` no `<html>`,
 * escolha explícita gravada em `localStorage`, `matchMedia` ao vivo enquanto a preferência é
 * "sistema"). O que muda é só a chave de armazenamento - painel e site são coisas separadas e
 * cada um lembra da sua própria preferência.
 */
export function ShowcaseThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(SHOWCASE_THEME_KEY),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference(SHOWCASE_THEME_KEY)),
  );

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyResolvedTheme(next);
    writeThemePreference(preference, SHOWCASE_THEME_KEY);
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

  return <ShowcaseThemeContext.Provider value={value}>{children}</ShowcaseThemeContext.Provider>;
}

export function useShowcaseTheme(): ShowcaseThemeState {
  const context = useContext(ShowcaseThemeContext);
  if (!context) {
    throw new Error('useShowcaseTheme must be used within ShowcaseThemeProvider');
  }
  return context;
}
