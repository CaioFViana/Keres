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
import type {
  ThemePreference} from './theme';
import {
  applyPalette,
  applyResolvedTheme,
  cycleThemePreference,
  readPaletteName,
  readThemePreference,
  resolveTheme,
  writePaletteName,
  writeThemePreference,
  type ResolvedTheme,
} from './theme';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  cyclePreference: () => void;
  /** Nome da paleta de `@keres/shared`; `default` reproduz o visual original do painel. */
  palette: string;
  setPalette: (name: string) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference()),
  );
  const [palette, setPaletteState] = useState<string>(() => readPaletteName());

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyResolvedTheme(next);
    writeThemePreference(preference);
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

  // Claro e escuro têm cores diferentes na mesma paleta, então reaplicar depende dos dois.
  useEffect(() => {
    applyPalette(palette, resolved);
    writePaletteName(palette);
  }, [palette, resolved]);

  const cyclePreference = useCallback(() => {
    setPreference((current) => cycleThemePreference(current));
  }, []);

  const setPalette = useCallback((name: string) => setPaletteState(name), []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      cyclePreference,
      palette,
      setPalette,
    }),
    [preference, resolved, cyclePreference, palette, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
