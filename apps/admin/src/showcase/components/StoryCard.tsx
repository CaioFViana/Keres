import type { ShowcaseStoryCard } from '@keres/shared';
import { Link } from 'react-router-dom';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';
import { paletteVars } from '../theme/paletteVars';
import { OwnerAvatar } from './OwnerAvatar';
import { formatBytes, formatDate, genreList } from '../format';

export function StoryCard({ story }: { story: ShowcaseStoryCard }) {
  const { resolved } = useShowcaseTheme();
  const { snapshot, owner, latestVersion } = story;

  return (
    <Link
      to={`/story/${story.storyId}`}
      className="story-card"
      // Só o realce do card usa a paleta da história na listagem - a página inteira só é
      // tingida ao abrir a história, para a vitrine não virar um mosaico ilegível.
      style={paletteVars(snapshot.theme, resolved)}
    >
      <div className="story-card-accent" aria-hidden="true" />
      <div className="story-card-body">
        <div className="story-card-head">
          <h3>{snapshot.title}</h3>
          <span className={`badge badge-${snapshot.type}`}>{snapshot.type}</span>
        </div>

        {snapshot.description && <p className="story-card-desc">{snapshot.description}</p>}

        {genreList(snapshot.genre).length > 0 && (
          <div className="chips">
            {genreList(snapshot.genre).map((genre) => (
              <span className="chip" key={genre}>
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="story-card-foot">
          <div className="owner">
            <OwnerAvatar owner={owner} size={26} />
            <span className="owner-name">
              {snapshot.author || owner.username}
              <span className="owner-tag">#{owner.tag}</span>
            </span>
          </div>
          <div className="version-meta">
            <span className="version-label">{latestVersion.label}</span>
            <span className="dot">·</span>
            <span>{formatDate(latestVersion.createdAt)}</span>
            <span className="dot">·</span>
            <span>{formatBytes(latestVersion.byteSize)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
