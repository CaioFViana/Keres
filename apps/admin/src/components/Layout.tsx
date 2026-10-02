import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MESSAGES_CHANGED_EVENT, MessagesApiService } from '../api/MessagesApiService';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_LANGUAGE_KEY } from '../i18n';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { useTheme } from '../theme/ThemeProvider';

export function Layout() {
  const { username, logout } = useAuth();
  const { cyclePreference, preference } = useTheme();
  const { t } = useTranslation('admin');
  const [navOpen, setNavOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  // The badge on Messages: how many still need attention. It is read again when the page changes
  // and whenever something on a page announces that the messages did.
  useEffect(() => {
    let ignore = false;
    const refresh = () => {
      MessagesApiService.unreadCount()
        .then((result) => {
          if (!ignore) setUnread(result.unread);
        })
        .catch(() => {
          // A badge is a nicety: without it the navigation still works.
        });
    };
    refresh();
    window.addEventListener(MESSAGES_CHANGED_EVENT, refresh);
    return () => {
      ignore = true;
      window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh);
    };
  }, [location.pathname]);

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
          <NavLink to="/activity" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.activity')}
          </NavLink>
          <NavLink to="/payments" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.payments')}
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.logs')}
          </NavLink>
          <NavLink to="/tiers" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.tiers')}
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('nav.messages')}
            {unread > 0 && (
              <span className="nav-badge" aria-label={t('nav.unreadMessages', { count: unread })}>
                {unread}
              </span>
            )}
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
