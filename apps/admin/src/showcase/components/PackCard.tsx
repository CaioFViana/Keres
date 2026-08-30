import type { ShowcasePackCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { OwnerAvatar } from './OwnerAvatar';
import { packContentLines } from '../format';

/**
 * A pack in the listing.
 *
 * No palette, unlike `StoryCard`: a pack carries no theme, because it is structure rather than a
 * work. What takes that place is the count of what is inside, which is the only thing that tells a
 * visitor whether the pack is worth opening.
 */
export function PackCard({ pack }: { pack: ShowcasePackCard }) {
  const { t } = useTranslation('showcase');
  const lines = packContentLines(pack.summary, t);

  return (
    <Link to={`/pack/${pack.id}`} className="pack-card">
      <div className="pack-card-head">
        <h3>{pack.name}</h3>
        <span className="badge badge-pack">{t('pack.version', { version: pack.version })}</span>
      </div>

      {pack.description && <p className="pack-card-desc">{pack.description}</p>}

      {lines.length > 0 && (
        <div className="chips">
          {lines.map((line) => (
            <span className="chip" key={line}>
              {line}
            </span>
          ))}
        </div>
      )}

      <div className="pack-card-foot">
        {/*
          The same distinction the story card makes: `authorName` is free text the pack carries and
          the owner is the account that shared it here. With no declared author the card shows only
          the account, rather than passing it off as the author.
        */}
        <div className="owner">
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
        </div>
        {pack.language && <span className="pack-language">{pack.language}</span>}
      </div>
    </Link>
  );
}
