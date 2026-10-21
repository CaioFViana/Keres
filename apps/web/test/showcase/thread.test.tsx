import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { ThreadFork, ThreadPage } from '@/showcase/components/thread/ThreadPage';
import { render } from '@test/helpers/react';

/** jsdom lays nothing out: each marked element says where it would be, as `data-rect="x,y,width,height"`. */
function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const [x = 0, y = 0, width = 0, height = 0] = (this.getAttribute('data-rect') ?? '')
      .split(',')
      .map(Number);
    return {
      x,
      y,
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

/** jsdom computes no custom property from a stylesheet or a style attribute: the rail is read from the frame's own style. */
function stubRail() {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (element: Element, pseudo?: string | null) => {
      const style = original(element, pseudo);
      return new Proxy(style, {
        get: (target, key) =>
          key === 'getPropertyValue'
            ? (name: string) => (name === '--thread-rail' ? '40px' : target.getPropertyValue(name))
            : Reflect.get(target, key),
      });
    },
  );
}

function stubMedia(matching: (query: string) => boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const rail = { '--thread-rail': '40px' } as React.CSSProperties;

/** A page of every marker: the mark, a heading, a row of three branches, a branching heading and the end. */
function Page({ stacked = false }: { stacked?: boolean }) {
  return (
    <ThreadPage testId="page" style={rail}>
      <div data-thread-origin data-ox="0.5" data-oy="1" data-rect="0,0,80,80" />
      <h2 data-thread-knot data-thread-tint="var(--tint-a)" data-rect="76,200,300,40">
        Knot
      </h2>
      <div data-thread-fork data-rect="0,300,900,300">
        <div data-thread-branch data-rect="76,380,200,120" />
        <div data-thread-branch data-rect={stacked ? '76,540,200,140' : '300,380,200,140'} />
        <div data-thread-branch data-rect={stacked ? '76,700,200,110' : '524,380,200,110'} />
      </div>
      <h2 data-thread-knot data-thread-branching data-rect="76,700,300,40">
        Branching
      </h2>
      <h2 data-thread-end data-rect="76,900,300,40">
        End
      </h2>
    </ThreadPage>
  );
}

const count = (container: Element, selector: string) => container.querySelectorAll(selector).length;

beforeEach(() => {
  stubLayout();
  stubRail();
  stubMedia(() => false);
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the thread', () => {
  it('draws one lit stroke over every dashed one, and a node at each knot, fork and branch', async () => {
    const { container, unmount } = await render(<Page />);

    const base = count(container, '.thread-base');
    expect(base).toBeGreaterThan(0);
    expect(count(container, '.thread-lit')).toBe(base);
    // Two knots and the end (7 each), the fork's entry and exit, and a node at the top and the bottom of each branch.
    expect(count(container, '.thread-dot')).toBe(3 + 2 + 6);
    expect(container.querySelector('.thread-dot[style*="--tint"]')).not.toBeNull();
    expect(container.querySelector('svg.thread')?.getAttribute('aria-hidden')).toBe('true');
    await unmount();
  });

  it('spreads a row of branches into strands that fan out and gather again', async () => {
    const { container, unmount } = await render(<Page />);

    // Each of the three branches has a strand in and a strand out.
    const strands = [...container.querySelectorAll('.thread-base')].map(
      (path) => path.getAttribute('d') ?? '',
    );
    const arriving = strands.filter((d) => d.startsWith('M40,312 C40,'));
    expect(arriving).toHaveLength(3);
    await unmount();
  });

  it('stacks the branches on the rail on a narrow screen, with an elbow to each', async () => {
    stubMedia((query) => query.includes('max-width'));
    // Stacked, the branches are one under another.
    const { container, unmount } = await render(<Page stacked />);

    const elbows = [...container.querySelectorAll('.thread-base')].filter((path) =>
      /\sQ\d/.test(path.getAttribute('d') ?? ''),
    );
    expect(elbows).toHaveLength(3);
    await unmount();
  });

  it('adds a small fork to a branching heading, and a cut at the end', async () => {
    const { container, unmount } = await render(<Page />);
    const small = (d: RegExp) =>
      [...container.querySelectorAll('.thread-base')].filter((p) =>
        d.test(p.getAttribute('d') ?? ''),
      );

    // The glyph leaves the knot rightwards twice, once up and once down; two frayed ends hang under the end.
    expect(small(/^M40,[\d.]+ C52,[\d.]+ 50,[\d.]+ 64,[\d.]+$/)).toHaveLength(2);
    expect(small(/^M40,[\d.]+ C42,/)).toHaveLength(1);
    expect(small(/^M40,[\d.]+ C39,/)).toHaveLength(1);
    await unmount();
  });

  it('lights what the reader has passed, and only that', async () => {
    const { container, unmount } = await render(<Page />);
    // The line sits at 62% of a window 1000 high: 620. The knot at 220 is passed, the end at 920 is not.
    const dots = [...container.querySelectorAll('.thread-dot')];
    expect(dots.some((dot) => dot.classList.contains('is-on'))).toBe(true);
    expect(dots.some((dot) => !dot.classList.contains('is-on'))).toBe(true);
    await unmount();
  });

  it('follows the scroll', async () => {
    const { container, unmount } = await render(<Page />);
    const lit = () => count(container, '.thread-dot.is-on');
    const before = lit();

    stubLayout();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 2000 });
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(lit()).toBeGreaterThan(before);
    await unmount();
  });

  it('is fully drawn for whoever asks for less motion', async () => {
    stubMedia((query) => query.includes('prefers-reduced-motion'));
    const { container, unmount } = await render(<Page />);

    expect(count(container, '.thread-dot.is-on')).toBe(count(container, '.thread-dot'));
    await unmount();
  });

  it('draws again when the page changes, and stops listening once it is gone', async () => {
    const { container, unmount } = await render(<Page />);
    const frame = container.querySelector('[data-testid="page"]') as HTMLElement;

    await act(async () => {
      const heading = document.createElement('h2');
      heading.setAttribute('data-thread-knot', '');
      heading.setAttribute('data-rect', '76,1000,300,40');
      frame.querySelector('.thread-content')?.append(heading);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(count(container, '.thread-dot')).toBe(3 + 2 + 6 + 1);

    await unmount();
    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
  });

  it('carries the page class and style it is given, which is how a palette tints the thread', async () => {
    const { container, unmount } = await render(
      <ThreadPage
        className="themed"
        style={{ '--page-tint': '#123456' } as React.CSSProperties}
        testId="themed"
      >
        <div />
      </ThreadPage>,
    );
    const frame = container.querySelector('[data-testid="themed"]') as HTMLElement;

    expect(frame.className).toBe('thread-page themed');
    expect(frame.style.getPropertyValue('--page-tint')).toBe('#123456');
    await unmount();
  });
});

describe('the thread on pages that start differently', () => {
  it('starts at its first marker when there is no mark to leave from, and stops at an empty fork', async () => {
    const { container, unmount } = await render(
      <ThreadPage style={rail}>
        <div data-thread-fork data-rect="0,100,900,200" />
        <h2 data-thread-end data-rect="76,400,300,40">
          End
        </h2>
      </ThreadPage>,
    );

    // The fork's entry and exit, and the end: nodes with no branch between them.
    expect(count(container, '.thread-dot')).toBe(3);
    await unmount();
  });

  it('leaves a mark that gives no place to leave from at its middle and bottom', async () => {
    const { container, unmount } = await render(
      <ThreadPage style={rail}>
        <div data-thread-origin data-rect="0,0,80,80" />
        <h2 data-thread-knot data-rect="76,200,300,40">
          Knot
        </h2>
      </ThreadPage>,
    );

    expect(container.querySelector('.thread-base')?.getAttribute('d')).toMatch(/^M40,80 C40,98 /);
    await unmount();
  });

  it('starts at a heading when nothing came before it', async () => {
    const { container, unmount } = await render(
      <ThreadPage style={rail}>
        <h2 data-thread-knot data-rect="76,200,300,40">
          Knot
        </h2>
      </ThreadPage>,
    );

    expect(count(container, '.thread-dot')).toBe(1);
    expect(count(container, '.thread-base')).toBe(0);
    await unmount();
  });

  it('redraws when the page changes size, where the browser can say so', async () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const { container, unmount } = await render(<Page />);
    const before = container.querySelector('svg.thread')?.getAttribute('height');

    // The page grows; the observer tells the thread.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return {
        x: 0,
        y: 0,
        width: 900,
        height: 5000,
        left: 0,
        top: 0,
        right: 900,
        bottom: 5000,
        toJSON: () => ({}),
      } as DOMRect;
    });
    await act(async () => {
      callbacks.forEach((callback) => callback());
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(callbacks).toHaveLength(1);
    expect(container.querySelector('svg.thread')?.getAttribute('height')).not.toBe(before);
    await unmount();
  });
});

describe('a fork of the thread', () => {
  it('says how many branches it has, and sits side by side only where there is room for many', async () => {
    const { container, unmount } = await render(
      <>
        <ThreadFork count={1}>
          <div />
        </ThreadFork>
        <ThreadFork count={4} wide className="pillar-grid">
          <div />
        </ThreadFork>
        <ThreadFork count={3}>
          <div />
        </ThreadFork>
      </>,
    );
    const [single, wide, plain] = [
      ...container.querySelectorAll('[data-thread-fork]'),
    ] as HTMLElement[];

    expect(single.className).toBe('thread-fork is-single');
    expect(wide.className).toBe('thread-fork is-wide');
    expect(wide.querySelector('.thread-branches')?.className).toBe('thread-branches pillar-grid');
    expect(
      (wide.querySelector('.thread-branches') as HTMLElement).style.getPropertyValue('--cols'),
    ).toBe('4');
    expect(plain.className).toBe('thread-fork');
    expect(plain.querySelector('.thread-branches')?.className).toBe('thread-branches');
    await unmount();
  });
});
