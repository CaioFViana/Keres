import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import type { ShowcasePage } from '@/src/services/api/ShowcaseApiService';
import { SHOWCASE_PAGE_SIZE } from '@/src/utils/format/showcaseFilters';
import { logger } from '@/src/utils/logging/logger';

export interface PagedShowcase<T> {
  items: T[];
  /** The match count, when the server says it. */
  total: number | null;
  /** The first page is on its way (or being read again after the query changed). */
  loading: boolean;
  loadingMore: boolean;
  failed: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** The pages read after the first, which belong to that first read and go with it. */
interface MorePages<T> {
  base: ShowcasePage<T>;
  items: T[];
  total: number | null;
  lastPageFull: boolean;
  loading: boolean;
  failed: boolean;
}

const NO_ITEMS: never[] = [];

/**
 * A list of the public site read a page at a time: the first page when the query (`queryKey`) changes, the next
 * on request. An answer to a query that is no longer the current one is dropped. With no total from the server
 * (a browser reading another origin cannot see the header) a full page is taken to mean there may be more.
 */
export function usePagedShowcase<T>(
  queryKey: string,
  fetchPage: (offset: number, limit: number) => Promise<ShowcasePage<T>>,
  enabled: boolean,
): PagedShowcase<T> {
  // The latest fetcher without making the read depend on its identity: the query key says when it changes.
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const load = useMemo(
    () => (enabled ? () => fetchRef.current(0, SHOWCASE_PAGE_SIZE) : null),
    [enabled],
  );
  const first = useLoadedResource<ShowcasePage<T> | null>({
    load,
    initial: null,
    resetKey: queryKey,
    label: 'the showcase list',
    quiet: true,
  });

  // A new first read (another query, a reload) starts the list over: its pages are dropped with it.
  const [moreState, setMoreState] = useState<MorePages<T> | null>(null);
  const more = moreState && moreState.base === first.data ? moreState : null;

  const items =
    more && first.data ? [...first.data.items, ...more.items] : (first.data?.items ?? NO_ITEMS);
  const total = more ? more.total : (first.data?.total ?? null);
  const lastPageFull = more
    ? more.lastPageFull
    : first.data
      ? first.data.items.length >= SHOWCASE_PAGE_SIZE
      : false;
  const hasMore = total !== null ? items.length < total : lastPageFull;
  const failed = first.failed || (more?.failed ?? false);
  const loadingMore = more?.loading ?? false;

  const loadMore = useCallback(() => {
    const base = first.data;
    if (!base || first.loading || loadingMore || !hasMore || failed) return;
    const known = more ? more.items : [];
    setMoreState({
      base,
      items: known,
      total: more ? more.total : base.total,
      lastPageFull: more ? more.lastPageFull : false,
      loading: true,
      failed: false,
    });
    fetchRef
      .current(base.items.length + known.length, SHOWCASE_PAGE_SIZE)
      .then((page) => {
        setMoreState((current) =>
          current && current.base === base
            ? {
                ...current,
                items: [...current.items, ...page.items],
                total: page.total,
                lastPageFull: page.items.length >= SHOWCASE_PAGE_SIZE,
                loading: false,
              }
            : current,
        );
      })
      .catch((error) => {
        logger.debug('usePagedShowcase: could not read more.', error);
        setMoreState((current) =>
          current && current.base === base
            ? { ...current, lastPageFull: false, loading: false, failed: true }
            : current,
        );
      });
  }, [first.data, first.loading, loadingMore, hasMore, failed, more]);

  return {
    items,
    total,
    loading: first.loading,
    loadingMore,
    failed,
    hasMore,
    loadMore,
    reload: first.retry,
  };
}
