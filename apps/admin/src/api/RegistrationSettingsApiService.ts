import type { RegistrationSettings, UpdateRegistrationSettings } from '@keres/shared';
import { apiClient } from './apiClient';

export const RegistrationSettingsApiService = {
  async get(): Promise<RegistrationSettings> {
    const { data } = await apiClient.get('/admin/api/registration-settings');
    return data;
  },
  async update(patch: UpdateRegistrationSettings): Promise<RegistrationSettings> {
    const { data } = await apiClient.put('/admin/api/registration-settings', patch);
    return data;
  },
};
