import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { AxiosError, create as createAxios, isAxiosError } from 'axios';
import { Platform } from 'react-native';
import type { ServerSelect } from '../db/schema'; // Import ServerSelect
import { useConnectivityStore } from '../state/connectivityStore';
import { canRefreshSessionWithCookie } from './browserCookieSession';

export const NO_RESPONSE_ERROR = 'NO_RESPONSE';
export const TIMEOUT_ERROR = 'TIMEOUT';
export const API_PREFIX = '/api';

/** The persisted server address is always its origin; HTTP calls belong below `/api`. */
export function apiBaseUrl(serverUrl: string): string {
  const origin = serverUrl.replace(/\/+$/, '');
  return origin.endsWith(API_PREFIX) ? origin : `${origin}${API_PREFIX}`;
}

export function apiUrl(serverUrl: string, endpoint: string): string {
  return `${apiBaseUrl(serverUrl)}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

/**
 * True when a request failed because the server could not be reached at all
 * (offline, server down, DNS/timeout) rather than because it answered with an error.
 *
 * Being offline is the normal state of an offline-first app, not an exceptional one:
 * callers should use this to fail quietly (a plain log, no `console.error` - which
 * React Native surfaces as a full-screen LogBox error - and no user notification)
 * instead of treating it like a bug.
 */
export function isOfflineError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as AxiosError).code;
  return (
    code === NO_RESPONSE_ERROR ||
    code === TIMEOUT_ERROR ||
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED'
  );
}

// Define the structure for how the API client obtains and manages tokens
export interface TokenProvider {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getServerUrl(): string | null;
  refreshAccessToken(
    serverId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null>;
  clearAuth(serverId: string): void;
}

export interface KeresAxiosInstance extends AxiosInstance {
  setBaseUrl(url: string): void;
  setTokenProvider(provider: TokenProvider | null): void;
  setActiveServer(server: ServerSelect | null): void; // New method
}

/** Marca por requisição que impede o ciclo de renovação de token de reentrar para sempre - ver
 *  uso no interceptor de resposta. */
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

// There is only ever one token refresh strategy for the whole app, so this can
// safely stay a single shared instance (it's stateless - it takes a serverId
// per call rather than holding "current" state).
let tokenProvider: TokenProvider | null = null;

// Single source of truth for credentials, keyed by serverId. This is what makes it
// safe to have many concurrent Axios instances (SyncEngineService's client, ad-hoc
// tempClients, refresh clients, the shared default apiClient) all interacting with
// different servers at the same time: a token refresh for server A can never leak
// into a request meant for server B, because each instance only ever looks up the
// token for the serverId it was explicitly configured with (see applyInterceptors).
const serverTokenCache = new Map<
  string,
  { jwtToken: string | null; refreshToken: string | null }
>();

export function updateServerTokenCache(
  serverId: string,
  jwtToken: string | null,
  refreshToken: string | null,
): void {
  serverTokenCache.set(serverId, { jwtToken, refreshToken });
}

export function clearServerTokenCache(serverId: string): void {
  serverTokenCache.delete(serverId);
}

/**
 * Token de acesso de um servidor, para quem precisa autenticar fora do Axios.
 *
 * O interceptor de request resolve o cabeçalho sozinho e essa é a via normal. Downloads de
 * mídia, porém, vão direto para o disco pelo `expo-file-system` - trazer um vídeo para a
 * memória do JS só para o Axios repassá-lo estouraria o heap -, e por não passarem pelo
 * interceptor precisam montar o `Authorization` à mão.
 */
export function getServerAccessToken(serverId: string): string | null {
  return serverTokenCache.get(serverId)?.jwtToken || null;
}

interface RefreshState {
  isRefreshing: boolean;
  failedQueue: {
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
    config: InternalAxiosRequestConfig;
  }[];
}

// Refresh-in-flight state, keyed by serverId. Keeps the "only one refresh at a time"
// guarantee scoped to a single server instead of blocking/mixing refreshes across
// unrelated servers.
const refreshStateByServerId = new Map<string, RefreshState>();

/** Clears credentials and rejects refresh requests that belong to an app reset. */
export function clearAllServerAuthState(serverIds: string[]): void {
  for (const serverId of serverIds) {
    serverTokenCache.delete(serverId);
    const refreshState = refreshStateByServerId.get(serverId);
    if (refreshState) {
      processQueue(
        refreshState,
        new AxiosError('Authentication cleared by application reset.', 'AUTH_RESET'),
      );
      refreshStateByServerId.delete(serverId);
    }
  }
}

function getRefreshState(serverId: string): RefreshState {
  let state = refreshStateByServerId.get(serverId);
  if (!state) {
    state = { isRefreshing: false, failedQueue: [] };
    refreshStateByServerId.set(serverId, state);
  }
  return state;
}

function processQueue(state: RefreshState, error: AxiosError | null, token: string | null = null) {
  state.failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  state.failedQueue = [];
}

// Function to apply interceptors to an Axios instance. Each instance gets its own
// `currentServerId` closure so it always knows which server it is acting on behalf
// of, independent of what any other instance is doing concurrently.
function applyInterceptors(instance: KeresAxiosInstance): void {
  let currentServer: ServerSelect | null = null;

  instance.setActiveServer = (server: ServerSelect | null) => {
    currentServer = server;
  };

  /**
   * Whether this request actually went to the server this instance is bound to.
   * Callers may pass an absolute URL aimed somewhere else entirely (the server
   * registration screen probes arbitrary addresses through the shared client), and
   * reporting those results would mark an unrelated server as up or down.
   */
  const targetsBoundServer = (config?: { url?: string; baseURL?: string }): boolean => {
    if (!currentServer?.url || !config) {
      return false;
    }
    const url = config.url || '';
    if (/^https?:\/\//i.test(url)) {
      return url.startsWith(currentServer.url);
    }
    return (config.baseURL || '').startsWith(currentServer.url);
  };

  // Request interceptor to add any necessary headers (e.g., auth tokens)
  instance.interceptors.request.use(
    (config) => {
      const accessToken =
        (currentServer && serverTokenCache.get(currentServer.id)?.jwtToken) || null;
      if (
        accessToken &&
        !config.headers.Authorization &&
        !config.url?.includes('/auth/login') &&
        !config.url?.includes('/auth/refresh')
      ) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor for centralized error handling and token refresh
  instance.interceptors.response.use(
    (response) => {
      // Any answer at all - even an error status - proves the server is reachable.
      if (currentServer && targetsBoundServer(response.config)) {
        useConnectivityStore.getState().reportReachable(currentServer.id, currentServer.name);
      }
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config;

      if (currentServer && targetsBoundServer(originalRequest)) {
        if (isOfflineError(error) || (!error.response && error.request)) {
          useConnectivityStore.getState().reportUnreachable(currentServer.id, currentServer.name);
        } else if (error.response) {
          useConnectivityStore.getState().reportReachable(currentServer.id, currentServer.name);
        }
      }

      if (error.response?.status === 401 && tokenProvider && originalRequest && currentServer) {
        const retriableRequest = originalRequest as RetriableRequestConfig;
        // If it's a 401 and not a refresh token request itself
        if (
          !retriableRequest.url?.includes('/auth/refresh') &&
          !retriableRequest._retriedAfterRefresh
        ) {
          // Um 401 depois de já termos renovado o token e reenviado esta mesma requisição não é
          // token expirado - é o servidor recusando o próprio conteúdo da requisição (ex.: senha
          // atual errada em PUT /user/password ou /user/recovery-codes). Sem esta marca, cada
          // reenvio gera outro 401, que dispara outra renovação (o refresh token continua válido)
          // e reenvia de novo - um loop infinito em vez de deixar o erro chegar até quem chamou.
          retriableRequest._retriedAfterRefresh = true;
          const serverId = currentServer.id;
          const refreshState = getRefreshState(serverId);

          if (refreshState.isRefreshing) {
            // If token is already refreshing for this server, add to queue
            return new Promise((resolve, reject) => {
              refreshState.failedQueue.push({ resolve, reject, config: originalRequest });
            })
              .then(() => instance(originalRequest))
              .catch((err) => Promise.reject(err));
          }

          refreshState.isRefreshing = true;

          const refreshToken = serverTokenCache.get(serverId)?.refreshToken || null;

          if (!refreshToken && !canRefreshSessionWithCookie(currentServer.url)) {
            console.log('No refresh token available for token refresh. Clearing auth.');
            refreshState.isRefreshing = false;
            tokenProvider.clearAuth(serverId);
            processQueue(
              refreshState,
              new AxiosError(
                'Token refresh failed: No refresh token available.',
                'TOKEN_REFRESH_FAILED',
                originalRequest,
              ),
            );
            return Promise.reject(
              new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest),
            );
          }

          try {
            const refreshResult = await tokenProvider.refreshAccessToken(
              serverId,
              refreshToken ?? '',
            );

            if (refreshResult) {
              const newAccessToken = refreshResult.accessToken;
              // Update the original request with the new access token
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

              // Update the shared cache so every instance configured for this server sees the new token
              updateServerTokenCache(serverId, newAccessToken, refreshResult.refreshToken);

              processQueue(refreshState, null, newAccessToken); // Resolve all queued requests
              return instance(originalRequest); // Retry the original request
            } else {
              console.log('Token refresh failed: refreshAccessToken returned null.');
              tokenProvider.clearAuth(serverId);
              processQueue(
                refreshState,
                new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest),
              );
              return Promise.reject(
                new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest),
              );
            }
          } catch (refreshError: any) {
            console.log('Error refreshing token:', refreshError);
            tokenProvider.clearAuth(serverId);
            processQueue(
              refreshState,
              new AxiosError(
                'Token refresh failed',
                'TOKEN_REFRESH_FAILED',
                originalRequest,
                refreshError.response,
              ),
            );
            return Promise.reject(
              new AxiosError(
                'Token refresh failed',
                'TOKEN_REFRESH_FAILED',
                originalRequest,
                refreshError.response,
              ),
            );
          } finally {
            refreshState.isRefreshing = false;
          }
        }
      }

      // Standard error handling
      if (isAxiosError(error)) {
        const requestLabel = `${originalRequest?.method?.toUpperCase() || 'GET'} ${originalRequest?.url || 'unknown'}`;

        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
          // Expected while offline - keep it to a one-liner (never log the raw XHR object).
          console.log(`API timeout: ${requestLabel}`);
          return Promise.reject(
            new AxiosError(
              'Request timed out. Please check your internet connection or server availability.',
              TIMEOUT_ERROR,
              originalRequest,
              error.request,
              error.response,
            ),
          );
        } else if (error.response) {
          console.log('API Response Error:', error.response.status, error.response.data);
          // O `onError` global da API (apps/api/src/index.ts) sempre escolhe uma mensagem
          // seguro para o usuário antes de responder - descartá-la e usar um texto genérico
          // fixo escondia coisas como "Story limit reached for your plan" atrás de "An
          // unexpected error occurred", que não ajuda ninguém a entender o que aconteceu.
          const serverMessage = (error.response.data as { message?: string } | undefined)?.message;
          const errorMessage = serverMessage || 'An unexpected error occurred.';
          return Promise.reject(
            new AxiosError(
              `Server Error: ${error.response.status} - ${errorMessage}`,
              `SERVER_ERROR_${error.response.status}`,
              originalRequest,
              error.request,
              error.response,
            ),
          );
        } else if (error.request) {
          // Server unreachable. This is the normal offline path, not an exceptional
          // condition, so log a short line rather than dumping the whole XHR object.
          console.log(`API unreachable: ${requestLabel}`);
          return Promise.reject(
            new AxiosError(
              'No response received from the server. Please check your network connection.',
              NO_RESPONSE_ERROR,
              originalRequest,
              error.request,
              error.response,
            ),
          );
        } else {
          console.log('API Request Setup Error:', error.message);
          return Promise.reject(
            new AxiosError(
              `Request setup error: ${error.message}`,
              'REQUEST_SETUP_ERROR',
              originalRequest,
              error.request,
              error.response,
            ),
          );
        }
      }
      return Promise.reject(error);
    },
  );
}

// Global API client instance
const apiClient: KeresAxiosInstance = createAxios() as KeresAxiosInstance;
applyInterceptors(apiClient); // Apply interceptors (and setActiveServer) to the global instance

// Method to dynamically set the base URL for the global instance
apiClient.setBaseUrl = (url: string) => {
  apiClient.defaults.baseURL = apiBaseUrl(url);
  if (Platform.OS === 'web') {
    console.log(`API Client Base URL set to: ${url}`);
  }
};

apiClient.setTokenProvider = (provider: TokenProvider | null) => {
  tokenProvider = provider;
};

// Function to create a new Axios instance with interceptors
export function createKeresAxiosInstance(config?: AxiosRequestConfig): KeresAxiosInstance {
  const instance = createAxios({
    ...config,
    baseURL: config?.baseURL ? apiBaseUrl(config.baseURL) : config?.baseURL,
  }) as KeresAxiosInstance;
  applyInterceptors(instance); // Also sets instance.setActiveServer, scoped to this instance
  instance.setBaseUrl = (url: string) => {
    instance.defaults.baseURL = apiBaseUrl(url);
  };
  instance.setTokenProvider = (provider: TokenProvider | null) => {
    tokenProvider = provider;
  };
  return instance;
}

// Function to create a new Axios instance WITHOUT interceptors
export function createPlainAxiosInstance(config?: AxiosRequestConfig): AxiosInstance {
  return createAxios(config);
}

export default apiClient;
