import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationSettingsPage } from '../../src/pages/settings/RegistrationSettingsPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { TiersPage } from '../../src/pages/tiers/TiersPage';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  listTiers: vi.fn(),
  createTier: vi.fn(),
  updateTier: vi.fn(),
  softDeleteTier: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getShowcaseSettings: vi.fn(),
  updateShowcaseSettings: vi.fn(),
}));

vi.mock('../../src/api/TierApiService', () => ({
  TierApiService: {
    list: mocks.listTiers,
    create: mocks.createTier,
    update: mocks.updateTier,
    softDelete: mocks.softDeleteTier,
  },
}));
vi.mock('../../src/api/RegistrationSettingsApiService', () => ({
  RegistrationSettingsApiService: { get: mocks.getSettings, update: mocks.updateSettings },
}));
vi.mock('../../src/api/ShowcaseSettingsApiService', () => ({
  ShowcaseSettingsApiService: {
    get: mocks.getShowcaseSettings,
    update: mocks.updateShowcaseSettings,
  },
}));

const withProviders = (page: ReactElement) =>
  render(
    <MemoryRouter>
      <ThemeProvider>{page}</ThemeProvider>
    </MemoryRouter>,
  );

const settings = (over: Record<string, unknown> = {}) => ({
  isRegistrationOpen: true,
  autoManage: false,
  maxUsers: null,
  defaultTierId: null,
  ...over,
});

const tier = (over: Record<string, unknown> = {}) => ({
  id: 'tier-1',
  name: 'Pro',
  isDefault: false,
  maxStories: 10,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  isDeleted: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTiers.mockResolvedValue([]);
  mocks.createTier.mockResolvedValue({});
  mocks.updateTier.mockResolvedValue({});
  mocks.softDeleteTier.mockResolvedValue({});
  mocks.getSettings.mockResolvedValue(settings());
  mocks.updateSettings.mockImplementation(async () => settings());
  mocks.getShowcaseSettings.mockResolvedValue({
    id: 'singleton',
    isShowcaseEnabled: false,
    isHostedClientEnabled: true,
    updatedAt: '2026-08-19T00:00:00.000Z',
  });
  mocks.updateShowcaseSettings.mockImplementation(async (patch: Record<string, unknown>) => ({
    id: 'singleton',
    isShowcaseEnabled: false,
    isHostedClientEnabled: true,
    updatedAt: '2026-08-19T00:00:00.000Z',
    ...patch,
  }));
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('alert', vi.fn());
});

describe('registration settings', () => {
  it('keeps the other cards usable when registration fails to load', async () => {
    mocks.getSettings.mockRejectedValue(new Error('Settings are down.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Settings are down.');
    // Showcase and appearance do not depend on the registration load.
    expect(view.container.textContent).toContain('Hosted Pages');
    expect(view.container.textContent).toContain('Appearance');
    await view.unmount();
  });

  it('still saves when the tier list fails to load', async () => {
    mocks.listTiers.mockRejectedValue(new Error('Tiers are down.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    expect(view.container.textContent).toContain('Tiers are down.');
    await submit(view.container.querySelector('form')!);
    await flush();
    expect(mocks.updateSettings).toHaveBeenCalled();
    await view.unmount();
  });

  it('hides the manual switch while registration is automatic', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    const checkboxes = () => Array.from(view.container.querySelectorAll('input[type="checkbox"]'));

    expect(checkboxes()).toHaveLength(4); // registration ×2, showcase ×2
    await click(checkboxes()[0]); // auto-manage on
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);

    await submit(view.container.querySelector('form')!);
    await flush();
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ autoManage: true }),
    );
    await view.unmount();
  });

  it('closes registration by hand while it is manual', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    const checkboxes = Array.from(
      view.container.querySelectorAll('.form-card input[type="checkbox"]'),
    );

    await click(checkboxes[1]); // registration-open off
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ isRegistrationOpen: false }),
    );
    await view.unmount();
  });

  it('saves the typed limits and the chosen default tier', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await changeInput(view.container.querySelector('input[type="number"]')!, '500');
    const selects = view.container.querySelectorAll('select');
    await changeInput(selects[0], 'tier-1');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      isRegistrationOpen: true,
      maxUsers: 500,
      autoManage: false,
      defaultTierId: 'tier-1',
    });
    expect(view.container.querySelector('.success-text')).not.toBeNull();
    await view.unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.listTiers.mockRejectedValue(undefined);
    mocks.updateSettings.mockRejectedValue(undefined);
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    expect(view.container.textContent).toContain('Failed to load tiers.');

    await submit(view.container.querySelector('form')!);
    await flush();
    const errors = Array.from(view.container.querySelectorAll('.error-text')).map(
      (node) => node.textContent,
    );
    expect(errors).toContain('Save failed.');
    await view.unmount();
  });

  it('clears the cap and the default tier back to nothing', async () => {
    mocks.getSettings.mockResolvedValue(settings({ maxUsers: 500, defaultTierId: 'tier-1' }));
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await changeInput(view.container.querySelector('input[type="number"]')!, '');
    await changeInput(view.container.querySelectorAll('select')[0], '');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ maxUsers: null, defaultTierId: null }),
    );
    await view.unmount();
  });

  it('reports a save failure without losing the form', async () => {
    mocks.updateSettings.mockRejectedValue(new Error('Read-only mode.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await submit(view.container.querySelector('form')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Read-only mode.');
    expect(view.container.querySelector('form')).not.toBeNull();
    await view.unmount();
  });
});

describe('showcase settings card', () => {
  const showcaseCard = (container: HTMLDivElement) =>
    Array.from(container.querySelectorAll('.form-card')).find((node) =>
      node.textContent?.includes('Hosted Pages'),
    )!;

  it('toggles the public site on and off', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await click(showcaseCard(view.container).querySelectorAll('input[type="checkbox"]')[0]);
    await flush();

    expect(mocks.updateShowcaseSettings).toHaveBeenCalledWith({ isShowcaseEnabled: true });
    expect(showcaseCard(view.container).querySelector('.success-text')).not.toBeNull();
    await view.unmount();
  });

  it('reports a toggle failure', async () => {
    mocks.updateShowcaseSettings.mockRejectedValue(new Error('Read-only mode.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await click(showcaseCard(view.container).querySelectorAll('input[type="checkbox"]')[1]);
    await flush();

    expect(showcaseCard(view.container).querySelector('.error-text')?.textContent).toBe(
      'Read-only mode.',
    );
    await view.unmount();
  });

  it('reports a load failure', async () => {
    mocks.getShowcaseSettings.mockRejectedValue(new Error('Showcase settings are down.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    expect(view.container.textContent).toContain('Showcase settings are down.');
    await view.unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.getShowcaseSettings.mockRejectedValue(undefined);
    const failed = await withProviders(<RegistrationSettingsPage />);
    await flush();
    expect(failed.container.textContent).toContain('Failed to load.');
    await failed.unmount();

    mocks.getShowcaseSettings.mockResolvedValue({
      id: 'singleton',
      isShowcaseEnabled: false,
      isHostedClientEnabled: true,
      updatedAt: '2026-08-19T00:00:00.000Z',
    });
    mocks.updateShowcaseSettings.mockRejectedValue(undefined);
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await click(showcaseCard(view.container).querySelectorAll('input[type="checkbox"]')[0]);
    await flush();
    expect(showcaseCard(view.container).querySelector('.error-text')?.textContent).toBe(
      'Save failed.',
    );
    await view.unmount();
  });
});

describe('appearance card', () => {
  it('remembers the chosen palette in this browser', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    const selects = view.container.querySelectorAll('select');
    const paletteSelect = selects[selects.length - 1];
    await changeInput(paletteSelect, 'twilight');
    await flush();

    expect(localStorage.getItem('keres_admin_theme_palette')).toBe('twilight');
    expect(document.documentElement.style.getPropertyValue('--color-sidebar-bg')).not.toBe('');
    await view.unmount();
  });
});

describe('tiers page', () => {
  it('edits an existing tier and saves through update', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );
    await changeInput(view.container.querySelector('.form-card input')!, 'Pro+');
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({ name: 'Pro+', maxStories: 10 }),
    );
    expect(mocks.createTier).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('closes the form without saving on cancel', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );
    expect(view.container.querySelector('.form-card')).not.toBeNull();
    await click(
      Array.from(view.container.querySelectorAll('.form-card button')).find(
        (button) => button.textContent === 'Cancel',
      )!,
    );

    expect(view.container.querySelector('.form-card')).toBeNull();
    expect(mocks.updateTier).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('converts a filled limit to a number and a cleared one to null', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const [maxStories, maxEntitiesPerStory] = Array.from(
      view.container.querySelector('.form-card')!.querySelectorAll('input'),
    ).filter((input) => input.type === 'number');
    await changeInput(view.container.querySelector('.form-card input')!, 'Team');
    await changeInput(maxStories, '25');
    await changeInput(maxEntitiesPerStory, 'not-a-number');
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({ maxStories: 25, maxEntitiesPerStory: null }),
    );
    await view.unmount();
  });

  it('marks a new tier as the default', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await changeInput(view.container.querySelector('.form-card input')!, 'Free');
    await click(view.container.querySelector('.form-card input[type="checkbox"]')!);
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Free', isDefault: true }),
    );
    await view.unmount();
  });

  it('deletes after confirmation and reloads the list', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();

    expect(mocks.softDeleteTier).toHaveBeenCalledWith('tier-1');
    expect(mocks.listTiers).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it('deletes nothing when the operator cancels', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();

    expect(mocks.softDeleteTier).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('reports a delete failure', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    mocks.softDeleteTier.mockRejectedValue(new Error('Tier in use.'));
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();

    expect(window.alert).toHaveBeenCalledWith('Tier in use.');
    await view.unmount();
  });

  it('shows unlimited caps and the default badge as they are', async () => {
    mocks.listTiers.mockResolvedValue([
      tier({
        isDefault: true,
        maxStories: null,
        maxEntitiesPerStory: null,
        maxEntitiesTotal: null,
        maxStorageBytesPerStory: null,
        maxStorageBytesTotal: null,
      }),
    ]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const row = view.container.querySelector('tbody tr')!;
    expect(row.textContent).toContain('Yes');
    expect(row.textContent).toContain('∞');
    await view.unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    mocks.createTier.mockRejectedValue(undefined);
    mocks.softDeleteTier.mockRejectedValue(undefined);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await submit(view.container.querySelector('.form-card')!);
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('Save failed.');

    await click(
      Array.from(view.container.querySelectorAll('tbody button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();
    expect(window.alert).toHaveBeenCalledWith('Delete failed.');
    await view.unmount();
  });

  it('marks deleted tiers instead of offering to edit them', async () => {
    mocks.listTiers.mockResolvedValue([tier({ isDeleted: true })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    expect(view.container.querySelector('.status-badge.deleted')).not.toBeNull();
    expect(
      Array.from(view.container.querySelectorAll('tbody button')).find(
        (button) => button.textContent === 'Edit',
      ),
    ).toBeUndefined();
    await view.unmount();
  });

  it('reports a save failure on the form', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    mocks.createTier.mockRejectedValue(new Error('Name taken.'));
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Name taken.');
    await view.unmount();
  });

  it('shows a failure when the list fails to load', async () => {
    mocks.listTiers.mockRejectedValue(new Error('Tiers are down.'));
    const view = await withProviders(<TiersPage />);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Tiers are down.');
    await view.unmount();
  });
});
