import type { ShowcaseAuthorCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { storyCountLabel } from '@/showcase/format';
import { authorPath } from './OwnerLink';
import { OwnerAvatar } from './OwnerAvatar';

/** One author in the directory: who they are and how much of their work is on show. */
export function AuthorCard({ author }: { author: ShowcaseAuthorCard }) {
  const { t } = useTranslation('showcase');
  const { owner, storyCount } = author;
  return (
    <Link to={authorPath(owner.username)} className="author-card">
      <OwnerAvatar owner={owner} size={48} />
      <span className="owner-name">
        {owner.username}
        <span className="owner-tag">
          #{owner.tag} · {storyCountLabel(t, storyCount)}
        </span>
      </span>
    </Link>
  );
}
