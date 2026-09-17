import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHOWCASE_THEME_KEY,
  ShowcaseThemeProvider,
  useShowcaseTheme,
} from '../../src/showcase/theme/ShowcaseThemeProvider';
import {
  paletteDisplayName,
  paletteExists,
  paletteVars,
} from '../../src/showcase/theme/paletteVars';
import { click, flush, render } from '../helpers/react';

function ThemeProbe() {
  const theme = useShowcaseTheme();
  return (
    <div>
      <span>{`preference:${theme.preference} resolved:${theme.resolved}`}</span>
      <button onClick={theme.cyclePreference}>Cycle</button>
    </div>
  );
}

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
    setMatches: (next: boolean) => {
      media.matches = next;
    },
    fireChange: () => {
      for (const listener of listeners.get('change') ?? []) listener();
    },
  };
}

beforeEach(() => {
  localStorage.removeItem(SHOWCASE_THEME_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.removeItem(SHOWCASE_THEME_KEY);
  document.documentElement.removeAttribute('data-theme');
});

describe('showcase theme provider', () => {
  it('keeps its own preference key, apart from the panel', async () => {
    const view = await render(
      <ShowcaseThemeProvider>
        <ThemeProbe />
      </ShowcaseThemeProvider>,
    );
    await flush();

    expect(localStorage.getItem(SHOWCASE_THEME_KEY)).toBe('system');
    expect(localStorage.getItem('keres_admin_theme_preference')).toBeNull();
    await view.unmount();
  });

  it('cycles the preference and repaints <html>', async () => {
    const view = await render(
      <ShowcaseThemeProvider>
        <ThemeProbe />
      </ShowcaseThemeProvider>,
    );
    await flush();
    const cycle = view.container.querySelector('button')!;

    await click(cycle);
    expect(view.container.textContent).toContain('preference:light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await view.unmount();
  });

  it('follows the OS while the preference is system', async () => {
    const os = stubMatchMedia(false);
    const view = await render(
      <ShowcaseThemeProvider>
        <ThemeProbe />
      </ShowcaseThemeProvider>,
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

  it('refuses to be read outside its provider', async () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      await expect(render(<ThemeProbe />)).rejects.toThrow(
        'useShowcaseTheme must be used within ShowcaseThemeProvider',
      );
    } finally {
      console.error = consoleError;
    }
  });
});

describe('palette display names', () => {
  it('names a known palette readably', () => {
    expect(paletteExists('twilight')).toBe(true);
    expect(paletteDisplayName('twilight')).toBe('Twilight');
  });

  it('paints the page with the dark side of the palette at night', () => {
    const light = paletteVars('twilight', 'light');
    const dark = paletteVars('twilight', 'dark');

    expect(light['--story-bg']).not.toBe('');
    expect(dark['--story-bg']).not.toBe('');
    expect(dark['--story-bg']).not.toBe(light['--story-bg']);
  });

  it('falls back to Default when the story names no palette or an unknown one', () => {
    expect(paletteExists(null)).toBe(false);
    expect(paletteExists('from-a-newer-app')).toBe(false);
    expect(paletteDisplayName(null)).toBe('Default');
    expect(paletteDisplayName(undefined)).toBe('Default');
    expect(paletteDisplayName('from-a-newer-app')).toBe('Default');
  });
});
