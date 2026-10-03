import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MESSAGES_CHANGED_EVENT, MessagesApiService } from '../api/MessagesApiService';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_LANGUAGE_KEY } from '../i18n';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '../theme/theme';

const THEME_ICONS: Record<ThemePreference, { path: ReactNode }> = {
  system: {
    path: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
  },
  light: {
    path: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  dark: {
    path: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
};

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {THEME_ICONS[preference].path}
    </svg>
  );
}

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
          <div className="nav-group">
            <span className="nav-group-title">{t('nav.groupContent')}</span>
            <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
              {t('nav.users')}
            </NavLink>
            <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
              {t('nav.recovery')}
            </NavLink>
            <NavLink to="/activity" className={({ isActive }) => (isActive ? 'active' : '')}>
              {t('nav.activity')}
            </NavLink>
            <NavLink to="/messages" className={({ isActive }) => (isActive ? 'active' : '')}>
              {t('nav.messages')}
              {unread > 0 && (
                <span className="nav-badge" aria-label={t('nav.unreadMessages', { count: unread })}>
                  {unread}
                </span>
              )}
            </NavLink>
          </div>
          <div className="nav-group">
            <span className="nav-group-title">{t('nav.groupSystem')}</span>
            <NavLink to="/payments" className={({ isActive }) => (isActive ? 'active' : '')}>
              {t('nav.payments')}
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
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-user" title={username || undefined}>
            {username || t('nav.signedIn')}
          </span>
          <div className="sidebar-footer-row">
            <LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} />
          </div>
          <div className="sidebar-footer-row">
            <button
              type="button"
              className="icon-button"
              onClick={cyclePreference}
              title={t(`theme.${preference}`)}
              aria-label={t(`theme.${preference}`)}
            >
              <ThemeIcon preference={preference} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => void logout()}
              title={t('nav.signOut')}
              aria-label={t('nav.signOut')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
