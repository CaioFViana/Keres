import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationSettingsPage } from '../../src/pages/settings/RegistrationSettingsPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

/**
 * The adults-only switch works in both age-verification modes: `manual` (no service, an administrator verifies by
 * hand) and `required` (the external service verifies). Its state is the stored value in either.
 */

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

const nsfwSwitch = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll('label'))
    .find((label) => label.textContent?.includes('Allow adults-only (+18) content'))!
    .querySelector('input') as HTMLInputElement;

const maxUsersInput = (container: HTMLDivElement) =>
  container.querySelector('input[type="number"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTiers.mockResolvedValue([]);
  mocks.getShowcaseSettings.mockResolvedValue({});
  mocks.updateSettings.mockImplementation(async (patch: Record<string, unknown>) =>
    settings({ ...patch }),
  );
});

describe('the adults-only switch with manual verification', () => {
  beforeEach(() => {
    mocks.getSettings.mockResolvedValue(
      settings({ ageVerificationMode: 'manual', allowNsfw: true }),
    );
  });

  it('is enabled and follows the stored value', async () => {
    const view = await renderPage();

    expect(nsfwSwitch(view.container).disabled).toBe(false);
    expect(nsfwSwitch(view.container).checked).toBe(true);
    await view.unmount();
  });

  it('says that adults-only stories are open only to verified accounts', async () => {
    const view = await renderPage();

    expect(
      view.container.querySelector('[data-testid="nsfw-verified-only-hint"]')?.textContent,
    ).toBe('Adults-only stories are open only to verified accounts.');
    await view.unmount();
  });

  it('says the mode is manual', async () => {
    const view = await renderPage();

    expect(view.container.querySelector('[data-testid="age-verification-mode"]')?.textContent).toBe(
      'Age verification: Manual: administrators verify accounts by hand',
    );
    await view.unmount();
  });

  it('saves the stored switch value along with the rest of the form', async () => {
    const view = await renderPage();

    await changeInput(maxUsersInput(view.container), '40');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledTimes(1);
    expect(mocks.updateSettings.mock.calls[0][0]).toMatchObject({ allowNsfw: true, maxUsers: 40 });
    await view.unmount();
  });
});

describe('the adults-only switch with verification required', () => {
  beforeEach(() => {
    mocks.getSettings.mockResolvedValue(settings({ ageVerificationMode: 'required' }));
  });

  it('is enabled and follows the stored value', async () => {
    const view = await renderPage();

    expect(nsfwSwitch(view.container).disabled).toBe(false);
    expect(nsfwSwitch(view.container).checked).toBe(false);
    await view.unmount();
  });

  it('says that adults-only stories are open only to verified accounts', async () => {
    const view = await renderPage();

    expect(
      view.container.querySelector('[data-testid="nsfw-verified-only-hint"]')?.textContent,
    ).toBe('Adults-only stories are open only to verified accounts.');
    expect(view.container.querySelector('[data-testid="age-verification-mode"]')?.textContent).toBe(
      'Age verification: required',
    );
    await view.unmount();
  });

  it('turns the adults-only area on and sends it', async () => {
    const view = await renderPage();

    await click(nsfwSwitch(view.container));
    await flush();
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings.mock.calls[0][0]).toMatchObject({ allowNsfw: true });
    await view.unmount();
  });
});

describe('a server that does not report its mode', () => {
  it('keeps the switch as it always was, and shows no mode line', async () => {
    const older: Partial<ReturnType<typeof settings>> = settings({ allowNsfw: true });
    delete older.ageVerificationMode;
    mocks.getSettings.mockResolvedValue(older);

    const view = await renderPage();

    expect(nsfwSwitch(view.container).disabled).toBe(false);
    expect(nsfwSwitch(view.container).checked).toBe(true);
    expect(view.container.querySelector('[data-testid="age-verification-mode"]')).toBeNull();
    await view.unmount();
  });
});
