import { apiClient } from './apiClient';

/** Mirrors the API's `showcase_settings` row; `logo*` is null until a logo is uploaded. */
export interface ShowcaseSettings {
  id: string;
  isShowcaseEnabled: boolean;
  isHostedClientEnabled: boolean;
  siteName: string;
  sitePalette: string;
  logoContentType: string | null;
  logoUpdatedAt: string | null;
  updatedAt: string;
}

export interface ShowcaseSettingsPatch {
  isShowcaseEnabled?: boolean;
  isHostedClientEnabled?: boolean;
  siteName?: string;
  sitePalette?: string;
}

export const ShowcaseSettingsApiService = {
  async get(): Promise<ShowcaseSettings> {
    const { data } = await apiClient.get('/admin/showcase-settings');
    return data;
  },
  async update(patch: ShowcaseSettingsPatch): Promise<ShowcaseSettings> {
    const { data } = await apiClient.put('/admin/showcase-settings', patch);
    return data;
  },
  /** Replaces the public site logo; the field name is what the API's multipart schema expects. */
  async uploadLogo(file: File): Promise<ShowcaseSettings> {
    const form = new FormData();
    form.append('logo', file);
    const { data } = await apiClient.post('/admin/showcase-settings/logo', form);
    return data;
  },
  async deleteLogo(): Promise<ShowcaseSettings> {
    const { data } = await apiClient.delete('/admin/showcase-settings/logo');
    return data;
  },
};
