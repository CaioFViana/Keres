import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ShowcaseApp } from './App';
import { SHOWCASE_THEME_KEY } from './theme/ShowcaseThemeProvider';
import { applyResolvedTheme, readThemePreference, resolveTheme } from '../theme/theme';
import './showcase.css';

// Antes da primeira pintura, para quem prefere escuro não levar um flash claro na cara.
applyResolvedTheme(resolveTheme(readThemePreference(SHOWCASE_THEME_KEY)));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Na raiz: as páginas do site moram em `/`, e só os arquivos estáticos em `/_showcase/`. */}
    <BrowserRouter>
      <ShowcaseApp />
    </BrowserRouter>
  </React.StrictMode>,
);
