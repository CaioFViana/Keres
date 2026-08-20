import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
  const { preference, cyclePreference, preferenceLabel } = useShowcaseTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cyclePreference}
      title={preferenceLabel}
    >
      <span aria-hidden="true">
        {preference === 'dark' ? '🌙' : preference === 'light' ? '☀️' : '🖥️'}
      </span>
      <span className="theme-toggle-text">{preferenceLabel}</span>
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
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand">
            <KeresMark />
            <span className="brand-name">Keres</span>
          </Link>
          <nav className="site-nav">
            <Link to="/">Stories</Link>
            <Link to="/about">About</Link>
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
          <p className="disclaimer">
            Keres is a writing companion for planning stories. It is not affiliated with the server
            hosting this page, nor with the stories published on it, and it does not endorse or
            moderate them. Every story here belongs to the person who published it.
          </p>
        </div>
      </footer>
    </div>
  );
}
