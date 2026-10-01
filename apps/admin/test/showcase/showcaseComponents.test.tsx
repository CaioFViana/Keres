import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../../src/showcase/components/Layout';
import { PasswordGate } from '../../src/showcase/components/PasswordGate';
import {
  SHOWCASE_THEME_KEY,
  ShowcaseThemeProvider,
} from '../../src/showcase/theme/ShowcaseThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

beforeEach(() => {
  localStorage.removeItem(SHOWCASE_THEME_KEY);
});

afterEach(() => {
  localStorage.removeItem(SHOWCASE_THEME_KEY);
  document.documentElement.removeAttribute('data-theme');
});

describe('showcase header theme toggle', () => {
  const renderToggle = () =>
    render(
      <MemoryRouter>
        <ShowcaseThemeProvider>
          <Layout>
            <p>page</p>
          </Layout>
        </ShowcaseThemeProvider>
      </MemoryRouter>,
    );

  it.each([
    ['system', '🖥️'],
    ['light', '☀️'],
    ['dark', '🌙'],
  ])('shows the %s glyph for the stored preference', async (preference, glyph) => {
    localStorage.setItem(SHOWCASE_THEME_KEY, preference);
    const view = await renderToggle();
    await flush();

    expect(view.container.querySelector('.theme-toggle')?.textContent).toContain(glyph);
    await view.unmount();
  });

  it('cycles the preference when pressed', async () => {
    const view = await renderToggle();
    await flush();

    await click(view.container.querySelector('.theme-toggle')!);
    await flush();

    expect(localStorage.getItem(SHOWCASE_THEME_KEY)).toBe('light');
    expect(view.container.querySelector('.theme-toggle')?.textContent).toContain('☀️');
    await view.unmount();
  });
});

describe('password gate', () => {
  const renderGate = (onSubmit: (password: string) => Promise<void>) =>
    render(
      <MemoryRouter>
        <PasswordGate onSubmit={onSubmit} />
      </MemoryRouter>,
    );

  it('unlocks with the typed password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const view = await renderGate(onSubmit);

    await changeInput(view.container.querySelector('input')!, 'sésamo');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(onSubmit).toHaveBeenCalledWith('sésamo');
    expect(view.container.querySelector('.error-text')).toBeNull();
    await view.unmount();
  });

  it('shows the refusal when the password is wrong', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Wrong password.'));
    const view = await renderGate(onSubmit);

    await changeInput(view.container.querySelector('input')!, 'wrong');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Wrong password.');
    await view.unmount();
  });

  it('falls back to its own message when the failure carries none', async () => {
    const onSubmit = vi.fn().mockRejectedValue(undefined);
    const view = await renderGate(onSubmit);

    await changeInput(view.container.querySelector('input')!, 'wrong');
    await submit(view.container.querySelector('form')!);
    await flush();

    const error = view.container.querySelector('.error-text');
    expect(error).not.toBeNull();
    expect(error?.textContent).not.toBe('');
    expect(error?.textContent).not.toContain('undefined');
    await view.unmount();
  });
});
