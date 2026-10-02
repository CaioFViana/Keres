import { StrictMode } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Showcase } from '../../src/components/Showcase';
import { SHOWCASE_SCREENS } from '../../src/content/catalog';
import { SiteThemeProvider } from '../../src/theme/SiteThemeProvider';
import siteEn from '../../src/i18n/locales/site.en.json';
import { click, render } from '../helpers/react';

const renderShowcase = () =>
  render(
    <StrictMode>
      <SiteThemeProvider>
        <Showcase />
      </SiteThemeProvider>
    </StrictMode>,
  );

async function pressKey(element: Element, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

async function hover(element: Element): Promise<void> {
  await act(async () => {
    // React derives enter/leave from over/out, so those are what the test dispatches.
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  });
}

async function unhover(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
  });
}

async function advanceTime(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const titleOf = (id: string) =>
  (siteEn.showcase.items as Record<string, { title: string }>)[id].title;

const captionTitle = (container: HTMLElement) =>
  container.querySelector('.showcase-caption h3')?.textContent;

const activeSlide = (container: HTMLElement) =>
  container.querySelector('.carousel-slide.is-active')!;

describe('showcase carousel', () => {
  it('marks one slide active, hiding the rest from readers and tabs', async () => {
    const { container, unmount } = await renderShowcase();

    expect(container.querySelectorAll('.carousel-slide')).toHaveLength(SHOWCASE_SCREENS.length);
    expect(container.querySelectorAll('.carousel-slide.is-active')).toHaveLength(1);
    expect(captionTitle(container)).toBe(titleOf('narrative-elements'));
    expect(container.querySelector('.carousel-counter')?.textContent).toBe(
      `1 of ${SHOWCASE_SCREENS.length}`,
    );
    expect(container.querySelectorAll('.carousel-dot')).toHaveLength(SHOWCASE_SCREENS.length);

    const slides = [...container.querySelectorAll('.carousel-slide')];
    expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    expect(slides[1].getAttribute('aria-hidden')).toBe('true');
    expect(slides[0].querySelector('a')?.getAttribute('tabindex')).toBeNull();
    expect(slides[1].querySelector('a')?.getAttribute('tabindex')).toBe('-1');

    await unmount();
  });

  it('slides the track one viewport per screen', async () => {
    const { container, unmount } = await renderShowcase();
    const track = container.querySelector('.carousel-track') as HTMLElement;
    expect(track.style.transform).toBe('translateX(-0%)');

    await click(container.querySelector('[aria-label="Next screen"]')!);
    expect(track.style.transform).toBe('translateX(-100%)');
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    await unmount();
  });

  it('moves forward and back, wrapping around both ends', async () => {
    const { container, unmount } = await renderShowcase();
    const previous = container.querySelector('[aria-label="Previous screen"]')!;
    const next = container.querySelector('[aria-label="Next screen"]')!;

    await click(next);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    await click(previous);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[0].id));

    await click(previous);
    const last = SHOWCASE_SCREENS[SHOWCASE_SCREENS.length - 1].id;
    expect(captionTitle(container)).toBe(titleOf(last));
    expect(container.querySelector('.carousel-counter')?.textContent).toBe(
      `${SHOWCASE_SCREENS.length} of ${SHOWCASE_SCREENS.length}`,
    );

    await click(next);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[0].id));

    await unmount();
  });

  it('jumps to the dot screen and marks it current', async () => {
    const { container, unmount } = await renderShowcase();

    const dots = [...container.querySelectorAll('.carousel-dot')];
    expect(dots[0].getAttribute('aria-current')).toBe('true');

    await click(dots[3]);

    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[3].id));
    expect(dots[3].getAttribute('aria-current')).toBe('true');
    expect(dots[0].getAttribute('aria-current')).toBe('false');

    await unmount();
  });

  it('answers to the arrow keys', async () => {
    const { container, unmount } = await renderShowcase();
    const carousel = container.querySelector('.showcase-carousel')!;

    await pressKey(carousel, 'ArrowRight');
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    await pressKey(carousel, 'ArrowLeft');
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[0].id));

    await unmount();
  });

  it('frames the photo in a fixed stage with window chrome', async () => {
    const { container, unmount } = await renderShowcase();

    const stage = container.querySelector('.showcase-stage')!;
    expect(stage.querySelector('.showcase-viewport .showcase-window')).not.toBeNull();
    const chrome = stage.querySelector('.showcase-chrome')!;
    expect(chrome.getAttribute('aria-hidden')).toBe('true');
    expect(chrome.querySelectorAll('i')).toHaveLength(3);

    await unmount();
  });

  it('advances on its own, and the pause toggle stops it', async () => {
    vi.useFakeTimers();
    const { container, unmount } = await renderShowcase();

    await advanceTime(6000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    const toggle = container.querySelector('.carousel-toggle')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe(siteEn.showcase.play);

    await advanceTime(12000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    await click(toggle);
    await advanceTime(6000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[2].id));

    await unmount();
  });

  it('holds still while hovered and resumes after', async () => {
    vi.useFakeTimers();
    const { container, unmount } = await renderShowcase();
    const carousel = container.querySelector('.showcase-carousel')!;

    await hover(carousel);
    await advanceTime(12000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[0].id));

    await unhover(carousel);
    await advanceTime(6000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[1].id));

    await unmount();
  });

  it('never autoplays for reduced motion, and offers no toggle', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const { container, unmount } = await renderShowcase();

    await advanceTime(12000);
    expect(captionTitle(container)).toBe(titleOf(SHOWCASE_SCREENS[0].id));
    expect(container.querySelector('.carousel-toggle')).toBeNull();

    await unmount();
  });

  it('opens the lightbox on the current screen, not the first', async () => {
    const { container, unmount } = await renderShowcase();

    await click([...container.querySelectorAll('.carousel-dot')][2]);
    await click(activeSlide(container).querySelector('.showcase-window')!);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain(
      `showcase/screens/${SHOWCASE_SCREENS[2].id}`,
    );

    await unmount();
  });
});
