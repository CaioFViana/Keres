interface RequestOptions extends RequestInit {
  baseUrl?: string;
  retryCount?: number; // Added for retry mechanism
}

export class ApiClient {
  private defaultBaseUrl: string | null = null;
  private onTokenRefresh: (() => Promise<string>) | null = null; // Callback for token refresh
  private onSignOut: (() => void) | null = null; // Callback for sign out

  setDefaultBaseUrl(url: string) {
    this.defaultBaseUrl = url;
  }

  setOnTokenRefresh(callback: () => Promise<string>) {
    this.onTokenRefresh = callback;
  }

  setOnSignOut(callback: () => void) {
    this.onSignOut = callback;
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
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, or empty, errorData remains empty object
        console.warn('API Client: Could not parse error response as JSON:', e);
      }
      const errorMessage = errorData.error || `API request failed with status ${response.status}`;

      // Check for unauthorized and attempt token refresh
      if (response.status === 401 && this.onTokenRefresh && (options?.retryCount || 0) < 1) {
        console.log('API Client: 401 Unauthorized. Attempting token refresh...');
        try {
          const newAccessToken = await this.onTokenRefresh();
          console.log('API Client: Token refreshed. Retrying request...');
          // Retry the original request with the new token
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          // Recursively call request with updated headers and incremented retryCount
          return this.request<T>(endpoint, { ...options, headers: retryHeaders, retryCount: (options?.retryCount || 0) + 1 });
        } catch (refreshError) {
          console.error('API Client: Token refresh failed:', refreshError);
          if (this.onSignOut) {
            this.onSignOut();
          }
          throw new Error(errorMessage);
        }
      }

      console.error('API Client Error Data:', errorData);
      throw new Error(errorMessage);
    }

    // For successful responses, check if there's content to parse as JSON
    const contentType = response.headers.get('content-type');
    if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
      return {} as T; // Return an empty object or null for no-content responses
    }

    return response.json() as Promise<T>;
  }
}
