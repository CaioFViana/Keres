import axios from 'axios';

const TOKEN_KEY = 'keres_admin_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Cliente próprio, deliberadamente não compartilhado com o `apiClient` do apps/client -
 * aquele é acoplado a React Native/AsyncStorage e a um modelo de múltiplos servidores que
 * não se aplica aqui. Este painel é uma ferramenta interna simples: um token, localStorage.
 */
export const apiClient = axios.create({
  baseURL: '/',
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
      clearToken();
    }
    const message = error.response?.data?.message || error.message || 'Unexpected error.';
    return Promise.reject(new Error(message));
  },
);
