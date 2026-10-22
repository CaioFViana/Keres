import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ShowcaseAuthorCard } from '@keres/shared';
import { fetchAuthors } from '@/showcase/api/showcaseApi';
import { useShowcaseAuth } from '@/showcase/auth/ShowcaseAuthProvider';
import { AuthorCard } from '@/showcase/components/AuthorCard';
import { ThreadMark } from '@/showcase/components/ThreadMark';
import { ThreadPage } from '@/showcase/components/thread/ThreadPage';

/** How many authors a page of the directory holds; "show more" asks for another one on top. */
const AUTHOR_PAGE_SIZE = 48;

/** How long typing rests before the search is asked for. */
const TYPING_PAUSE_MS = 300;

/** The people who published here, searchable by name. The search lives in the address, like the home page's. */
export function AuthorsPage() {
  const { t } = useTranslation('showcase');
  const { status: authStatus } = useShowcaseAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const [pages, setPages] = useState(1);
  const [authors, setAuthors] = useState<ShowcaseAuthorCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    if (draft.trim() === q.trim()) return;
    const timer = window.setTimeout(
      () => setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true }),
      TYPING_PAUSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [draft, q, setParams]);

  // A new search starts from its first page.
  useEffect(() => setPages(1), [q]);

  useEffect(() => {
    if (authStatus === 'loading') return;
    let alive = true;
    fetchAuthors(q, pages * AUTHOR_PAGE_SIZE)
      .then((result) => {
        if (!alive) return;
        setAuthors(result.authors);
        setTotal(result.total);
        setError(null);
      })
      .catch(
        (caught) =>
          alive && setError(caught instanceof Error ? caught.message : t('authors.loadFailed')),
      );
    return () => {
      alive = false;
    };
  }, [q, pages, authStatus, t]);

  return (
    <ThreadPage>
      <ThreadMark />
      <section className="hero thread-col">
        <div className="hero-inner">
          <h1 className="hero-title" data-thread-knot>
            {t('authors.title')}
          </h1>
          <p className="hero-text">{t('authors.intro')}</p>
        </div>
      </section>

      <section className="stories thread-col">
        <div className="section-head">
          <h2>{t('authors.title')}</h2>
          {authors && <span className="count">{total}</span>}
        </div>

        <form className="story-filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <input
            type="search"
            className="filter-search"
            aria-label={t('authors.search')}
            placeholder={t('authors.searchPlaceholder')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </form>

        {error && <p className="error-text">{error}</p>}
        {!authors && !error && <p className="muted">{t('authors.loading')}</p>}
        {authors && authors.length === 0 && (
          <p className="empty">{t(q ? 'authors.noResults' : 'authors.empty')}</p>
        )}
        {authors && authors.length > 0 && (
          <div className="entry-list">
            {authors.map((author) => (
              <AuthorCard key={author.owner.username} author={author} />
            ))}
          </div>
        )}
        {authors && authors.length < total && (
          <div className="show-more">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setPages((current) => current + 1)}
            >
              {t('authors.showMore')}
            </button>
          </div>
        )}
      </section>
    </ThreadPage>
  );
}
