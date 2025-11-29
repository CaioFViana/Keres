import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

// Flag to prevent multiple refresh token requests at once
let isRefreshing = false;
// Array of requests that need to be retried once the token is refreshed
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; config: InternalAxiosRequestConfig }[] = [];

// Define the structure for how the API client obtains and manages tokens
export interface TokenProvider {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getServerUrl(): string | null;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null>;
  clearAuth(): void;
}

interface KeresAxiosInstance extends AxiosInstance {
  setBaseUrl(url: string): void;
  setTokenProvider(provider: TokenProvider | null): void;
}

let tokenProvider: TokenProvider | null = null;

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Function to apply interceptors to an Axios instance
function applyInterceptors(instance: AxiosInstance): void {
  // Request interceptor to add any necessary headers (e.g., auth tokens)
  instance.interceptors.request.use(
    (config) => {
      if (tokenProvider) {
        const accessToken = tokenProvider.getAccessToken();
        // Only add Authorization header if accessToken exists and it's not a login/refresh request
        // The check for `config.url?.includes('/auth/login')` etc. is to prevent sending a stale or new token
        // to endpoints that handle token issuance or refresh, which should typically be unauthenticated or
        // use a refresh token in the body, not Authorization header.
        if (accessToken && !config.headers.Authorization && 
            !config.url?.includes('/auth/login') && 
            !config.url?.includes('/auth/refresh')) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for centralized error handling and token refresh
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && tokenProvider && originalRequest) {
        // If it's a 401 and not a refresh token request itself
        if (!originalRequest.url?.includes('/auth/refresh')) {
          if (isRefreshing) {
            // If token is already refreshing, add to queue
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject, config: originalRequest });
            })
              .then(() => instance(originalRequest))
              .catch(err => Promise.reject(err));
          }

          isRefreshing = true;

          const refreshToken = tokenProvider.getRefreshToken();
          const serverUrl = tokenProvider.getServerUrl();

          if (!refreshToken || !serverUrl) {
            console.log('No refresh token or server URL available for token refresh. Clearing auth.');
            tokenProvider.clearAuth();
            processQueue(new AxiosError('Token refresh failed: No refresh token or server URL available.', 'TOKEN_REFRESH_FAILED', originalRequest));
            return Promise.reject(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest));
          }

          try {
            // Create a temporary axios instance without interceptors to prevent recursion
            // and avoid attaching a stale or new access token to the refresh request itself.
            const refreshInstance = axios.create();
            const refreshResponse = await refreshInstance.post<{ accessToken: string; refreshToken: string }>(
              `${serverUrl}/auth/refresh`,
              { refreshToken: refreshToken }
            );

            const newAccessToken = refreshResponse.data.accessToken;
            const newRefreshToken = refreshResponse.data.refreshToken;

            // Update tokens in the provider
            // This assumes the provider has a mechanism to update its stored tokens
            if (tokenProvider && 'updateTokens' in tokenProvider && typeof (tokenProvider as any).updateTokens === 'function') {
                (tokenProvider as any).updateTokens(newAccessToken, newRefreshToken);
            } else {
                console.log('TokenProvider does not have an updateTokens method. Tokens might not be persisted.');
            }

            // Update the original request with the new access token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            processQueue(null, newAccessToken); // Resolve all queued requests
            return instance(originalRequest); // Retry the original request
          } catch (refreshError: any) {
            console.log('Error refreshing token:', refreshError);
            tokenProvider.clearAuth();
            processQueue(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest, refreshError.response));
            return Promise.reject(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest, refreshError.response));
          } finally {
            isRefreshing = false;
          }
        }
      }

      // Standard error handling
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
          console.log('API Call Timeout:', error.message);
          return Promise.reject(new AxiosError('Request timed out. Please check your internet connection or server availability.', 'TIMEOUT', originalRequest, error.response));
        } else if (error.response) {
          console.log('API Response Error:', error.response.status, error.response.data);
          const errorMessage = 'An unexpected error occurred.';
          return Promise.reject(new AxiosError(`Server Error: ${error.response.status} - ${errorMessage}`, `SERVER_ERROR_${error.response.status}`, originalRequest, error.response));
        } else if (error.request) {
          console.log('API No Response Error:', error.request);
          return Promise.reject(new AxiosError('No response received from the server. Please check your network connection.', 'NO_RESPONSE', originalRequest, error.response));
        } else {
          console.log('API Request Setup Error:', error.message);
          return Promise.reject(new AxiosError(`Request setup error: ${error.message}`, 'REQUEST_SETUP_ERROR', originalRequest, error.response));
        }
      }
      return Promise.reject(error);
    }
  );
}

// Global API client instance
const apiClient: KeresAxiosInstance = axios.create() as KeresAxiosInstance;
applyInterceptors(apiClient); // Apply interceptors to the global instance

// Method to dynamically set the base URL for the global instance
apiClient.setBaseUrl = (url: string) => {
  apiClient.defaults.baseURL = url;
  if (Platform.OS === 'web') {
    console.log(`API Client Base URL set to: ${url}`);
  }
};

apiClient.setTokenProvider = (provider: TokenProvider | null) => {
  tokenProvider = provider;
};

// Function to create a new Axios instance with interceptors
export function createKeresAxiosInstance(config?: AxiosRequestConfig): AxiosInstance {
  const instance = axios.create(config);
  applyInterceptors(instance);
  return instance;
}

export default apiClient;
