import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../src/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/apiClient')>();
  return { ...actual, apiClient: mocks };
});

import { ShowcaseSettingsApiService } from '../../src/api/ShowcaseSettingsApiService';

const settings = {
  id: 'singleton',
  isShowcaseEnabled: true,
  isHostedClientEnabled: true,
  siteName: 'Acme Stories',
  sitePalette: 'twilight',
  logoContentType: null,
  logoUpdatedAt: null,
  updatedAt: '2026-09-22T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of [mocks.get, mocks.post, mocks.put, mocks.delete]) {
    method.mockResolvedValue({ data: settings });
  }
});

describe('ShowcaseSettingsApiService branding', () => {
  it('reads the full settings including branding and logo fields', async () => {
    await expect(ShowcaseSettingsApiService.get()).resolves.toEqual(settings);
    expect(mocks.get).toHaveBeenCalledWith('/admin/showcase-settings');
  });

  it('updates the branding with PUT on the singleton resource', async () => {
    await ShowcaseSettingsApiService.update({ siteName: 'Acme', sitePalette: 'ocean' });

    expect(mocks.put).toHaveBeenCalledWith('/admin/showcase-settings', {
      siteName: 'Acme',
      sitePalette: 'ocean',
    });
  });

  it('uploads the logo as multipart with the file under the logo field', async () => {
    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });

    const result = await ShowcaseSettingsApiService.uploadLogo(file);

    expect(result).toEqual(settings);
    expect(mocks.post).toHaveBeenCalledOnce();
    const [url, form] = mocks.post.mock.calls[0];
    expect(url).toBe('/admin/showcase-settings/logo');
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get('logo')).toBe(file);
  });

  it('removes the logo through DELETE on the logo sub-resource', async () => {
    const result = await ShowcaseSettingsApiService.deleteLogo();

    expect(result).toEqual(settings);
    expect(mocks.delete).toHaveBeenCalledWith('/admin/showcase-settings/logo');
  });
});
