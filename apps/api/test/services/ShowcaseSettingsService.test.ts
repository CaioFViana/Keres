import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), returning: vi.fn(), eq: vi.fn() }));

// Chainable stubs for the drizzle calls the service makes; `set` captures its patch for assertions.
const captured = vi.hoisted(() => ({ patch: null as Record<string, unknown> | null }));

vi.mock('../../src/db', () => ({
  db: {
    query: { showcaseSettings: { findFirst: mocks.findFirst } },
    insert: () => ({
      values: () => ({ onConflictDoNothing: () => ({ returning: mocks.returning }) }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        captured.patch = patch;
        return { where: () => ({ returning: mocks.returning }) };
      },
    }),
  },
}));
vi.mock('../../src/db/schema', () => ({
  SHOWCASE_SETTINGS_SINGLETON_ID: 'singleton',
  showcaseSettings: { id: 'showcase_settings.id' },
}));
vi.mock('drizzle-orm', () => ({ eq: mocks.eq }));

import { ShowcaseSettingsService } from '../../src/services/ShowcaseSettingsService';

const existingRow = () => ({
  id: 'singleton',
  isShowcaseEnabled: false,
  isHostedClientEnabled: true,
  siteName: 'Keres',
  sitePalette: 'default',
  logoContentType: null,
  logoUpdatedAt: null,
  updatedAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  captured.patch = null;
  mocks.eq.mockReturnValue('singleton-condition');
  mocks.findFirst.mockResolvedValue(existingRow());
});

describe('ShowcaseSettingsService validation', () => {
  it('rejects an unknown palette with 400 before touching the database', async () => {
    const service = new ShowcaseSettingsService();

    await expect(service.update({ sitePalette: 'neon-lime' })).rejects.toMatchObject({
      status: 400,
      message: 'Unknown site palette "neon-lime".',
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects prototype member names as palettes', async () => {
    const service = new ShowcaseSettingsService();

    await expect(service.update({ sitePalette: 'constructor' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it.each(['default', 'ocean', 'seaOfStars'])('accepts the %s palette', async (sitePalette) => {
    const service = new ShowcaseSettingsService();
    mocks.returning.mockResolvedValue([{ ...existingRow(), sitePalette }]);

    const updated = await service.update({ sitePalette });

    expect(updated.sitePalette).toBe(sitePalette);
    expect(captured.patch).toMatchObject({ sitePalette });
  });

  it.each(['', '   ', 'x'.repeat(61)])('rejects site name %j with 400', async (siteName) => {
    const service = new ShowcaseSettingsService();

    await expect(service.update({ siteName })).rejects.toMatchObject({ status: 400 });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('trims the site name and accepts a 60-character one', async () => {
    const service = new ShowcaseSettingsService();
    const name = 'x'.repeat(60);
    mocks.returning.mockResolvedValue([{ ...existingRow(), siteName: name }]);

    await service.update({ siteName: `  ${name}  ` });

    expect(captured.patch).toMatchObject({ siteName: name });
  });

  it('persists the toggles together with the branding', async () => {
    const service = new ShowcaseSettingsService();
    mocks.returning.mockResolvedValue([
      {
        ...existingRow(),
        isShowcaseEnabled: true,
        isHostedClientEnabled: false,
        siteName: 'Acme',
        sitePalette: 'forest',
      },
    ]);

    const updated = await service.update({
      isShowcaseEnabled: true,
      isHostedClientEnabled: false,
      siteName: 'Acme',
      sitePalette: 'forest',
    });

    expect(updated).toMatchObject({
      isShowcaseEnabled: true,
      isHostedClientEnabled: false,
      siteName: 'Acme',
      sitePalette: 'forest',
    });
    expect(captured.patch).toMatchObject({
      isShowcaseEnabled: true,
      isHostedClientEnabled: false,
      siteName: 'Acme',
      sitePalette: 'forest',
    });
  });

  it('records a logo upload with its content type and instant', async () => {
    const service = new ShowcaseSettingsService();
    mocks.returning.mockResolvedValue([
      { ...existingRow(), logoContentType: 'image/png', logoUpdatedAt: new Date() },
    ]);

    await service.setLogo('image/png');

    expect(captured.patch?.logoContentType).toBe('image/png');
    expect(captured.patch?.logoUpdatedAt).toBeInstanceOf(Date);
  });

  it('clears the logo reference', async () => {
    const service = new ShowcaseSettingsService();
    mocks.returning.mockResolvedValue([
      { ...existingRow(), logoContentType: null, logoUpdatedAt: null },
    ]);

    await service.clearLogo();

    expect(captured.patch).toMatchObject({ logoContentType: null, logoUpdatedAt: null });
  });
});
