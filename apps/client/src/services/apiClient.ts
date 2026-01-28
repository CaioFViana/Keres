import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { ServerSelect } from '../db/schema'; // Import ServerSelect

// Flag to prevent multiple refresh token requests at once
let isRefreshing = false;
// Array of requests that need to be retried once the token is refreshed
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; config: InternalAxiosRequestConfig }[] = [];

// Define the structure for how the API client obtains and manages tokens
export interface TokenProvider {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getServerUrl(): string | null;
  refreshAccessToken(serverId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null>;
  clearAuth(): void;
}

interface KeresAxiosInstance extends AxiosInstance {
  setBaseUrl(url: string): void;
  setTokenProvider(provider: TokenProvider | null): void;
  setActiveServer(server: ServerSelect | null): void; // New method
}

let tokenProvider: TokenProvider | null = null;
let currentActiveServer: ServerSelect | null = null; // New state variable

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
      // Use currentActiveServer's token if available
      const accessToken = currentActiveServer?.jwtToken || null;
      if (accessToken && !config.headers.Authorization &&
          !config.url?.includes('/auth/login') &&
          !config.url?.includes('/auth/refresh')) {
        config.headers.Authorization = `Bearer ${accessToken}`;
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

          const refreshToken = currentActiveServer?.refreshToken || null; // Use refreshToken from currentActiveServer
          const serverId = currentActiveServer?.id || null;

          if (!refreshToken || !serverId || !tokenProvider) { // Check tokenProvider exists
            console.log('No refresh token, active server ID, or token provider available for token refresh. Clearing auth.');
            if (tokenProvider) tokenProvider.clearAuth(); // Clear auth only if provider exists
            processQueue(new AxiosError('Token refresh failed: No refresh token or server ID available.', 'TOKEN_REFRESH_FAILED', originalRequest));
            return Promise.reject(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest));
          }

          try {
            const refreshResult = await tokenProvider.refreshAccessToken(serverId, refreshToken);

            if (refreshResult) {
                const newAccessToken = refreshResult.accessToken;
                // Update the original request with the new access token
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                // Update currentActiveServer's token
                if (currentActiveServer) {
                    currentActiveServer = {
                        ...currentActiveServer,
                        jwtToken: newAccessToken,
                        refreshToken: refreshResult.refreshToken,
                    };
                }

                processQueue(null, newAccessToken); // Resolve all queued requests
                return instance(originalRequest); // Retry the original request
            } else {
                console.log('Token refresh failed: refreshAccessToken returned null.');
                if (tokenProvider) tokenProvider.clearAuth();
                processQueue(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest));
                return Promise.reject(new AxiosError('Token refresh failed', 'TOKEN_REFRESH_FAILED', originalRequest));
            }
          } catch (refreshError: any) {
            console.log('Error refreshing token:', refreshError);
            if (tokenProvider) tokenProvider.clearAuth();
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

// New method to set the currently active server context for the API client
apiClient.setActiveServer = (server: ServerSelect | null) => {
    currentActiveServer = server;
};

// Function to create a new Axios instance with interceptors
export function createKeresAxiosInstance(config?: AxiosRequestConfig): KeresAxiosInstance {
  const instance = axios.create(config) as KeresAxiosInstance;
  applyInterceptors(instance);
  // Also add the custom methods to this new instance
  instance.setBaseUrl = (url: string) => { instance.defaults.baseURL = url; };
  instance.setTokenProvider = (provider: TokenProvider | null) => { tokenProvider = provider; };
  instance.setActiveServer = (server: ServerSelect | null) => { currentActiveServer = server; };
  return instance;
}

// Function to create a new Axios instance WITHOUT interceptors
export function createPlainAxiosInstance(config?: AxiosRequestConfig): AxiosInstance {
  return axios.create(config);
}

export default apiClient;