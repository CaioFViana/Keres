import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSelect } from '../../i18n/LanguageSelect';
import { SHOWCASE_LANGUAGE_KEY } from '../../i18n';
import keresLogoUrl from 'virtual:keres-logo';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';

/**
 * The Keres icon - the same artwork as the desktop app and the favicon, scaled down at build time
 * from `apps/client/assets/images/desktop_icon.png` (see vite.keresIcon.ts).
 */
function KeresMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src={keresLogoUrl}
      width={size}
      height={size}
      alt=""
      className="mark"
      // Decorative: the name "Keres" appears written next to it in every use, so announcing the image
      // too would only make the screen reader repeat the same word twice.
      aria-hidden="true"
    />
  );
}

function ThemeToggle() {
  const { preference, cyclePreference } = useShowcaseTheme();
  const { t } = useTranslation('showcase');
  // The label comes from the dictionary, not from the theme provider: only the preference is state,
  // its text changes with the language.
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

/**
 * The same header and the same footer on every page.
 *
 * Nothing here points at `/admin`, on purpose: this is the server's public face, and the
 * administration panel is neither part of it nor to be advertised by it.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('showcase');

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <KeresMark />
            <span className="brand-name">Keres</span>
          </Link>
          <nav className="site-nav">
            <Link to="/">{t('nav.stories')}</Link>
            <Link to="/packs">{t('nav.packs')}</Link>
            <Link to="/about">{t('nav.about')}</Link>
            <LanguageSelect storageKey={SHOWCASE_LANGUAGE_KEY} className="language-select" />
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
          <p className="disclaimer">{t('footer.disclaimer')}</p>
        </div>
      </footer>
    </div>
  );
}
