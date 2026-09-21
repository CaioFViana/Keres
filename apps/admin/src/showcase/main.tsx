import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ShowcaseApp } from './App';
import { SHOWCASE_THEME_KEY } from './theme/ShowcaseThemeProvider';
import { initI18n, SHOWCASE_LANGUAGE_KEY } from '../i18n';
import { applyResolvedTheme, readThemePreference, resolveTheme } from '../theme/theme';
import './showcase.css';

// Before the first paint, so whoever prefers dark does not get a flash of light in the face.
applyResolvedTheme(resolveTheme(readThemePreference(SHOWCASE_THEME_KEY)));
// Before rendering, otherwise the first pass shows raw keys on screen.
initI18n(SHOWCASE_LANGUAGE_KEY, 'showcase');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Pages live under `/showcase` in production; under `vite dev` the port serves only this site, so the root. */}
    <BrowserRouter basename={import.meta.env.PROD ? '/showcase' : undefined}>
      <ShowcaseApp />
    </BrowserRouter>
  </React.StrictMode>,
);
