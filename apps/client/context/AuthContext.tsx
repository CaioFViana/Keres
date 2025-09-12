import { deleteItem, getItem, setItem } from '@/utils/storage'; // Import from our storage utility
import { router, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

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

const USER_ID_KEY = 'user_id';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const LAST_MODE_KEY = 'last_app_mode'; // Key to store last chosen mode

// Keres' fixed user ID for offline mode, as defined in the backend's AuthMiddleware
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New state for loading authentication status
  const segments = useSegments();

  // Effect to load authentication state from secure store on app start
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const lastMode = await getItem(LAST_MODE_KEY);

        if (lastMode === 'offline') {
          setUserId(OFFLINE_USER_ID);
          setIsAuthenticated(true);
          setIsOfflineMode(true);
        } else if (lastMode === 'online') {
          const storedUserId = await getItem(USER_ID_KEY);
          const storedAuthToken = await getItem(AUTH_TOKEN_KEY);
          const storedRefreshToken = await getItem(REFRESH_TOKEN_KEY);

          if (storedUserId && storedAuthToken && storedRefreshToken) {
            setUserId(storedUserId);
            setIsAuthenticated(true);
            setIsOfflineMode(false);
          }
        }
      } catch (error) {
        console.error('Failed to load auth data from secure store:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, []);

  // Effect for redirection based on authentication status
  useEffect(() => {
    if (isLoading) return; // Wait until authentication state is loaded

    const inAuthGroup = segments[0] === '(authenticated)';

    if (!isAuthenticated && inAuthGroup) {
      router.replace('/welcome');
    } else if (isAuthenticated && !inAuthGroup) {
      router.replace('/(authenticated)/dashboard');
    }
  }, [isAuthenticated, segments, isLoading]);

  const signIn = async (id: string, token: string, refreshToken: string) => {
    await setItem(USER_ID_KEY, id);
    await setItem(AUTH_TOKEN_KEY, token);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
    await setItem(LAST_MODE_KEY, 'online'); // Save last chosen mode

    setUserId(id);
    setIsAuthenticated(true);
    setIsOfflineMode(false);
  };

  const signInOffline = async (id: string) => {
    await setItem(USER_ID_KEY, id); // Store offline user ID
    await setItem(LAST_MODE_KEY, 'offline'); // Save last chosen mode
    await deleteItem(AUTH_TOKEN_KEY); // Clear online tokens if switching to offline
    await deleteItem(REFRESH_TOKEN_KEY);

    setUserId(id);
    setIsAuthenticated(true);
    setIsOfflineMode(true);
  };

  const signOut = async () => {
    await deleteItem(USER_ID_KEY);
    await deleteItem(AUTH_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(LAST_MODE_KEY);

    setUserId(null);
    setIsAuthenticated(false);
    setIsOfflineMode(false);
    router.replace('/welcome'); // Redirect to welcome after sign out
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, isOfflineMode, signIn, signInOffline, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
