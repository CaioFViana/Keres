import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ShowcaseFacets } from '@keres/shared';
import { fetchFacets } from '@/showcase/api/showcaseApi';
import { useShowcaseAuth } from '@/showcase/auth/ShowcaseAuthProvider';
import { StoryCard } from '@/showcase/components/StoryCard';
import { StoryFiltersBar } from '@/showcase/components/StoryFiltersBar';
import { ThreadMark } from '@/showcase/components/ThreadMark';
import { ThreadPage } from '@/showcase/components/thread/ThreadPage';
import { useShowcaseConfig } from '@/showcase/config/ShowcaseConfigProvider';
import { useStoryList } from '@/showcase/hooks/useStoryList';
import {
  filtersFromParams,
  hasActiveFilters,
  paramsFromFilters,
  type StoryFilters,
} from '@/showcase/storyFilters';

/** What the filters offer: counted over what this viewer may see, so it is asked again when the viewer changes. */
function useFacets(): ShowcaseFacets | null {
  const { status: authStatus } = useShowcaseAuth();
  const [facets, setFacets] = useState<ShowcaseFacets | null>(null);
  useEffect(() => {
    if (authStatus === 'loading') return;
    let alive = true;
    // The filters are an extra: without their counts the search box and the list still work.
    fetchFacets()
      .then((loaded) => alive && setFacets(loaded))
      .catch(() => alive && setFacets(null));
    return () => {
      alive = false;
    };
  }, [authStatus]);
  return facets;
}

export function HomePage() {
  const { t } = useTranslation('showcase');
  const config = useShowcaseConfig();
  const { seesNsfw, viewer } = useShowcaseAuth();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const facets = useFacets();
  const { stories, total, error, hasMore, showMore } = useStoryList(filters);

  // The address is where the search lives: it can be shared, and the back button undoes a filter.
  const change = useCallback(
    (next: StoryFilters) => setParams(paramsFromFilters(next), { replace: true }),
    [setParams],
  );
  const narrowed = hasActiveFilters(filters);

  return (
    <ThreadPage>
      <ThreadMark />
      <section className="hero thread-col">
        <div className="hero-inner">
          <p className="hero-eyebrow">
            {config?.siteName
              ? t('home.eyebrowWithSite', { siteName: config.siteName })
              : t('home.eyebrow')}
          </p>
          <h1 className="hero-title" data-thread-knot>
            {t('home.title')}
          </h1>
          <p className="hero-text">{t('home.intro')}</p>
        </div>
      </section>

      <section className="stories thread-col" id="stories">
        <div className="section-head">
          <h2>{t('home.publishedStories')}</h2>
          {stories && (
            <span className="count">
              {narrowed && total !== null && total !== stories.length
                ? t('home.resultsOf', { shown: stories.length, total })
                : (total ?? stories.length)}
            </span>
          )}
        </div>

        <StoryFiltersBar filters={filters} facets={facets} onChange={change} />

        {error && <p className="error-text">{error}</p>}

        {!stories && !error && <p className="muted">{t('home.loading')}</p>}

        {!seesNsfw && (
          <p className="muted">
            {t(viewer?.isAdultVerified ? 'home.adultHintOptIn' : 'home.adultHint')}
          </p>
        )}

        {stories && stories.length === 0 && (
          <p className="empty">{t(narrowed ? 'home.noResults' : 'home.empty')}</p>
        )}

        {stories && stories.length > 0 && (
          <div className="entry-list">
            {stories.map((story) => (
              <StoryCard key={story.storyId} story={story} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="show-more">
            <button type="button" className="button-secondary" onClick={showMore}>
              {t('home.showMore')}
            </button>
          </div>
        )}
      </section>
    </ThreadPage>
  );
}
