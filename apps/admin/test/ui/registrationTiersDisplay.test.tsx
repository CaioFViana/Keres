import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationSettingsPage } from '../../src/pages/settings/RegistrationSettingsPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, flush, render, submit } from '../helpers/react';

/** The server's choice of how the public landing page presents its plans: for sale, or information only. */

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listTiers: vi.fn(),
  getShowcaseSettings: vi.fn(),
  updateShowcaseSettings: vi.fn(),
}));

vi.mock('../../src/api/RegistrationSettingsApiService', () => ({
  RegistrationSettingsApiService: { get: mocks.getSettings, update: mocks.updateSettings },
}));
vi.mock('../../src/api/TierApiService', () => ({
  TierApiService: { list: mocks.listTiers },
}));
vi.mock('../../src/api/ShowcaseSettingsApiService', () => ({
  ShowcaseSettingsApiService: {
    get: mocks.getShowcaseSettings,
    update: mocks.updateShowcaseSettings,
  },
}));

const settings = (over: Record<string, unknown> = {}) => ({
  id: 'singleton',
  isRegistrationOpen: true,
  autoManage: false,
  maxUsers: null,
  allowNsfw: false,
  defaultTierId: null,
  currency: 'BRL',
  tiersDisplay: 'sale',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ageVerificationMode: 'required',
  ...over,
});

async function renderPage() {
  const view = await render(
    <MemoryRouter>
      <ThemeProvider>
        <RegistrationSettingsPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
  await flush();
  return view;
}

const displaySelect = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll('label'))
    .find((label) => label.textContent?.includes('Plans on the public site'))!
    .querySelector('select') as HTMLSelectElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTiers.mockResolvedValue([]);
  mocks.getShowcaseSettings.mockResolvedValue({});
  mocks.updateSettings.mockImplementation(async (patch: Record<string, unknown>) =>
    settings({ ...patch }),
  );
});

describe('the plans display setting', () => {
  it('offers sale with prices, or information only, and follows the stored value', async () => {
    mocks.getSettings.mockResolvedValue(settings({ tiersDisplay: 'info' }));
    const view = await renderPage();

    const select = displaySelect(view.container);
    expect(select.value).toBe('info');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'For sale (prices shown)',
      'Information only (no prices, nothing for sale)',
    ]);
    await view.unmount();
  });

  it('explains what information only means', async () => {
    mocks.getSettings.mockResolvedValue(settings());
    const view = await renderPage();

    expect(view.container.querySelector('[data-testid="tiers-display-hint"]')?.textContent).toMatch(
      /no prices/,
    );
    await view.unmount();
  });

  it('saves the chosen display with the rest of the form', async () => {
    mocks.getSettings.mockResolvedValue(settings());
    const view = await renderPage();

    await changeInput(displaySelect(view.container), 'info');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledTimes(1);
    expect(mocks.updateSettings.mock.calls[0][0]).toMatchObject({ tiersDisplay: 'info' });
    await view.unmount();
  });
});
