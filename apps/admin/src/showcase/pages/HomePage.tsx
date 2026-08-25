import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcaseStoryCard } from '@keres/shared';
import { fetchStories } from '../api/showcaseApi';
import { StoryCard } from '../components/StoryCard';

/** How often the list is polled. With an ETag, it almost always costs a 304. */
const POLL_INTERVAL_MS = 30_000;

export function HomePage() {
  const { t } = useTranslation('showcase');
  const [stories, setStories] = useState<ShowcaseStoryCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchStories(etagRef.current);
      etagRef.current = result.etag;
      // `null` = 304: nothing changed, and overwriting the state would only cause a pointless re-render.
      if (result.stories) {
        setStories(result.stories);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('home.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    // Coming back to the tab is the most likely moment for something new to exist - it is not worth
    // waiting for the next interval tick to find that out.
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-eyebrow">{t('home.eyebrow')}</p>
          <h1 className="hero-title">{t('home.title')}</h1>
          <p className="hero-text">{t('home.intro')}</p>
        </div>
      </section>

      <section className="stories" id="stories">
        <div className="section-head">
          <h2>{t('home.publishedStories')}</h2>
          {stories && <span className="count">{stories.length}</span>}
        </div>

        {error && <p className="error-text">{error}</p>}

        {!stories && !error && <p className="muted">{t('home.loading')}</p>}

        {stories && stories.length === 0 && <p className="empty">{t('home.empty')}</p>}

        {stories && stories.length > 0 && (
          <div className="story-grid">
            {stories.map((story) => (
              <StoryCard key={story.storyId} story={story} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
