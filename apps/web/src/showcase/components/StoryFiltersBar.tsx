import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOWCASE_SORTS } from '@keres/shared/metadata/ShowcaseSort';
import type { ShowcaseFacet, ShowcaseFacets, ShowcaseSort } from '@keres/shared';
import { hasActiveFilters, type StoryFilters } from '@/showcase/storyFilters';

/** How long typing rests before the search is asked for: one request per pause, not per key. */
const TYPING_PAUSE_MS = 300;

/**
 * A facet's options for a select, with the current value kept in the list even when the server no longer
 * offers it (a shared address, or a story that was unpublished meanwhile): the control must show what is applied.
 */
function optionsOf(facets: readonly ShowcaseFacet[] | undefined, current: string): ShowcaseFacet[] {
  const options = [...(facets ?? [])];
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, count: 0 });
  }
  return options;
}

/**
 * The search box and filters of the home page. The filters are the address's: this component only reports a
 * change, and the page writes it to the URL.
 */
export function StoryFiltersBar({
  filters,
  facets,
  onChange,
}: {
  filters: StoryFilters;
  facets: ShowcaseFacets | null;
  onChange: (next: StoryFilters) => void;
}) {
  const { t } = useTranslation('showcase');
  const [draft, setDraft] = useState(filters.q);

  // The address changed from elsewhere (clear, back button): the box follows it.
  useEffect(() => {
    setDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (draft.trim() === filters.q.trim()) return;
    const timer = window.setTimeout(() => onChange({ ...filters, q: draft }), TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, filters, onChange]);

  const set = (patch: Partial<StoryFilters>) => onChange({ ...filters, ...patch });

  return (
    <form className="story-filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <input
        type="search"
        className="filter-search"
        aria-label={t('filters.search')}
        placeholder={t('filters.searchPlaceholder')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="filter-row">
        <label className="filter-field">
          <span>{t('filters.genre')}</span>
          <select value={filters.genre} onChange={(event) => set({ genre: event.target.value })}>
            <option value="">{t('filters.any')}</option>
            {optionsOf(facets?.genres, filters.genre).map((option) => (
              <option key={option.value} value={option.value}>
                {option.count > 0 ? `${option.value} (${option.count})` : option.value}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>{t('filters.language')}</span>
          <select
            value={filters.language}
            onChange={(event) => set({ language: event.target.value })}
          >
            <option value="">{t('filters.any')}</option>
            {optionsOf(facets?.languages, filters.language).map((option) => (
              <option key={option.value} value={option.value}>
                {option.count > 0 ? `${option.value} (${option.count})` : option.value}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>{t('filters.type')}</span>
          <select value={filters.type} onChange={(event) => set({ type: event.target.value })}>
            <option value="">{t('filters.any')}</option>
            <option value="linear">{t('story.linear')}</option>
            <option value="branching">{t('story.branching')}</option>
          </select>
        </label>
        <label className="filter-field">
          <span>{t('filters.medium')}</span>
          <select value={filters.medium} onChange={(event) => set({ medium: event.target.value })}>
            <option value="">{t('filters.any')}</option>
            {optionsOf(facets?.mediums, filters.medium).map((option) => (
              <option key={option.value} value={option.value}>
                {t(`story.medium.${option.value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>{t('filters.sort.label')}</span>
          <select
            value={filters.sort}
            onChange={(event) => set({ sort: event.target.value as ShowcaseSort })}
          >
            {SHOWCASE_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`filters.sort.${sort}`)}
              </option>
            ))}
          </select>
        </label>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            className="button-secondary filter-clear"
            onClick={() =>
              onChange({ ...filters, q: '', genre: '', language: '', type: '', medium: '' })
            }
          >
            {t('filters.clear')}
          </button>
        )}
      </div>
    </form>
  );
}
