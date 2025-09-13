interface RequestOptions extends RequestInit {
  baseUrl?: string;
  retryCount?: number; // Added for retry mechanism
}

export class ApiClient {
  private defaultBaseUrl: string | null = null;
  private onTokenRefresh: (() => Promise<string>) | null = null; // Callback for token refresh

  setDefaultBaseUrl(url: string) {
    this.defaultBaseUrl = url;
  }

  setOnTokenRefresh(callback: () => Promise<string>) {
    this.onTokenRefresh = callback;
  }

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const baseUrl = options?.baseUrl || this.defaultBaseUrl;
    if (!baseUrl) {
      throw new Error('Base URL is not set. Please provide it in options or set a default.');
    }

    const url = `${baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    let response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error || `API request failed with status ${response.status}`;

      // Check for unauthorized and attempt token refresh
      if (response.status === 401 && errorMessage === 'Unauthorized: Invalid token' && this.onTokenRefresh && (options?.retryCount || 0) < 1) {
        try {
          const newAccessToken = await this.onTokenRefresh();
          // Retry the original request with the new token
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          // Recursively call request with updated headers and incremented retryCount
          return this.request<T>(endpoint, { ...options, headers: retryHeaders, retryCount: (options?.retryCount || 0) + 1 });
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, re-throw the original error to trigger sign out
          throw new Error(errorMessage);
        }
      }

      console.error('API Client Error Data:', errorData);
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }
}
