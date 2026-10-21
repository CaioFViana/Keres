import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAdmin() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <p className="loading-text">Loading...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
