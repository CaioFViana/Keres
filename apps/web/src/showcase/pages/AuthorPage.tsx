import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ProfileLink, ShowcaseAuthorPage } from '@keres/shared';
import { fetchAuthor } from '@/showcase/api/showcaseApi';
import { useShowcaseAuth } from '@/showcase/auth/ShowcaseAuthProvider';
import { OwnerAvatar } from '@/showcase/components/OwnerAvatar';
import { StoryCard } from '@/showcase/components/StoryCard';
import { ThreadMark } from '@/showcase/components/ThreadMark';
import { ThreadFork, ThreadPage } from '@/showcase/components/thread/ThreadPage';
import { storyCountLabel } from '@/showcase/format';
import { paletteVars } from '@/showcase/theme/paletteVars';
import { useShowcaseTheme } from '@/showcase/theme/ShowcaseThemeProvider';

/** The host of a link, shown beside its label so the address is not a surprise. Empty for what does not parse. */
function hostOf(link: ProfileLink): string {
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * An author's page: who they are in their own words and every story they have on show. The texts are plain text
 * the author wrote for this page (shown as typed, line breaks kept, never read as markup), and the page wears the
 * palette the author chose for it - its thread, its nodes and its accents; the site's frame stays the site's.
 * The links leave the thread as one branch with a tile per destination.
 */
export function AuthorPage() {
  const { username = '' } = useParams();
  const { t } = useTranslation('showcase');
  const { resolved } = useShowcaseTheme();
  const { status: authStatus } = useShowcaseAuth();
  const [page, setPage] = useState<ShowcaseAuthorPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // What an author shows depends on who is looking (an adults-only shelf): a viewer change asks again.
    if (authStatus === 'loading') return;
    let alive = true;
    setPage(null);
    setError(null);
    fetchAuthor(username)
      .then((loaded) => alive && setPage(loaded))
      .catch(
        (caught) =>
          alive && setError(caught instanceof Error ? caught.message : t('author.loadFailed')),
      );
    return () => {
      alive = false;
    };
  }, [username, authStatus, t]);

  if (error) {
    return (
      <section className="author-page">
        <p className="error-text">{t('author.notFound')}</p>
        <Link to="/authors" className="back-link">
          {t('author.back')}
        </Link>
      </section>
    );
  }
  if (!page) {
    return <p className="muted author-page">{t('author.loading')}</p>;
  }

  const { owner, biography, links, stories } = page;
  const vars = page.theme ? paletteVars(page.theme, resolved) : undefined;
  return (
    <ThreadPage
      className={page.theme ? 'author-page themed' : 'author-page'}
      {...(vars ? { style: vars } : {})}
      testId="author-page"
    >
      <ThreadMark />

      <section className="hero thread-col author-head">
        <Link to="/authors" className="back-link">
          {t('author.back')}
        </Link>
        <OwnerAvatar owner={owner} size={72} />
        <h1 className="hero-title" data-thread-knot data-thread-tint={vars?.['--story-primary']}>
          {owner.username}
        </h1>
        <p className="muted">
          #{owner.tag} · {storyCountLabel(t, stories.length)}
        </p>
        {biography && <p className="author-biography">{biography}</p>}
      </section>

      {links.length > 0 && (
        <ThreadFork count={1}>
          <section className="card author-links-block" data-thread-branch>
            <h2 data-thread-title>{t('author.linksTitle')}</h2>
            <ul className="author-links">
              {links.map((link) => (
                <li key={`${link.label}|${link.url}`}>
                  {/* Written by the author, so: a new tab that knows nothing of this one, and no endorsement. */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    title={t('author.linkOpens')}
                  >
                    <span className="author-link-label">{link.label}</span>
                    <span className="author-link-host">{hostOf(link)}</span>
                    <span className="author-link-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </ThreadFork>
      )}

      <section className="author-stories thread-col">
        <h2 data-thread-knot data-thread-tint={vars?.['--story-primary']}>
          {t('author.storiesTitle')}
        </h2>
        <div className="entry-list">
          {stories.map((story) => (
            <StoryCard key={story.storyId} story={story} />
          ))}
        </div>
      </section>
    </ThreadPage>
  );
}
