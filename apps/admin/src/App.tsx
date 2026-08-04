import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RequireAdmin } from './auth/RequireAdmin';
import { Layout } from './components/Layout';
import { RecoveryPage } from './pages/recovery/RecoveryPage';
import { RegistrationSettingsPage } from './pages/settings/RegistrationSettingsPage';
import { TiersPage } from './pages/tiers/TiersPage';
import { UserFormPage } from './pages/users/UserFormPage';
import { UsersListPage } from './pages/users/UsersListPage';

// Caminhos relativos ao `basename="/admin"` definido em main.tsx (que por sua vez casa
// com o `base: '/admin/'` do vite.config.ts) - nenhuma rota aqui repete o prefixo /admin.
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<Layout />}>
            <Route path="/users" element={<UsersListPage />} />
            <Route path="/users/new" element={<UserFormPage />} />
            <Route path="/users/:id" element={<UserFormPage />} />
            <Route path="/recovery" element={<RecoveryPage />} />
            <Route path="/tiers" element={<TiersPage />} />
            <Route path="/settings" element={<RegistrationSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/users" replace />} />
      </Routes>
    </AuthProvider>
  );
}
