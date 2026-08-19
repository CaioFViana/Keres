import {
  createContext,
  ReactNode,
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
  ThemePreference,
  themePreferenceLabel,
  writeThemePreference,
  type ResolvedTheme,
} from './theme';

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  cyclePreference: () => void;
  preferenceLabel: string;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(readThemePreference()),
  );

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

  const cyclePreference = useCallback(() => {
    setPreference((current) => cycleThemePreference(current));
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      cyclePreference,
      preferenceLabel: themePreferenceLabel(preference),
    }),
    [preference, resolved, cyclePreference],
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
