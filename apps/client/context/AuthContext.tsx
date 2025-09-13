import { deleteItem, getItem, setItem } from '@/utils/storage'; // Import from our storage utility
import { router, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ApiClient } from '../src/infrastructure/api/ApiClient'; // Added this import

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isOfflineMode: boolean;
  token: string | null;
  refreshToken: string | null; // Added
  apiClient: ApiClient | null;
  signIn: (userId: string, token: string, refreshToken: string, baseUrl: string) => void;
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
const BASE_URL_KEY = 'base_url'; // Key to store the base URL

// Keres' fixed user ID for offline mode, as defined in the backend's AuthMiddleware
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New state for loading authentication status
  const [token, setToken] = useState<string | null>(null); // Added
  const [refreshToken, setRefreshToken] = useState<string | null>(null); // Added
  const [apiClient, setApiClient] = useState<ApiClient | null>(null); // Added
  const segments = useSegments();

  const signOut = useCallback(async () => {
    await deleteItem(USER_ID_KEY);
    await deleteItem(AUTH_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(LAST_MODE_KEY);
    await deleteItem(BASE_URL_KEY); // Clear baseUrl

    setUserId(null);
    setToken(null); // Clear token
    setRefreshToken(null); // Clear refreshToken
    setApiClient(null); // Clear apiClient
    setIsAuthenticated(false);
    setIsOfflineMode(false);
    router.replace('/'); // Redirect to welcome after sign out
  }, [setUserId, setToken, setRefreshToken, setApiClient, setIsAuthenticated, setIsOfflineMode]);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (!refreshToken || !userId) {
      throw new Error('No refresh token or user ID available.');
    }

    const currentBaseUrl = await getItem(BASE_URL_KEY);
    if (!currentBaseUrl) {
      throw new Error('Base URL not found for refreshing token.');
    }

    try {
      const refreshClient = new ApiClient();
      refreshClient.setDefaultBaseUrl(currentBaseUrl);

      const response = await refreshClient.request<{ token: string }>(
        '/users/refresh-token',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }
      );

      const newAccessToken = response.token;
      // Assuming the refresh token endpoint also returns a new refresh token if it rotates
      // For now, we'll just update the access token.
      await setItem(AUTH_TOKEN_KEY, newAccessToken);
      setToken(newAccessToken);
      return newAccessToken;
    } catch (error: any) {
      console.error('Failed to refresh access token:', error);
      // If refresh token fails, sign out the user
      signOut();
      throw error;
    }
  }, [refreshToken, userId, setToken, signOut]);

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
          const storedBaseUrl = await getItem(BASE_URL_KEY); // Retrieve baseUrl

          // Treat the string "undefined" as null
          const effectiveBaseUrl = storedBaseUrl === 'undefined' ? null : storedBaseUrl;

          if (storedUserId && storedAuthToken && storedRefreshToken && effectiveBaseUrl) {
            setUserId(storedUserId);
            setIsAuthenticated(true);
            setIsOfflineMode(false);
            setToken(storedAuthToken);
            setRefreshToken(storedRefreshToken); // Set refreshToken on load

            const client = new ApiClient();
            client.setDefaultBaseUrl(effectiveBaseUrl);
            client.setOnTokenRefresh(refreshAccessToken); // Set the refresh token callback
            setApiClient(client);
          }
        }
      } catch (error) {
        console.error('Failed to load auth data from secure store:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, [refreshAccessToken]); // Added refreshAccessToken to dependencies

  // Effect for redirection based on authentication status
  useEffect(() => {
    if (isLoading) return; // Wait until authentication state is loaded

    const inAuthGroup = segments[0] === '(authenticated)';

    if (!isAuthenticated && inAuthGroup) {
      router.replace('/');
    } else if (isAuthenticated && !inAuthGroup) {
      router.replace('/(authenticated)/dashboard');
    }
  }, [isAuthenticated, segments, isLoading]);

  const signIn = async (id: string, token: string, refreshToken: string, baseUrl: string) => {
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      throw new Error('Invalid base URL provided during sign in.');
    }

    await setItem(USER_ID_KEY, id);
    await setItem(AUTH_TOKEN_KEY, token);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
    await setItem(LAST_MODE_KEY, 'online'); // Save last chosen mode
    await setItem(BASE_URL_KEY, baseUrl); // Store baseUrl

    setUserId(id);
    setToken(token);
    setRefreshToken(refreshToken); // Set refreshToken
    setIsAuthenticated(true);
    setIsOfflineMode(false);

    const client = new ApiClient();
    client.setDefaultBaseUrl(baseUrl);
    client.setOnTokenRefresh(refreshAccessToken); // Set the refresh token callback
    setApiClient(client);
  };

  const signInOffline = async (id: string) => {
    await setItem(USER_ID_KEY, id); // Store offline user ID
    await setItem(LAST_MODE_KEY, 'offline'); // Save last chosen mode
    await deleteItem(AUTH_TOKEN_KEY); // Clear online tokens if switching to offline
    await deleteItem(REFRESH_TOKEN_KEY);

    setUserId(id);
    setIsAuthenticated(true);
    setIsOfflineMode(true);
    setToken(null); // Clear token
    setRefreshToken(null); // Clear refreshToken
    setApiClient(null); // Clear apiClient
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, isOfflineMode, token, refreshToken, apiClient, signIn, signInOffline, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
