import type { ShowcaseStoryCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authorPath, formatBytes, formatDate, genreList } from '@/showcase/format';
import { paletteVars } from '@/showcase/theme/paletteVars';
import { useShowcaseTheme } from '@/showcase/theme/ShowcaseThemeProvider';
import { OwnerAvatar } from './OwnerAvatar';
import { StoryCover } from './StoryCover';

/**
 * One published story in a list: a node on the thread, with its title, its publisher, what it is about and its
 * latest version. A branching story carries a small fork on its node.
 */
export function StoryCard({ story }: { story: ShowcaseStoryCard }) {
  const { resolved } = useShowcaseTheme();
  const { t, i18n } = useTranslation('showcase');
  const { snapshot, owner, latestVersion } = story;
  // Only the node and the accents use the story's palette in a listing - the whole page is tinted only when the story
  // is opened, so the showcase does not turn into an unreadable mosaic.
  const vars = paletteVars(snapshot.theme, resolved);
  const branching = snapshot.type === 'branching';
  const genres = genreList(snapshot.genre);

  return (
    <article className="story-card entry" style={vars}>
      <div className="entry-body">
        <h2
          className="entry-title"
          data-thread-knot
          data-thread-tint={vars['--story-primary']}
          {...(branching ? { 'data-thread-branching': '' } : {})}
        >
          <Link to={`/story/${story.storyId}`}>{snapshot.title}</Link>
        </h2>

        <div className="entry-badges">
          <span className={`badge badge-${snapshot.type}`}>{t(`story.${snapshot.type}`)}</span>
          {story.isNsfw && <span className="badge badge-adult">{t('story.adultsOnly')}</span>}
        </div>

        {/*
          Author and publisher are different things: the author is free text from the story
          (it may be a pseudonym, a team, or "public domain" on a work the person only
          transcribed), and the publisher is the account that uploaded the package. With no
          declared author, the card shows only the publisher - passing the account name off
          as the author would attribute to it a work that may not be theirs.
        */}
        <Link to={authorPath(owner.username)} className="owner">
          <OwnerAvatar owner={owner} size={26} />
          <span className="owner-name">
            {snapshot.author ? (
              <>
                {snapshot.author}
                <span className="owner-tag">
                  {t('story.publishedBy', { username: owner.username, tag: owner.tag })}
                </span>
              </>
            ) : (
              <>
                {owner.username}
                <span className="owner-tag">
                  #{owner.tag} · {t('story.publishedThis')}
                </span>
              </>
            )}
          </span>
        </Link>

        {snapshot.description && <p className="story-card-desc">{snapshot.description}</p>}

        {genres.length > 0 && (
          <div className="chips">
            {genres.map((genre) => (
              <span className="chip" key={genre}>
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="version-meta">
          <span className="version-label">{latestVersion.label}</span>
          <span className="dot">·</span>
          <span>{formatDate(latestVersion.createdAt, i18n.language)}</span>
          {latestVersion.packageIncluded !== false && (
            <>
              <span className="dot">·</span>
              <span>{formatBytes(latestVersion.byteSize)}</span>
            </>
          )}
        </div>
      </div>

      {story.hasCover && (
        <Link
          to={`/story/${story.storyId}`}
          className="entry-side"
          tabIndex={-1}
          aria-hidden="true"
        >
          <StoryCover
            storyId={story.storyId}
            hasCover={story.hasCover}
            className="story-card-cover"
          />
        </Link>
      )}
    </article>
  );
}
