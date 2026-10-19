import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SiteThemeProvider } from './theme/SiteThemeProvider';
import { SITE_TEXT_CONTEXT } from './variant';

export function SiteApp() {
  const { t, i18n } = useTranslation();

  // One static index.html serves both languages: title, document language, and description
  // follow the active language instead.
  useEffect(() => {
    document.title = t('meta.title');
    document.documentElement.lang = i18n.language;
    const description = t('meta.description', { context: SITE_TEXT_CONTEXT });
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.append(meta);
    }
    meta.setAttribute('content', description);
  }, [t, i18n.language]);

  return (
    <SiteThemeProvider>
      <Layout>
        <HomePage />
      </Layout>
    </SiteThemeProvider>
  );
}
