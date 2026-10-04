import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RequireAdmin } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import { ActivityPage } from './pages/activity/ActivityPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { LogsPage } from './pages/logs/LogsPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { RecoveryPage } from './pages/recovery/RecoveryPage';
import { RegistrationSettingsPage } from './pages/settings/RegistrationSettingsPage';
import { StoriesPage } from './pages/stories/StoriesPage';
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
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/tiers" element={<TiersPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/stories" element={<StoriesPage />} />
              {/* The page used to be called Contact. */}
              <Route path="/contact" element={<Navigate to="/messages" replace />} />
              <Route path="/settings" element={<RegistrationSettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
