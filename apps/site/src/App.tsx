import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { SiteThemeProvider } from './theme/SiteThemeProvider';

export function SiteApp() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('meta.title');
    document.documentElement.lang = i18n.language;
    const description = t('meta.description');
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
