import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ProfileLink, ShowcaseAuthorPage } from '@keres/shared';
import { fetchAuthor } from '@/showcase/api/showcaseApi';
import { useShowcaseAuth } from '@/showcase/auth/ShowcaseAuthProvider';
import { OwnerAvatar } from '@/showcase/components/OwnerAvatar';
import { StoryCard } from '@/showcase/components/StoryCard';
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
 * palette the author chose for it - only this page, the site's frame stays the site's.
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
  return (
    <section
      className={page.theme ? 'author-page themed' : 'author-page'}
      style={page.theme ? paletteVars(page.theme, resolved) : undefined}
      data-testid="author-page"
    >
      <Link to="/authors" className="back-link">
        {t('author.back')}
      </Link>

      <header className="author-head">
        <OwnerAvatar owner={owner} size={72} />
        <div>
          <h1>{owner.username}</h1>
          <p className="muted">
            #{owner.tag} · {storyCountLabel(t, stories.length)}
          </p>
        </div>
      </header>

      {biography && (
        <section className="author-about">
          <h2>{t('author.aboutTitle')}</h2>
          <p className="author-biography">{biography}</p>
        </section>
      )}

      {links.length > 0 && (
        <section className="author-links-block">
          <h2>{t('author.linksTitle')}</h2>
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
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="author-stories">
        <h2>{t('author.storiesTitle')}</h2>
        <div className="story-grid">
          {stories.map((story) => (
            <StoryCard key={story.storyId} story={story} />
          ))}
        </div>
      </section>
    </section>
  );
}
