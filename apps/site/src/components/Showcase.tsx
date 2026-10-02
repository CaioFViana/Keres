import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOWCASE_SCREENS, type ShowcaseScreenId } from '../content/catalog';
import { useSiteTheme } from '../theme/SiteThemeProvider';
import { ScreenshotLightbox } from './ScreenshotLightbox';

/** How long a screen stays up before the carousel moves on by itself. */
const AUTOPLAY_INTERVAL_MS = 6000;

/**
 * The app, photographed - one screen at a time.
 *
 * The images come from `apps/desktop/scripts/capture-screens.ts`: the real app opened inside
 * Electron, with an example story installed, in the requested language and theme. There is no
 * HTML replica here - the earlier attempt rebuilt the screens with `react-native-web` and never
 * looked like what the user sees.
 *
 * Ten full-width photos in a column took most of the page's height, so the shots live in a
 * carousel: the caption and the photo of the current screen, with previous/next buttons, dots
 * and a counter. The slides advance on their own, unless the reader pauses them, hovers or
 * focuses the carousel, or asked the system for reduced motion. Keyboard users get arrow keys
 * on top of the buttons.
 *
 * The photos sit side by side on a sliding track inside a framed stage - a window frame with
 * a fixed 16:10 viewport, the ratio of the tallest shots. Moving between slides slides the
 * track instead of swapping the image, and narrower screens letterbox centered instead of
 * collapsing the section, so the page height never snaps. Images load lazily: the browser
 * only downloads the slides near the current one.
 *
 * The page's language and theme pick the file, so the section follows whoever is reading.
 */
export function Showcase() {
  const { t, i18n } = useTranslation();
  const { resolved } = useSiteTheme();
  const language = i18n.language.startsWith('pt') ? 'pt' : 'en';
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState<ShowcaseScreenId | null>(null);
  const [paused, setPaused] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const running = !(paused || suspended || reducedMotion);
  const total = SHOWCASE_SCREENS.length;
  const screen = SHOWCASE_SCREENS[index];
  const openedScreen = SHOWCASE_SCREENS.find((candidate) => candidate.id === opened);
  const source = (id: ShowcaseScreenId) =>
    `${import.meta.env.BASE_URL}showcase/screens/${id}.${language}.${resolved}.png`;

  const goTo = (next: number) => setIndex(((next % total) + total) % total);

  // The timer restarts on every slide change, so touching any control buys a full pause.
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [index, running, total]);

  return (
    <section className="band" id="showcase">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('showcase.title')}</h2>
          <p>{t('showcase.lead')}</p>
        </header>

        <div
          className="showcase-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label={t('showcase.title')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') goTo(index - 1);
            if (event.key === 'ArrowRight') goTo(index + 1);
          }}
          onMouseEnter={() => setSuspended(true)}
          onMouseLeave={() => setSuspended(false)}
          onFocus={() => setSuspended(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setSuspended(false);
            }
          }}
        >
          <div className="showcase-caption" aria-live="polite" aria-atomic="true">
            <h3>{t(`showcase.items.${screen.id}.title`)}</h3>
            <p>{t(`showcase.items.${screen.id}.body`)}</p>
          </div>
          <div className="showcase-stage">
            <div className="showcase-chrome" aria-hidden="true">
              <i />
              <i />
              <i />
              {/* Counts down to the next slide. It restarts with the timer: a change of slide,
                  a pause or a hover remounts it, so it never claims time the timer does not have. */}
              {running && (
                <span
                  key={index}
                  className="showcase-progress"
                  style={{ animationDuration: `${AUTOPLAY_INTERVAL_MS}ms` }}
                />
              )}
            </div>
            <div className="showcase-viewport">
              <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
                {SHOWCASE_SCREENS.map((candidate, candidateIndex) => {
                  const active = candidateIndex === index;
                  return (
                    <div
                      key={candidate.id}
                      className={active ? 'carousel-slide is-active' : 'carousel-slide'}
                      aria-hidden={!active}
                    >
                      {/* Still a link to the file: whoever opens it in a new tab, copies the
                        address, or navigates by keyboard expects that. The ordinary click,
                        though, opens the enlarged photo without taking anyone off the page.
                        Off-screen slides leave the tab order entirely. */}
                      <a
                        className="showcase-window"
                        href={source(candidate.id)}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={active ? undefined : -1}
                        onClick={(event) => {
                          if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.button !== 0
                          ) {
                            return;
                          }
                          event.preventDefault();
                          setOpened(candidate.id);
                        }}
                      >
                        <img
                          src={source(candidate.id)}
                          alt={t(`showcase.items.${candidate.id}.title`)}
                          width={candidate.width}
                          height={candidate.height}
                          loading="lazy"
                        />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="carousel-controls">
            <button
              type="button"
              className="carousel-button"
              aria-label={t('showcase.previous')}
              onClick={() => goTo(index - 1)}
            >
              ‹
            </button>
            <div className="carousel-dots" role="group" aria-label={t('showcase.chooseScreen')}>
              {SHOWCASE_SCREENS.map((candidate, candidateIndex) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={candidateIndex === index ? 'carousel-dot is-active' : 'carousel-dot'}
                  aria-label={t('showcase.showScreen', {
                    title: t(`showcase.items.${candidate.id}.title`),
                  })}
                  aria-current={candidateIndex === index}
                  onClick={() => goTo(candidateIndex)}
                />
              ))}
            </div>
            <p className="carousel-counter">
              {t('showcase.counter', { current: index + 1, total })}
            </p>
            {!reducedMotion && (
              <button
                type="button"
                className="carousel-button carousel-toggle"
                aria-label={paused ? t('showcase.play') : t('showcase.pause')}
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3 1.5v11l8.5-5.5z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="2.5" y="1.5" width="3.5" height="11" rx="1" />
                    <rect x="8" y="1.5" width="3.5" height="11" rx="1" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              className="carousel-button"
              aria-label={t('showcase.next')}
              onClick={() => goTo(index + 1)}
            >
              ›
            </button>
          </div>
        </div>
        <p className="showcase-note">{t('showcase.note')}</p>

        {openedScreen && (
          <ScreenshotLightbox
            source={source(openedScreen.id)}
            title={t(`showcase.items.${openedScreen.id}.title`)}
            width={openedScreen.width}
            height={openedScreen.height}
            onClose={() => setOpened(null)}
          />
        )}
      </div>
    </section>
  );
}
