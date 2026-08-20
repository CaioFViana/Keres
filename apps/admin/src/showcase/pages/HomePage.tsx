import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcaseStoryCard } from '@keres/shared';
import { fetchStories } from '../api/showcaseApi';
import { StoryCard } from '../components/StoryCard';

/** De quanto em quanto tempo a lista é reconsultada. Com ETag, quase sempre custa um 304. */
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
      // `null` = 304: nada mudou, e sobrescrever o estado só causaria um re-render à toa.
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
    // Voltar para a aba é o momento mais provável de haver algo novo - não vale esperar o
    // próximo tique do intervalo para descobrir isso.
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
