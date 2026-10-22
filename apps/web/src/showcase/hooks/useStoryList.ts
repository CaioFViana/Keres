import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShowcaseStoryCard } from '@keres/shared';
import { fetchStories } from '@/showcase/api/showcaseApi';
import { useShowcaseAuth } from '@/showcase/auth/ShowcaseAuthProvider';
import { type StoryFilters } from '@/showcase/storyFilters';

/** How often the list is polled. With an ETag, it almost always costs a 304. */
const POLL_INTERVAL_MS = 30_000;

/** How many stories a page of the list holds; "show more" asks for another one on top. */
export const STORY_PAGE_SIZE = 24;

export interface StoryList {
  stories: ShowcaseStoryCard[] | null;
  /** How many stories match, whatever part of them is loaded. */
  total: number | null;
  error: string | null;
  /** Whether more matching stories wait beyond what is loaded. */
  hasMore: boolean;
  showMore: () => void;
}

/**
 * The home page's list: the stories matching `filters`, the first `pages` pages of them, kept fresh by polling.
 *
 * What is loaded is always a prefix of the answer (offset 0, a growing limit), so the polling tag always
 * describes the whole of it, and a story published meanwhile lands where it belongs instead of at the end.
 */
export function useStoryList(filters: StoryFilters): StoryList {
  const { t } = useTranslation('showcase');
  const { status: authStatus } = useShowcaseAuth();
  const [stories, setStories] = useState<ShowcaseStoryCard[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paging, setPaging] = useState({ asked: '', pages: 1 });
  const etagRef = useRef<string | null>(null);
  const askedRef = useRef('');

  // One key for the question: a different one starts over (its tag and its pages are not the old question's).
  const question = JSON.stringify(filters);
  const pages = paging.asked === question ? paging.pages : 1;
  useEffect(() => {
    askedRef.current = question;
    etagRef.current = null;
  }, [question]);

  const refresh = useCallback(async () => {
    const asked = askedRef.current;
    try {
      const result = await fetchStories(etagRef.current, filters, pages * STORY_PAGE_SIZE);
      // The question moved on while this was on its way: its answer belongs to the old one.
      if (asked !== askedRef.current) return;
      etagRef.current = result.etag;
      // `null` = 304: nothing changed, and overwriting the state would only cause a pointless re-render.
      if (result.stories) {
        setStories(result.stories);
        setTotal(result.total ?? result.stories.length);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('home.loadFailed'));
    }
    // `filters` is read through `question`: a new object with the same content must not refetch.
  }, [question, pages, t]);

  // The listing is per viewer class: signing in or out changes what the server shows, so a
  // class change drops the list and its etag (one class's etag must never validate another's).
  // Polling starts only once the class is known - otherwise the mount fetches twice.
  const seenAuthStatus = useRef(authStatus);
  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }
    if (seenAuthStatus.current !== authStatus) {
      seenAuthStatus.current = authStatus;
      etagRef.current = null;
      setStories(null);
    }
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
  }, [refresh, authStatus]);

  const showMore = useCallback(() => {
    etagRef.current = null;
    setPaging({ asked: question, pages: pages + 1 });
  }, [question, pages]);

  return {
    stories,
    total,
    error,
    hasMore: stories !== null && total !== null && stories.length < total,
    showMore,
  };
}
