import type { ShowcasePackCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { OwnerAvatar } from './OwnerAvatar';
import { authorPath, packContentLines } from '@/showcase/format';

/**
 * A pack in the listing: a node on the thread, like a story.
 *
 * No palette, unlike `StoryCard`: a pack carries no theme, because it is structure rather than a
 * work. What takes that place is the count of what is inside, which is the only thing that tells a
 * visitor whether the pack is worth opening.
 */
export function PackCard({ pack }: { pack: ShowcasePackCard }) {
  const { t } = useTranslation('showcase');
  const lines = packContentLines(pack.summary, t);

  return (
    <article className="pack-card entry">
      <div className="entry-body">
        <h2 className="entry-title" data-thread-knot>
          <Link to={`/pack/${pack.id}`}>{pack.name}</Link>
        </h2>

        <div className="entry-badges">
          <span className="badge badge-pack">{t('pack.version', { version: pack.version })}</span>
          {pack.language && <span className="pack-language">{pack.language}</span>}
        </div>

        {/*
          The same distinction the story card makes: `authorName` is free text the pack carries and
          the owner is the account that shared it here. With no declared author the card shows only
          the account, rather than passing it off as the author.
        */}
        <Link to={authorPath(pack.owner.username)} className="owner">
          <OwnerAvatar owner={pack.owner} size={26} />
          <span className="owner-name">
            {pack.authorName ? (
              <>
                {pack.authorName}
                <span className="owner-tag">
                  {t('pack.sharedBy', { username: pack.owner.username, tag: pack.owner.tag })}
                </span>
              </>
            ) : (
              <>
                {pack.owner.username}
                <span className="owner-tag">
                  #{pack.owner.tag} · {t('pack.sharedThisShort')}
                </span>
              </>
            )}
          </span>
        </Link>

        {pack.description && <p className="story-card-desc">{pack.description}</p>}

        {lines.length > 0 && (
          <div className="chips">
            {lines.map((line) => (
              <span className="chip" key={line}>
                {line}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
