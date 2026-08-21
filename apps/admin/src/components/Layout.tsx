import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_LANGUAGE_KEY } from '../i18n';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { useTheme } from '../theme/ThemeProvider';

export function Layout() {
  const { username, logout } = useAuth();
  const { cyclePreference, preference } = useTheme();
  const { t } = useTranslation('admin');
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <nav className={`sidebar${navOpen ? '' : ' collapsed'}`} aria-label={t('nav.ariaLabel')}>
        <button
          type="button"
          className="mobile-nav-toggle button-secondary"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
        >
          {navOpen ? t('nav.hideMenu') : t('nav.menu')}
        </button>
        <h2>{t('nav.title')}</h2>
        <div className="sidebar-links">
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.users')}
          </NavLink>
          <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.recovery')}
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.logs')}
          </NavLink>
          <NavLink to="/tiers" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.tiers')}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.settings')}
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <span>{username || t('nav.signedIn')}</span>
          <LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} />
          <button type="button" onClick={cyclePreference}>
            {t(`theme.${preference}`)}
          </button>
          <button type="button" className="button-secondary" onClick={() => void logout()}>
            {t('nav.signOut')}
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
