import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lastPageFull, setLastPageFull] = useState(false);
  const [reloads, setReloads] = useState(0);
  // The latest fetcher without making the effect depend on its identity: the query key says when it changes.
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });
  const generation = useRef(0);
  /** Makes every answer still on its way stale: a newer query was started, or the list is gone. */
  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const mine = ++generation.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the first page of a new query.
    setLoading(true);
    setLoadingMore(false);
    setFailed(false);
    fetchRef
      .current(0, SHOWCASE_PAGE_SIZE)
      .then((page) => {
        if (mine !== generation.current) return;
        setItems(page.items);
        setTotal(page.total);
        setLastPageFull(page.items.length >= SHOWCASE_PAGE_SIZE);
      })
      .catch((error) => {
        if (mine !== generation.current) return;
        logger.debug('usePagedShowcase: could not read the list.', error);
        setItems([]);
        setTotal(null);
        setLastPageFull(false);
        setFailed(true);
      })
      .finally(() => {
        if (mine === generation.current) setLoading(false);
      });
    return invalidate;
  }, [queryKey, enabled, reloads, invalidate]);

  const hasMore = total !== null ? items.length < total : lastPageFull;

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || failed) return;
    const mine = generation.current;
    setLoadingMore(true);
    fetchRef
      .current(items.length, SHOWCASE_PAGE_SIZE)
      .then((page) => {
        if (mine !== generation.current) return;
        setItems((current) => [...current, ...page.items]);
        setTotal(page.total);
        setLastPageFull(page.items.length >= SHOWCASE_PAGE_SIZE);
      })
      .catch((error) => {
        if (mine !== generation.current) return;
        logger.debug('usePagedShowcase: could not read more.', error);
        setLastPageFull(false);
        setFailed(true);
      })
      .finally(() => {
        if (mine === generation.current) setLoadingMore(false);
      });
  }, [loading, loadingMore, hasMore, failed, items.length]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  return { items, total, loading, loadingMore, failed, hasMore, loadMore, reload };
}
