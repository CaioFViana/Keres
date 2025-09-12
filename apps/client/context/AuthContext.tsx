import React, { createContext, useContext, useState, useEffect } from 'react';
import { router, useSegments } from 'expo-router';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isOfflineMode: boolean;
  signIn: (userId: string, token: string, refreshToken: string) => void;
  signInOffline: (userId: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const segments = useSegments();

  // This effect runs once on mount and whenever authentication state changes
  useEffect(() => {
    const inAuthGroup = segments[0] === '(authenticated)';

    if (!isAuthenticated && inAuthGroup) {
      // Redirect to welcome screen if not authenticated and trying to access protected routes
      router.replace('/welcome');
    } else if (isAuthenticated && !inAuthGroup) {
      // Redirect to dashboard if authenticated and trying to access public routes (like login/welcome)
      router.replace('/(authenticated)/dashboard');
    }
  }, [isAuthenticated, segments]);

  const signIn = (id: string, token: string, refreshToken: string) => {
    // TODO: Store token and refresh token securely (e.g., using expo-secure-store)
    setUserId(id);
    setIsAuthenticated(true);
    setIsOfflineMode(false);
  };

  const signInOffline = (id: string) => {
    setUserId(id);
    setIsAuthenticated(true);
    setIsOfflineMode(true);
  };

  const signOut = () => {
    // TODO: Clear stored tokens
    setUserId(null);
    setIsAuthenticated(false);
    setIsOfflineMode(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, isOfflineMode, signIn, signInOffline, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
