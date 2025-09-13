import { IAuthRepository, AuthTokens } from './IAuthRepository';
import { ApiClient } from '../api/ApiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfileResponse } from '@keres/shared'; // Added this import

const BASE_URL_KEY = 'last_base_url';

export class ApiAuthRepository implements IAuthRepository {
  constructor(private apiClient: ApiClient) {}

  async login(username: string, password: string, baseUrl: string): Promise<AuthTokens> {
    this.apiClient.setDefaultBaseUrl(baseUrl);
    await AsyncStorage.setItem(BASE_URL_KEY, baseUrl);

    const apiResponse = await this.apiClient.request<UserProfileResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    return {
      userId: apiResponse.id,
      token: apiResponse.token || '',
      refreshToken: apiResponse.refreshToken || '',
    };
  }

  static async getLastBaseUrl(): Promise<string | null> {
    return AsyncStorage.getItem(BASE_URL_KEY);
  }

  static async saveBaseUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(BASE_URL_KEY, url);
  }
}
