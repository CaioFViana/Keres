import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <h2>Keres Admin</h2>
        <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          Users
        </NavLink>
        <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'active' : '')}>
          Recovery
        </NavLink>
        <NavLink to="/tiers" className={({ isActive }) => (isActive ? 'active' : '')}>
          Tiers
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          Registration Settings
        </NavLink>
        <div className="sidebar-footer">
          <span>{username}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
