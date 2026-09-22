import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShowcaseSettingsCard } from '../../src/pages/settings/ShowcaseSettingsCard';
import { changeInput, click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  uploadLogo: vi.fn(),
  deleteLogo: vi.fn(),
}));

vi.mock('../../src/api/ShowcaseSettingsApiService', () => ({
  ShowcaseSettingsApiService: {
    get: mocks.get,
    update: mocks.update,
    uploadLogo: mocks.uploadLogo,
    deleteLogo: mocks.deleteLogo,
  },
}));

const settings = (over: Record<string, unknown> = {}) => ({
  id: 'singleton',
  isShowcaseEnabled: false,
  isHostedClientEnabled: true,
  siteName: 'Acme Stories',
  sitePalette: 'twilight',
  logoContentType: null,
  logoUpdatedAt: null,
  updatedAt: '2026-09-22T00:00:00.000Z',
  ...over,
});

async function chooseFile(input: HTMLInputElement, file: File): Promise<void> {
  await act(async () => {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(settings());
  mocks.update.mockImplementation(async (patch: Record<string, unknown>) =>
    settings({ ...patch }),
  );
  mocks.uploadLogo.mockResolvedValue(
    settings({ logoContentType: 'image/png', logoUpdatedAt: '2026-09-22T00:00:00.000Z' }),
  );
  mocks.deleteLogo.mockResolvedValue(settings());
});

describe('showcase branding card', () => {
  it('shows the saved name and palette, offering every shared palette', async () => {
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    const nameInput = view.container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput.value).toBe('Acme Stories');
    const select = view.container.querySelector('select')!;
    expect(select.value).toBe('twilight');
    const options = [...select.querySelectorAll('option')].map((option) => option.textContent);
    expect(options).toContain('Default');
    expect(options).toContain('Twilight');
    await view.unmount();
  });

  it('saves the name and palette together', async () => {
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    await changeInput(view.container.querySelector('input[type="text"]')!, 'New Name');
    await changeInput(view.container.querySelector('select')!, 'ocean');
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Save',
      )!,
    );
    await flush();

    expect(mocks.update).toHaveBeenCalledWith({ siteName: 'New Name', sitePalette: 'ocean' });
    expect(view.container.querySelector('.success-text')).not.toBeNull();
    await view.unmount();
  });

  it('reports a branding save failure without losing the form', async () => {
    mocks.update.mockRejectedValue(new Error('Read-only mode.'));
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Save',
      )!,
    );
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Read-only mode.');
    expect(view.container.querySelector('input[type="text"]')).not.toBeNull();
    await view.unmount();
  });

  it('falls back to its own message when a save failure carries none', async () => {
    mocks.update.mockRejectedValue(undefined);
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Save',
      )!,
    );
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Save failed.');
    await view.unmount();
  });

  it('shows no preview until a logo exists', async () => {
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.textContent).not.toContain('Remove logo');
    await view.unmount();
  });

  it('previews the uploaded logo with a cache-busted URL', async () => {
    mocks.get.mockResolvedValue(
      settings({
        logoContentType: 'image/png',
        logoUpdatedAt: '2026-09-22T00:00:00.000Z',
      }),
    );
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    const preview = view.container.querySelector('img')!;
    expect(preview.getAttribute('src')).toBe(
      `/api/public/showcase-logo?v=${Date.parse('2026-09-22T00:00:00.000Z')}`,
    );
    expect(preview.getAttribute('alt')).toBe('Current logo');
    await view.unmount();
  });

  it('uploads the chosen file and reports it saved', async () => {
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });
    await chooseFile(view.container.querySelector('input[type="file"]')!, file);
    await flush();

    expect(mocks.uploadLogo).toHaveBeenCalledWith(file);
    expect(view.container.querySelector('.success-text')).not.toBeNull();
    expect(view.container.querySelector('img')).not.toBeNull();
    await view.unmount();
  });

  it('reports an upload failure', async () => {
    mocks.uploadLogo.mockRejectedValue(new Error('Logo exceeds the maximum size.'));
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    await chooseFile(
      view.container.querySelector('input[type="file"]')!,
      new File(['bytes'], 'huge.png', { type: 'image/png' }),
    );
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe(
      'Logo exceeds the maximum size.',
    );
    await view.unmount();
  });

  it('removes the logo and clears the preview', async () => {
    mocks.get.mockResolvedValue(
      settings({
        logoContentType: 'image/png',
        logoUpdatedAt: '2026-09-22T00:00:00.000Z',
      }),
    );
    const view = await render(<ShowcaseSettingsCard />);
    await flush();
    expect(view.container.querySelector('img')).not.toBeNull();

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Remove logo',
      )!,
    );
    await flush();

    expect(mocks.deleteLogo).toHaveBeenCalledOnce();
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.querySelector('.success-text')).not.toBeNull();
    await view.unmount();
  });

  it('reports a logo removal failure', async () => {
    mocks.get.mockResolvedValue(
      settings({
        logoContentType: 'image/png',
        logoUpdatedAt: '2026-09-22T00:00:00.000Z',
      }),
    );
    mocks.deleteLogo.mockRejectedValue(undefined);
    const view = await render(<ShowcaseSettingsCard />);
    await flush();

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Remove logo',
      )!,
    );
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Save failed.');
    await view.unmount();
  });
});
