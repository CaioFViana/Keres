import { apiClient } from './apiClient';

export interface ShowcaseSettings {
  id: string;
  isShowcaseEnabled: boolean;
  isHostedClientEnabled: boolean;
  updatedAt: string;
}

export const ShowcaseSettingsApiService = {
  async get(): Promise<ShowcaseSettings> {
    const { data } = await apiClient.get('/admin/showcase-settings');
    return data;
  },
  async update(
    patch: Partial<Pick<ShowcaseSettings, 'isShowcaseEnabled' | 'isHostedClientEnabled'>>,
  ): Promise<ShowcaseSettings> {
    const { data } = await apiClient.put('/admin/showcase-settings', patch);
    return data;
  },
};
