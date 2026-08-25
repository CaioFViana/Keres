import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RequireAdmin } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import { LogsPage } from './pages/logs/LogsPage';
import { RecoveryPage } from './pages/recovery/RecoveryPage';
import { RegistrationSettingsPage } from './pages/settings/RegistrationSettingsPage';
import { TiersPage } from './pages/tiers/TiersPage';
import { UserFormPage } from './pages/users/UserFormPage';
import { UsersListPage } from './pages/users/UsersListPage';
import { ThemeProvider } from './theme/ThemeProvider';

// Paths relative to the `basename="/admin"` set in main.tsx (which in turn matches vite.config.ts's
// `base: '/admin/'`) - no route here repeats the /admin prefix.
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route element={<Layout />}>
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/users/new" element={<UserFormPage />} />
              <Route path="/users/:id" element={<UserFormPage />} />
              <Route path="/recovery" element={<RecoveryPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/tiers" element={<TiersPage />} />
              <Route path="/settings" element={<RegistrationSettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
