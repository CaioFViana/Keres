import React from 'react';
import ReactDOM from 'react-dom/client';
import { SiteApp } from './App';
import { initI18n, SITE_LANGUAGE_KEY } from './i18n';
import {
  applyResolvedTheme,
  readThemePreference,
  resolveTheme,
  SITE_THEME_KEY,
} from './theme/theme';
import './styles.css';

// Apply theme before first paint to avoid a light flash when preference is dark.
applyResolvedTheme(resolveTheme(readThemePreference(SITE_THEME_KEY)));
// Before rendering, otherwise the first pass shows raw keys on screen.
initI18n(SITE_LANGUAGE_KEY);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SiteApp />
  </React.StrictMode>,
);
