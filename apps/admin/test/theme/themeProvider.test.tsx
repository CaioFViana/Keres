import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeProvider';
import { THEME_PALETTE_KEY, THEME_PREFERENCE_KEY } from '../../src/theme/theme';
import { click, flush, render } from '../helpers/react';

function ThemeProbe() {
  const theme = useTheme();
  return (
    <div>
      <span>{`preference:${theme.preference} resolved:${theme.resolved} palette:${theme.palette}`}</span>
      <button onClick={theme.cyclePreference}>Cycle</button>
      <button onClick={() => theme.setPalette('twilight')}>Twilight</button>
    </div>
  );
}

/** A controllable `matchMedia`: the OS theme the test pretends is active. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Map<string, Set<() => void>>();
  const media = {
    matches,
    addEventListener: vi.fn((event: string, listener: () => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    }),
    removeEventListener: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    media,
    setMatches: (next: boolean) => {
      media.matches = next;
    },
    fireChange: () => {
      for (const listener of listeners.get('change') ?? []) listener();
    },
  };
}

beforeEach(() => {
  localStorage.removeItem(THEME_PREFERENCE_KEY);
  localStorage.removeItem(THEME_PALETTE_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.removeItem(THEME_PREFERENCE_KEY);
  localStorage.removeItem(THEME_PALETTE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('panel theme provider', () => {
  it('starts on system and paints <html> before anyone asks', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();

    expect(view.container.textContent).toContain('preference:system');
    // jsdom has no matchMedia: with no OS to ask, system resolves to light.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('system');
    await view.unmount();
  });

  it('remembers an explicit choice across reloads', async () => {
    localStorage.setItem(THEME_PREFERENCE_KEY, 'dark');
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();

    expect(view.container.textContent).toContain('preference:dark resolved:dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await view.unmount();
  });

  it('cycles system → light → dark → system, repainting each time', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();
    const cycle = view.container.querySelector('button')!;

    await click(cycle);
    expect(view.container.textContent).toContain('preference:light resolved:light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await click(cycle);
    expect(view.container.textContent).toContain('preference:dark resolved:dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await click(cycle);
    expect(view.container.textContent).toContain('preference:system');
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('system');
    await view.unmount();
  });

  it('follows the OS while the preference is system', async () => {
    const os = stubMatchMedia(false);
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    os.setMatches(true);
    await act(async () => {
      os.fireChange();
    });
    await flush();

    expect(view.container.textContent).toContain('resolved:dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await view.unmount();
  });

  it('stops following the OS once the choice is explicit', async () => {
    const os = stubMatchMedia(false);
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();

    await click(view.container.querySelector('button')!);
    expect(view.container.textContent).toContain('preference:light');

    os.setMatches(true);
    await act(async () => {
      os.fireChange();
    });
    await flush();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await view.unmount();
  });

  it('applies a chosen palette and remembers it', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await flush();

    await click(view.container.querySelectorAll('button')[1]);
    await flush();

    expect(view.container.textContent).toContain('palette:twilight');
    expect(localStorage.getItem(THEME_PALETTE_KEY)).toBe('twilight');
    expect(document.documentElement.style.getPropertyValue('--color-sidebar-bg')).not.toBe('');
    await view.unmount();
  });

  it('refuses to be read outside its provider', async () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      await expect(render(<ThemeProbe />)).rejects.toThrow(
        'useTheme must be used within ThemeProvider',
      );
    } finally {
      console.error = consoleError;
    }
  });
});
