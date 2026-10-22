import type { ShowcaseAuthorCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authorPath, storyCountLabel } from '@/showcase/format';
import { OwnerAvatar } from './OwnerAvatar';

/** One author in the directory: a node on the thread, with who they are and how much of their work is on show. */
export function AuthorCard({ author }: { author: ShowcaseAuthorCard }) {
  const { t } = useTranslation('showcase');
  const { owner, storyCount } = author;
  return (
    <article className="author-card entry">
      <div className="entry-body">
        <h2 className="entry-title" data-thread-knot>
          <Link to={authorPath(owner.username)}>{owner.username}</Link>
        </h2>
        <p className="muted">
          #{owner.tag} · {storyCountLabel(t, storyCount)}
        </p>
      </div>
      <Link to={authorPath(owner.username)} className="entry-side" tabIndex={-1} aria-hidden="true">
        <OwnerAvatar owner={owner} size={64} />
      </Link>
    </article>
  );
}
