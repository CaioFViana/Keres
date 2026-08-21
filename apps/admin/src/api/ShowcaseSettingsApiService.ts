import { apiClient } from './apiClient';

export interface ShowcaseSettings {
  id: string;
  isShowcaseEnabled: boolean;
  updatedAt: string;
}

export const ShowcaseSettingsApiService = {
  async get(): Promise<ShowcaseSettings> {
    const { data } = await apiClient.get('/admin/api/showcase-settings');
    return data;
  },
  async update(patch: { isShowcaseEnabled: boolean }): Promise<ShowcaseSettings> {
    const { data } = await apiClient.put('/admin/api/showcase-settings', patch);
    return data;
  },
};
