import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationSettingsPage } from '@/pages/settings/RegistrationSettingsPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { click, flush, render, submit } from '@test/helpers/react';

/**
 * The first-use gate of the hosted web client: a checkbox in the registration section, saved with the rest
 * of the form. The page reads its state from the stored row and sends it back on every save.
 */

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listTiers: vi.fn(),
  getShowcaseSettings: vi.fn(),
  updateShowcaseSettings: vi.fn(),
}));

vi.mock('@/api/RegistrationSettingsApiService', () => ({
  RegistrationSettingsApiService: { get: mocks.getSettings, update: mocks.updateSettings },
}));
vi.mock('@/api/TierApiService', () => ({
  TierApiService: { list: mocks.listTiers },
}));
vi.mock('@/api/ShowcaseSettingsApiService', () => ({
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
  requireAccountOnboarding: false,
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

const onboardingLabel = (container: HTMLDivElement) =>
  Array.from(container.querySelectorAll('label')).find((label) =>
    label.textContent?.includes('Require an account on first use of the web client'),
  )!;

const onboardingCheckbox = (container: HTMLDivElement) =>
  onboardingLabel(container).querySelector('input') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTiers.mockResolvedValue([]);
  mocks.getShowcaseSettings.mockResolvedValue({});
  mocks.updateSettings.mockImplementation(async (patch: Record<string, unknown>) =>
    settings({ ...patch }),
  );
});

describe('the account onboarding gate', () => {
  it('is a checkbox labelled with its text, and says what it does', async () => {
    mocks.getSettings.mockResolvedValue(settings());
    const view = await renderPage();

    expect(onboardingCheckbox(view.container).type).toBe('checkbox');
    expect(onboardingLabel(view.container).textContent).toContain(
      'sends a new person to sign in or create an account before their stories',
    );
    await view.unmount();
  });

  it('is unchecked when the stored value is off', async () => {
    mocks.getSettings.mockResolvedValue(settings({ requireAccountOnboarding: false }));
    const view = await renderPage();

    expect(onboardingCheckbox(view.container).checked).toBe(false);
    await view.unmount();
  });

  it('is checked when the stored value is on', async () => {
    mocks.getSettings.mockResolvedValue(settings({ requireAccountOnboarding: true }));
    const view = await renderPage();

    expect(onboardingCheckbox(view.container).checked).toBe(true);
    await view.unmount();
  });

  it('sends true with the update when it is checked and saved', async () => {
    mocks.getSettings.mockResolvedValue(settings({ requireAccountOnboarding: false }));
    const view = await renderPage();

    await click(onboardingCheckbox(view.container));
    await flush();
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledTimes(1);
    expect(mocks.updateSettings.mock.calls[0][0]).toMatchObject({ requireAccountOnboarding: true });
    await view.unmount();
  });

  it('sends false with the update when it is unchecked and saved', async () => {
    mocks.getSettings.mockResolvedValue(settings({ requireAccountOnboarding: true }));
    const view = await renderPage();

    await click(onboardingCheckbox(view.container));
    await flush();
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.updateSettings).toHaveBeenCalledTimes(1);
    expect(mocks.updateSettings.mock.calls[0][0]).toMatchObject({
      requireAccountOnboarding: false,
    });
    await view.unmount();
  });
});
