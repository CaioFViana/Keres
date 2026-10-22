import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { legalPageOfHash, legalPageOfPath, legalPath } from './content/legalPages';
import { LegalPage } from './pages/LegalPage';
import { ShowcaseAvailabilityProvider } from './components/ShowcaseAvailability';
import { HomePage } from './pages/HomePage';
import { SiteThemeProvider } from './theme/SiteThemeProvider';
import { isLandingBuild, siteText } from './variant';

export function SiteApp() {
  const { t, i18n } = useTranslation();
  // The legal documents have pages of their own, on the landing only: the project site presents no server's policy.
  const legal = isLandingBuild ? legalPageOfPath(window.location.pathname) : null;

  // The old addresses, `/#privacy` and `/#terms` (the Play listing's among them), go to the page of their document.
  useEffect(() => {
    if (!isLandingBuild || legal !== null) return;
    const page = legalPageOfHash(window.location.hash);
    if (page !== null) window.location.replace(legalPath(page));
  }, [legal]);

  // One static index.html serves both languages: title, document language, and description
  // follow the active language instead.
  useEffect(() => {
    document.title = legal ? `${t(`legal.tabs.${legal}`)} · Keres` : t('meta.title');
    document.documentElement.lang = i18n.language;
    const description = siteText(t, 'meta.description');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.append(meta);
    }
    meta.setAttribute('content', description);
  }, [t, i18n.language, legal]);

  return (
    <SiteThemeProvider>
      <ShowcaseAvailabilityProvider>
        <Layout home={legal === null}>{legal ? <LegalPage kind={legal} /> : <HomePage />}</Layout>
      </ShowcaseAvailabilityProvider>
    </SiteThemeProvider>
  );
}
