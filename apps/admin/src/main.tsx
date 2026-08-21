import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { applyResolvedTheme, readThemePreference, resolveTheme } from './theme/theme';
import { ADMIN_LANGUAGE_KEY, initI18n } from './i18n';
import './styles.css';

// Apply theme before first paint to avoid a light flash when preference is dark.
applyResolvedTheme(resolveTheme(readThemePreference()));
// Antes de renderizar, senão a primeira passagem sai com as chaves cruas na tela.
initI18n(ADMIN_LANGUAGE_KEY, 'admin');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
