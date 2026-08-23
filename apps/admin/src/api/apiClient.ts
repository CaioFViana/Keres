import axios from 'axios';

const TOKEN_KEY = 'keres_admin_access_token';
const USERNAME_KEY = 'keres_admin_username';

/** Dispatched when a 401 clears the local session so AuthProvider can update React state. */
export const SESSION_CLEARED_EVENT = 'keres-admin-session-cleared';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setStoredUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearStoredUsername(): void {
  localStorage.removeItem(USERNAME_KEY);
}

export function clearLocalSession(): void {
  clearToken();
  clearStoredUsername();
}

/**
 * Rejects path segments that axios could treat as absolute URLs (credential leak) or
 * path traversal. Admin IDs are ULIDs; entity type names are alphanumeric.
 */
export function assertSafePathSegment(value: string, label = 'id'): string {
  if (
    !value ||
    /[:/\\?#]/.test(value) ||
    value.includes('..') ||
    /^https?/i.test(value) ||
    value.includes('://')
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function notifySessionCleared(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}

/**
 * Cliente próprio, deliberadamente não compartilhado com o `apiClient` do apps/client -
 * aquele é acoplado a React Native/AsyncStorage e a um modelo de múltiplos servidores que
 * não se aplica aqui. Este painel é uma ferramenta interna simples: um token, localStorage.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  // Prevent absolute request URLs from bypassing baseURL and leaking the Bearer token.
  allowAbsoluteUrls: false,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearLocalSession();
      notifySessionCleared();
    }
    const message = error.response?.data?.message || error.message || 'Unexpected error.';
    return Promise.reject(new Error(message));
  },
);
