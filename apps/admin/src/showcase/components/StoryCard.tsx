import type { ShowcaseStoryCard } from '@keres/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';
import { paletteVars } from '../theme/paletteVars';
import { OwnerAvatar } from './OwnerAvatar';
import { formatBytes, formatDate, genreList } from '../format';

export function StoryCard({ story }: { story: ShowcaseStoryCard }) {
  const { resolved } = useShowcaseTheme();
  const { t, i18n } = useTranslation('showcase');
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
          <span className={`badge badge-${snapshot.type}`}>{t(`story.${snapshot.type}`)}</span>
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
          {/*
            Autor e quem publicou são coisas diferentes: o autor é um texto livre da história
            (pode ser um pseudônimo, uma equipe, ou "domínio público" numa obra que a pessoa só
            transcreveu), e quem publicou é a conta que subiu o pacote. Sem autor declarado, o
            card mostra só quem publicou - inventar o nome da conta como autor seria atribuir a
            ela uma obra que talvez não seja dela.
          */}
          <div className="owner">
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
                    #{owner.tag} · {t('story.publishedThisShort')}
                  </span>
                </>
              )}
            </span>
          </div>
          <div className="version-meta">
            <span className="version-label">{latestVersion.label}</span>
            <span className="dot">·</span>
            <span>{formatDate(latestVersion.createdAt, i18n.language)}</span>
            <span className="dot">·</span>
            <span>{formatBytes(latestVersion.byteSize)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
