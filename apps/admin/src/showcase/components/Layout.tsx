import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSelect } from '../../i18n/LanguageSelect';
import { SHOWCASE_LANGUAGE_KEY } from '../../i18n';
import keresLogoUrl from 'virtual:keres-logo';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';

/**
 * O ícone do Keres - o mesmo desenho do app de desktop e do favicon, reduzido em tempo de
 * build a partir de `apps/client/assets/images/desktop_icon.png` (ver vite.keresIcon.ts).
 */
function KeresMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src={keresLogoUrl}
      width={size}
      height={size}
      alt=""
      className="mark"
      // Decorativo: o nome "Keres" aparece escrito ao lado em todos os usos, então anunciar a
      // imagem também só faria o leitor de tela repetir a mesma palavra duas vezes.
      aria-hidden="true"
    />
  );
}

function ThemeToggle() {
  const { preference, cyclePreference } = useShowcaseTheme();
  const { t } = useTranslation('showcase');
  // O rótulo vem do dicionário, não do provider de tema: só a preferência é estado, o texto
  // dela muda com o idioma.
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
 * O mesmo cabeçalho e o mesmo rodapé em todas as páginas.
 *
 * Nada aqui aponta para `/admin`, de propósito: este é o rosto público do servidor, e o painel
 * administrativo não é parte dele nem deve ser anunciado por ele.
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
