import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import keresLogoUrl from 'virtual:keres-logo';
import { NAV_SECTIONS } from '../content/catalog';
import { GITHUB_README_URL, GITHUB_REPO_URL } from '../content/links';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { SITE_LANGUAGE_KEY } from '../i18n';
import { useSiteTheme } from '../theme/SiteThemeProvider';

function KeresMark({ size = 28 }: { size?: number }) {
  return (
    <img src={keresLogoUrl} width={size} height={size} alt="" className="mark" aria-hidden="true" />
  );
}

function ThemeToggle() {
  const { preference, cyclePreference } = useSiteTheme();
  const { t } = useTranslation();
  const label = t(`theme.${preference}`);

  return (
    <button type="button" className="theme-toggle" onClick={cyclePreference} title={label}>
      <span aria-hidden="true">
        {preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '🖥️'}
      </span>
      <span className="theme-toggle-text">{label}</span>
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <a href="#top" className="brand">
            <KeresMark />
            <span className="brand-name">Keres</span>
          </a>
          <nav className="site-nav" aria-label={t('nav.menu')}>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="site-nav-links"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {t('nav.menu')}
            </button>
            <div id="site-nav-links" className={menuOpen ? 'nav-links is-open' : 'nav-links'}>
              {NAV_SECTIONS.map((section) => (
                <a key={section} href={`#${section}`} onClick={() => setMenuOpen(false)}>
                  {t(`nav.${section}`)}
                </a>
              ))}
              <a href={GITHUB_REPO_URL} rel="noreferrer" target="_blank">
                {t('nav.github')}
              </a>
            </div>
            <LanguageSelect storageKey={SITE_LANGUAGE_KEY} className="language-select" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-brand">
            <KeresMark size={22} />
            <span className="brand-name">Keres</span>
          </div>
          <p className="disclaimer">{t('footer.tagline')}</p>
          <p className="footer-links">
            <a href={GITHUB_REPO_URL} rel="noreferrer" target="_blank">
              {t('footer.source')}
            </a>
            <span aria-hidden="true"> · </span>
            <a href={GITHUB_README_URL} rel="noreferrer" target="_blank">
              {t('footer.docs')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
