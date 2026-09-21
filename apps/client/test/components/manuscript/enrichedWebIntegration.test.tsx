/**
 * @jest-environment jsdom
 */
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { EnrichedTextInputInstance } from 'react-native-enriched-html';

// The global setup mocks the lib (native views don't exist in tests); this
// file mounts the REAL web build to verify the production path end to end.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- requireActual bypasses the mock.
const { EnrichedTextInput: RealInput } = jest.requireActual(
  'react-native-enriched-html',
) as unknown as { EnrichedTextInput: React.ComponentType<Record<string, unknown>> };

// The client tsconfig has no DOM lib (React Native project): reach the jsdom
// globals through globalThis instead of bare `document`/`window` references.
const dom = () =>
  globalThis as unknown as {
    document: {
      createElement(tag: string): { [key: string]: unknown };
      body: { appendChild(node: unknown): void };
    };
    window: Record<string, unknown>;
    Element: { prototype: Record<string, unknown> };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

function installDomStubs() {
  const g = dom();
  g.IS_REACT_ACT_ENVIRONMENT = true;
  g.window.scrollTo = g.window.scrollTo ?? (() => {});
  g.window.matchMedia =
    g.window.matchMedia ??
    (() => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }));
  g.window.ResizeObserver =
    g.window.ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  g.Element.prototype.scrollIntoView = g.Element.prototype.scrollIntoView ?? (() => {});
}

function lastHtmlValue(onChangeHtml: jest.Mock): string | undefined {
  const calls = onChangeHtml.mock.calls as { nativeEvent?: { value?: unknown } }[][];
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const value = calls[i][0]?.nativeEvent?.value;
    if (typeof value === 'string') return value;
  }
  return undefined;
}

describe('enriched-html web integration (real build)', () => {
  beforeEach(installDomStubs);

  it('mounts, emits initial HTML, and pushes setValue through', async () => {
    const { document } = dom();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container as unknown as Element);
    const ref = createRef<EnrichedTextInputInstance>();
    const onChangeHtml = jest.fn();

    await act(async () => {
      root.render(
        createElement(RealInput, {
          ref,
          defaultValue: '<p>saved</p>',
          onChangeHtml,
          editable: true,
        }),
      );
    });
    // The mount emit races the initial setContent: the first emission is the
    // empty shell, the content transaction lands on a later tick.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(lastHtmlValue(onChangeHtml)).toContain('saved');
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.setValue).toBe('function');

    await act(async () => {
      ref.current?.setValue('<p>restored prose</p>');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(lastHtmlValue(onChangeHtml)).toContain('restored prose');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the pushed restore visible when it lands before the remount', async () => {
    const { document } = dom();
    const container = document.createElement('div') as unknown as {
      querySelector(sel: string): { textContent: string | null } | null;
    } & Record<string, unknown>;
    const { document: doc2 } = dom();
    doc2.body.appendChild(container);
    const root = createRoot(container as unknown as Element);
    const ref = createRef<EnrichedTextInputInstance>();
    const onChangeHtml = jest.fn();
    const visual = () => container.querySelector('.ProseMirror')?.textContent ?? null;

    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-false',
          ref,
          defaultValue: '',
          onChangeHtml,
          editable: false,
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Restore lands on the first mount, then the role resolves (remount).
    await act(async () => {
      ref.current?.setValue('<p>restored prose</p>');
    });
    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-true',
          ref,
          defaultValue: '<html><p>restored prose</p></html>',
          onChangeHtml,
          editable: true,
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(visual()).toContain('restored prose');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps the pushed restore visible when it lands after the remount', async () => {
    const { document } = dom();
    const container = document.createElement('div') as unknown as {
      querySelector(sel: string): { textContent: string | null } | null;
    } & Record<string, unknown>;
    const { document: doc2 } = dom();
    doc2.body.appendChild(container);
    const root = createRoot(container as unknown as Element);
    const ref = createRef<EnrichedTextInputInstance>();
    const onChangeHtml = jest.fn();
    const visual = () => container.querySelector('.ProseMirror')?.textContent ?? null;

    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-false',
          ref,
          defaultValue: '',
          onChangeHtml,
          editable: false,
        }),
      );
    });
    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-true',
          ref,
          defaultValue: '',
          onChangeHtml,
          editable: true,
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Restore lands after the remount settled, like a slow draft read.
    await act(async () => {
      ref.current?.setValue('<p>restored prose</p>');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(visual()).toContain('restored prose');

    await act(async () => {
      root.unmount();
    });
  });

  it('reseeds from the default after a remount', async () => {
    const { document } = dom();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container as unknown as Element);
    const ref = createRef<EnrichedTextInputInstance>();
    const onChangeHtml = jest.fn();

    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-false',
          ref,
          defaultValue: '<p>seed</p>',
          onChangeHtml,
          editable: false,
        }),
      );
    });

    await act(async () => {
      root.render(
        createElement(RealInput, {
          key: 'editable-true',
          ref,
          defaultValue: '<p>restored prose</p>',
          onChangeHtml,
          editable: true,
        }),
      );
    });

    expect(lastHtmlValue(onChangeHtml)).toContain('restored prose');

    await act(async () => {
      root.unmount();
    });
  });
});
