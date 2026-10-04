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

const showTab = async (container: HTMLDivElement, label: string) => {
  await click(
    Array.from(container.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent === label,
    )!,
  );
  await flush();
};

const settings = (over: Record<string, unknown> = {}) => ({
  isRegistrationOpen: true,
  autoManage: false,
  maxUsers: null,
  defaultTierId: null,
  currency: 'BRL',
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
  maxPublicationsPerDay: null,
  maxMessagesPerDay: null,
  priceMonthlyCents: null,
  priceYearlyCents: null,
  isPublicForSale: false,
  sortOrder: 0,
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

  it('says, by the default plan, what people have without paying and what no default means', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    const hint =
      view.container.querySelector('[data-testid="default-tier-hint"]')?.textContent ?? '';
    expect(hint).toContain('without paying');
    expect(hint).toContain('free plan');
    expect(hint).toContain('paid-only');
    expect(hint).toContain('no limits');
    await view.unmount();
  });

  it('hides the manual switch while registration is automatic', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    const checkboxes = () => Array.from(view.container.querySelectorAll('input[type="checkbox"]'));

    expect(checkboxes()).toHaveLength(2); // registration ×2; other tabs stay hidden
    await click(checkboxes()[0]); // auto-manage on
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);

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
      currency: 'BRL',
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

  it('switches sections through tabs, one at a time', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Registration',
      'Hosted Pages',
      'Appearance',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(view.container.querySelector('.settings-sections form')).not.toBeNull();
    expect(view.container.querySelector('.appearance-preview')).toBeNull();

    await click(tabs[2]);
    await flush();

    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(view.container.querySelector('.settings-sections form')).toBeNull();
    expect(view.container.querySelector('.appearance-preview')).not.toBeNull();
    await view.unmount();
  });

  it('disables save until something changes, then reports the draft state', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    const form = view.container.querySelector('form')!;
    const save = () =>
      Array.from(form.querySelectorAll('button')).find(
        (button) => button.textContent === 'Save',
      )! as HTMLButtonElement;

    expect(save().disabled).toBe(true);
    expect(form.textContent).toContain('All changes saved.');

    await changeInput(form.querySelector('input[type="number"]')!, '500');
    await flush();

    expect(save().disabled).toBe(false);
    expect(form.textContent).toContain('Unsaved changes.');
    await view.unmount();
  });

  it('uppercases the typed currency and saves it with the rest', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    const label = Array.from(view.container.querySelectorAll('form label')).find((node) =>
      node.textContent?.includes('Currency (ISO code)'),
    )!;
    await changeInput(label.querySelector('input')!, 'usd');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
    await view.unmount();
  });

  it('refuses a negative max users instead of saving it', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();

    await changeInput(view.container.querySelector('input[type="number"]')!, '-5');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).not.toHaveBeenCalled();
    expect(view.container.querySelector('.error-text')?.textContent).toBe(
      'Enter a whole number of 0 or more.',
    );
    await view.unmount();
  });
});

describe('showcase settings card', () => {
  const showcaseCard = (container: HTMLDivElement) =>
    Array.from(container.querySelectorAll('.form-card')).find((node) =>
      node.textContent?.includes('Hosted Pages'),
    )!;

  it('holds toggle edits as a draft until saved once', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Hosted Pages');
    const card = showcaseCard(view.container);
    const save = () =>
      Array.from(card.querySelectorAll('button')).find((button) => button.textContent === 'Save')!;

    await click(card.querySelectorAll('input[type="checkbox"]')[0]);
    await flush();

    expect(mocks.updateShowcaseSettings).not.toHaveBeenCalled();
    expect(card.textContent).toContain('Unsaved changes.');

    await click(save());
    await flush();

    expect(mocks.updateShowcaseSettings).toHaveBeenCalledTimes(1);
    expect(mocks.updateShowcaseSettings).toHaveBeenCalledWith({
      isShowcaseEnabled: true,
      isHostedClientEnabled: true,
      isLandingEnabled: false,
      siteName: 'Keres',
      sitePalette: 'default',
    });
    expect(card.querySelector('.success-text')).not.toBeNull();
    expect(card.textContent).toContain('All changes saved.');
    await view.unmount();
  });

  it('reports a save failure', async () => {
    mocks.updateShowcaseSettings.mockRejectedValue(new Error('Read-only mode.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Hosted Pages');
    const card = showcaseCard(view.container);

    await click(card.querySelectorAll('input[type="checkbox"]')[1]);
    await flush();
    await click(
      Array.from(card.querySelectorAll('button')).find((button) => button.textContent === 'Save')!,
    );
    await flush();

    expect(card.querySelector('.error-text')?.textContent).toBe('Read-only mode.');
    await view.unmount();
  });

  it('reports a load failure', async () => {
    mocks.getShowcaseSettings.mockRejectedValue(new Error('Showcase settings are down.'));
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Hosted Pages');

    expect(view.container.textContent).toContain('Showcase settings are down.');
    await view.unmount();
  });

  it('saves the landing page toggle with the rest of the draft', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Hosted Pages');
    const card = showcaseCard(view.container);

    await click(card.querySelectorAll('input[type="checkbox"]')[2]);
    await flush();
    await click(
      Array.from(card.querySelectorAll('button')).find((button) => button.textContent === 'Save')!,
    );
    await flush();

    expect(mocks.updateShowcaseSettings).toHaveBeenCalledWith(
      expect.objectContaining({ isLandingEnabled: true }),
    );
    await view.unmount();
  });

  it('falls back to its own messages when failures carry none', async () => {
    mocks.getShowcaseSettings.mockRejectedValue(undefined);
    const failed = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(failed.container, 'Hosted Pages');
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
    await showTab(view.container, 'Hosted Pages');
    const card = showcaseCard(view.container);
    await click(card.querySelectorAll('input[type="checkbox"]')[0]);
    await flush();
    await click(
      Array.from(card.querySelectorAll('button')).find((button) => button.textContent === 'Save')!,
    );
    await flush();
    expect(card.querySelector('.error-text')?.textContent).toBe('Save failed.');
    await view.unmount();
  });
});

describe('appearance card', () => {
  it('switches the theme through the segmented control', async () => {
    localStorage.removeItem('keres_admin_theme_preference');
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Appearance');

    const dark = Array.from(view.container.querySelectorAll('.segmented button')).find(
      (button) => button.textContent === 'Dark',
    )!;
    expect(dark.getAttribute('aria-pressed')).toBe('false');

    await click(dark);
    await flush();

    expect(localStorage.getItem('keres_admin_theme_preference')).toBe('dark');
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    await view.unmount();
  });

  it('previews the panel with the live theme variables', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Appearance');

    const preview = view.container.querySelector('.appearance-preview')!;
    expect(preview.querySelector('.appearance-preview-sidebar')).not.toBeNull();
    expect(preview.querySelector('.appearance-preview-button')).not.toBeNull();
    expect(preview.querySelector('.appearance-preview-card')).not.toBeNull();
    await view.unmount();
  });

  it('remembers the chosen palette in this browser', async () => {
    const view = await withProviders(<RegistrationSettingsPage />);
    await flush();
    await showTab(view.container, 'Appearance');

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
  it('says to keep a free plan as the default, and that a free plan at 0 makes the server paid-only', async () => {
    mocks.listTiers.mockResolvedValue([]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const note = view.container.querySelector('[data-testid="free-plan-note"]')?.textContent ?? '';
    expect(note).toContain('Always keep a free plan');
    expect(note).toContain('no limits at all');
    expect(note).toContain('0 allows nothing');
    expect(note).toContain('paid-only');
    // What 0 does to a person is said, not left to be found out.
    expect(note).toContain('cannot create stories');
    expect(note).toContain('collaborate');
    await view.unmount();
  });

  it('tells, on the plan being edited, that ticking default is the same setting as in Settings', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();
    expect(view.container.querySelector('[data-testid="default-note"]')).toBeNull();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );

    const note = view.container.querySelector('[data-testid="default-note"]')?.textContent ?? '';
    expect(note).toContain('free plan');
    expect(note).toContain('paid period ends');
    expect(note).toContain('same setting');
    await view.unmount();
  });

  it('says on every ceiling that blank is unlimited and 0 is none', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );

    const hints = Array.from(view.container.querySelectorAll('.form-card label .hint')).map(
      (hint) => hint.textContent,
    );
    expect(hints.filter((hint) => hint === '(blank = unlimited, 0 = none)').length).toBeGreaterThan(
      5,
    );
    await view.unmount();
  });

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

  it('asks for the publications per day, labelled, and keeps 0 (none allowed) apart from empty (unlimited)', async () => {
    mocks.listTiers.mockResolvedValue([tier({ maxPublicationsPerDay: 3 })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    // The card groups and the value.
    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('Limits');
    expect(card.textContent).toContain('Storage');
    expect(card.textContent).toContain('Prices');
    expect(card.textContent).toContain('Publications/day');
    expect(card.textContent).toContain('3');

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const label = Array.from(view.container.querySelectorAll('.form-card label')).find((node) =>
      node.textContent?.includes('Max publications per day'),
    )!;
    const input = label.querySelector('input')!;
    await changeInput(view.container.querySelector('.form-card input')!, 'Team');
    await changeInput(input, '0');
    await submit(view.container.querySelector('.form-card')!);
    await flush();
    expect(mocks.createTier).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxPublicationsPerDay: 0 }),
    );

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await changeInput(view.container.querySelector('.form-card input')!, 'Open');
    await submit(view.container.querySelector('.form-card')!);
    await flush();
    expect(mocks.createTier).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxPublicationsPerDay: null }),
    );
    await view.unmount();
  });

  it('asks for the messages per day, and keeps 0 (silenced) apart from empty (unlimited)', async () => {
    mocks.listTiers.mockResolvedValue([tier({ maxMessagesPerDay: 12 })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('Messages/day');
    expect(card.textContent).toContain('12');

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const label = Array.from(view.container.querySelectorAll('.form-card label')).find((node) =>
      node.textContent?.includes('Max messages to users per day'),
    )!;
    await changeInput(view.container.querySelector('.form-card input')!, 'Quiet');
    await changeInput(label.querySelector('input')!, '0');
    await submit(view.container.querySelector('.form-card')!);
    await flush();
    expect(mocks.createTier).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxMessagesPerDay: 0 }),
    );

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    await changeInput(view.container.querySelector('.form-card input')!, 'Open');
    await submit(view.container.querySelector('.form-card')!);
    await flush();
    expect(mocks.createTier).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxMessagesPerDay: null }),
    );
    await view.unmount();
  });

  it('loads the ceiling of the tier being edited', async () => {
    mocks.listTiers.mockResolvedValue([tier({ maxPublicationsPerDay: 7 })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({ maxPublicationsPerDay: 7 }),
    );
    await view.unmount();
  });

  it('shows storage limits as KB/MB/GB and edits them as an amount and a unit', async () => {
    mocks.listTiers.mockResolvedValue([
      tier({ maxStorageBytesPerStory: 100 * 1024 * 1024, maxStorageBytesTotal: 2 * 1024 ** 3 }),
    ]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('100 MB');
    expect(card.textContent).toContain('2 GB');

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );
    const label = Array.from(view.container.querySelectorAll('.form-card label')).find((node) =>
      node.textContent?.includes('Max storage per story'),
    )!;
    const amount = label.querySelector('input')!;
    const unit = label.querySelector('select')!;
    expect(amount.value).toBe('100');
    expect(unit.value).toBe('MB');

    // A new amount keeps the unit; a new unit keeps the amount.
    await changeInput(amount, '250');
    await changeInput(unit, 'GB');
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({
        maxStorageBytesPerStory: 250 * 1024 ** 3,
        maxStorageBytesTotal: 2 * 1024 ** 3,
      }),
    );
    await view.unmount();
  });

  it('leaves a cleared storage limit unlimited', async () => {
    mocks.listTiers.mockResolvedValue([tier({ maxStorageBytesTotal: 1024 ** 3 })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Edit',
      )!,
    );
    const label = Array.from(view.container.querySelectorAll('.form-card label')).find((node) =>
      node.textContent?.includes('Max storage total'),
    )!;
    await changeInput(label.querySelector('input')!, '');
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({ maxStorageBytesTotal: null }),
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

    expect(view.container.querySelector('.modal')?.textContent).toContain('Tier in use.');
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

    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('Default');
    expect(card.textContent).toContain('∞');
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
      Array.from(view.container.querySelectorAll('.modal button')).find(
        (button) => button.textContent === 'Cancel',
      )!,
    );
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('.tier-card button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Delete failed.');
    await view.unmount();
  });

  it('marks deleted tiers instead of offering to edit them', async () => {
    mocks.listTiers.mockResolvedValue([tier({ isDeleted: true })]);
    const view = await withProviders(<TiersPage />);
    await flush();

    expect(view.container.querySelector('.status-badge.deleted')).not.toBeNull();
    expect(
      Array.from(view.container.querySelectorAll('.tier-card button')).find(
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

  it('refuses a negative ceiling instead of sending it to the API', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const label = Array.from(view.container.querySelectorAll('.modal label')).find((node) =>
      node.textContent?.includes('Max stories'),
    )!;
    await changeInput(label.querySelector('input')!, '-3');
    await submit(view.container.querySelector('.modal form')!);
    await flush();

    expect(mocks.createTier).not.toHaveBeenCalled();
    expect(view.container.querySelector('.error-text')?.textContent).toBe(
      'Enter a whole number of 0 or more.',
    );
    await view.unmount();
  });

  it('shows a failure when the list fails to load', async () => {
    mocks.listTiers.mockRejectedValue(new Error('Tiers are down.'));
    const view = await withProviders(<TiersPage />);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Tiers are down.');
    await view.unmount();
  });

  it('saves sale pricing in cents and previews the yearly discount', async () => {
    mocks.listTiers.mockResolvedValue([tier()]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const labels = Array.from(view.container.querySelectorAll('.form-card label'));
    const byText = (text: string) =>
      labels.find((node) => node.textContent?.includes(text))!.querySelector('input')!;
    await changeInput(view.container.querySelector('.form-card input')!, 'Pro');
    await changeInput(byText('Price per month'), '19.90');
    await changeInput(byText('Price per year'), '199');
    await click(byText('Available for sale'));
    await changeInput(byText('Display order'), '2');

    // 199.00 against 12 × 19.90: −17%.
    expect(view.container.querySelector('.form-card')!.textContent).toContain('−17% vs monthly');

    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({
        priceMonthlyCents: 1990,
        priceYearlyCents: 19900,
        isPublicForSale: true,
        sortOrder: 2,
      }),
    );
    await view.unmount();
  });

  it('shows prices formatted and zero as free', async () => {
    mocks.listTiers.mockResolvedValue([
      tier({ priceMonthlyCents: 1990, priceYearlyCents: 0, isPublicForSale: true }),
    ]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('19.90');
    expect(card.textContent).toContain('Free');
    expect(card.textContent).toContain('For sale');
    await view.unmount();
  });

  it('shows the store products on the card and saves them from the form', async () => {
    mocks.listTiers.mockResolvedValue([
      tier({ playMonthlyProductId: 'plus_monthly', playYearlyProductId: null }),
    ]);
    const view = await withProviders(<TiersPage />);
    await flush();

    const card = view.container.querySelector('.tier-card')!;
    expect(card.textContent).toContain('plus_monthly');

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const labels = Array.from(view.container.querySelectorAll('.form-card label'));
    const byText = (text: string) =>
      labels.find((node) => node.textContent?.includes(text))!.querySelector('input')!;
    await changeInput(view.container.querySelector('.form-card input')!, 'Pro');
    await changeInput(byText('Play product (monthly)'), 'plus_monthly');
    await changeInput(byText('Play product (yearly)'), 'plus_yearly');

    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({
        playMonthlyProductId: 'plus_monthly',
        playYearlyProductId: 'plus_yearly',
        webMonthlyEnabled: true,
        webYearlyEnabled: true,
      }),
    );
    await view.unmount();
  });

  it('sells a plan outside the web when the web sale is unticked', async () => {
    mocks.listTiers.mockResolvedValue([tier({})]);
    const view = await withProviders(<TiersPage />);
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'New tier',
      )!,
    );
    const labels = Array.from(view.container.querySelectorAll('.form-card label'));
    const webMonthly = labels
      .find((node) => node.textContent?.includes('Web (monthly)'))!
      .querySelector('input')!;
    await click(webMonthly);

    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.createTier).toHaveBeenCalledWith(
      expect.objectContaining({ webMonthlyEnabled: false, webYearlyEnabled: true }),
    );
    await view.unmount();
  });
});
