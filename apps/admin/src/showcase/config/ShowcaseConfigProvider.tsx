import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchConfig, type ShowcaseConfig } from '../api/showcaseApi';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';
import { applyShowcasePalette } from '../theme/showcasePalette';

const ShowcaseConfigContext = createContext<ShowcaseConfig | null>(null);

/**
 * The public config, loaded once for the whole site.
 *
 * One fetch instead of one per page: the header, the home eyebrow, the document title, the
 * palette and the about page all read from here. A failure leaves the config null and the site
 * falls back to the Keres defaults, rather than showing nothing.
 */
export function ShowcaseConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShowcaseConfig | null>(null);
  const { resolved } = useShowcaseTheme();
  const { t } = useTranslation('showcase');

  useEffect(() => {
    let cancelled = false;
    fetchConfig().then(
      (loaded) => {
        if (!cancelled) setConfig(loaded);
      },
      () => {
        if (!cancelled) setConfig(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const sitePalette = config?.sitePalette;
  useEffect(() => {
    applyShowcasePalette(sitePalette, resolved);
  }, [sitePalette, resolved]);

  const siteName = config?.siteName;
  useEffect(() => {
    if (siteName) {
      document.title = t('home.documentTitle', { siteName });
    }
  }, [siteName, t]);

  return <ShowcaseConfigContext.Provider value={config}>{children}</ShowcaseConfigContext.Provider>;
}

/** Null until loaded, on error, or outside the provider - callers fall back to Keres. */
export function useShowcaseConfig(): ShowcaseConfig | null {
  return useContext(ShowcaseConfigContext);
}
