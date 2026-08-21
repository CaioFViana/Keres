import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ShowcaseApp } from './App';
import { SHOWCASE_THEME_KEY } from './theme/ShowcaseThemeProvider';
import { initI18n, SHOWCASE_LANGUAGE_KEY } from '../i18n';
import { applyResolvedTheme, readThemePreference, resolveTheme } from '../theme/theme';
import './showcase.css';

// Antes da primeira pintura, para quem prefere escuro não levar um flash claro na cara.
applyResolvedTheme(resolveTheme(readThemePreference(SHOWCASE_THEME_KEY)));
// Antes de renderizar, senão a primeira passagem sai com as chaves cruas na tela.
initI18n(SHOWCASE_LANGUAGE_KEY, 'showcase');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Páginas em `/showcase` (produção); em `vite dev` a porta é só do site, então a raiz. */}
    <BrowserRouter basename={import.meta.env.PROD ? '/showcase' : undefined}>
      <ShowcaseApp />
    </BrowserRouter>
  </React.StrictMode>,
);
