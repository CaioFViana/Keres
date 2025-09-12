interface RequestOptions extends RequestInit {
  baseUrl?: string;
}

export class ApiClient {
  private defaultBaseUrl: string | null = null;

  setDefaultBaseUrl(url: string) {
    this.defaultBaseUrl = url;
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

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Client Error Data:', errorData);
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}
