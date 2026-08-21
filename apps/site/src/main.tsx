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

applyResolvedTheme(resolveTheme(readThemePreference(SITE_THEME_KEY)));
initI18n(SITE_LANGUAGE_KEY);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SiteApp />
  </React.StrictMode>,
);
