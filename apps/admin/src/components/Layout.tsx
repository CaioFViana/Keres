import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeProvider';

export function Layout() {
  const { username, logout } = useAuth();
  const { cyclePreference, preferenceLabel } = useTheme();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <nav className={`sidebar${navOpen ? '' : ' collapsed'}`} aria-label="Admin">
        <button
          type="button"
          className="mobile-nav-toggle button-secondary"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
        >
          {navOpen ? 'Hide menu' : 'Menu'}
        </button>
        <h2>Keres Admin</h2>
        <div className="sidebar-links">
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            Users
          </NavLink>
          <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
            Recovery
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
            Logs
          </NavLink>
          <NavLink to="/tiers" className={({ isActive }) => (isActive ? 'active' : '')}>
            Tiers
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Registration Settings
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <span>{username || 'Signed in'}</span>
          <button type="button" onClick={cyclePreference}>
            {preferenceLabel}
          </button>
          <button type="button" className="button-secondary" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
