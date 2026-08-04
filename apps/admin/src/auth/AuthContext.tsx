import { createContext, ReactNode, useContext, useState } from 'react';
import { clearToken, getToken } from '../api/apiClient';
import { login as doLogin } from '../api/AdminAuthService';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());

  const login = async (u: string, p: string) => {
    const result = await doLogin(u, p);
    setUsername(result.username);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearToken();
    setUsername(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
