import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ShowcaseStoryDetail } from '@keres/shared';
import { fetchDownloadUrl, fetchStory, unlockStory } from '../api/showcaseApi';
import { OwnerAvatar } from '../components/OwnerAvatar';
import { PasswordGate } from '../components/PasswordGate';
import { formatBytes, formatDate, genreList } from '../format';
import { paletteDisplayName, paletteVars } from '../theme/paletteVars';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';

export function StoryPage() {
  const { storyId = '' } = useParams();
  const { resolved } = useShowcaseTheme();
  const { t, i18n } = useTranslation('showcase');

  const [detail, setDetail] = useState<ShowcaseStoryDetail | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchStory(storyId);
      if ('protected' in result) {
        setLocked(true);
        setDetail(null);
        return;
      }
      setLocked(false);
      setDetail(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('story.loadFailed'));
    }
  }, [storyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (publicationId: string) => {
    setDownloading(publicationId);
    setError(null);
    try {
      // O link é pedido na hora: para uma história protegida ele carrega um token de 60
      // segundos, curto demais para valer a pena guardar na página.
      window.location.href = await fetchDownloadUrl(storyId, publicationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('story.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  if (error && !detail && !locked) {
    return (
      <section className="story-page">
        <p className="error-text">{error}</p>
        <Link to="/" className="back-link">
          {t('story.back')}
        </Link>
      </section>
    );
  }

  if (locked) {
    return (
      <PasswordGate
        onSubmit={async (password) => {
          const opened = await unlockStory(storyId, password);
          setDetail(opened);
          setLocked(false);
        }}
      />
    );
  }

  if (!detail) {
    return <p className="muted story-page">{t('story.loading')}</p>;
  }

  const { snapshot, owner, versions } = detail;
  const [newest, ...older] = versions;

  return (
    // Aqui sim a paleta da história pinta a página inteira: é a página *dela*.
    <section className="story-page themed" style={paletteVars(snapshot.theme, resolved)}>
      <Link to="/" className="back-link">
        {t('story.back')}
      </Link>

      <header className="story-head">
        <span className={`badge badge-${snapshot.type}`}>{t(`story.${snapshot.type}`)}</span>
        <h1>{snapshot.title}</h1>
        {/*
          Quem publicou, sempre - é um fato sobre esta página. O autor da obra é outra coisa e
          aparece entre os dados da história, abaixo.
        */}
        <div className="owner">
          <OwnerAvatar owner={owner} size={34} />
          <span className="owner-name">
            {owner.username}
            <span className="owner-tag">
              #{owner.tag} · {t('story.publishedThis')}
            </span>
          </span>
        </div>
      </header>

      {snapshot.description && <p className="story-description">{snapshot.description}</p>}

      <dl className="story-facts">
        {/*
          Texto livre da própria história: pode ser um pseudônimo, uma equipe, ou uma atribuição
          de domínio público. Não tem relação com a conta que publicou, e por isso não cai para
          o nome dela quando está vazio.
        */}
        {snapshot.author && (
          <div>
            <dt>{t('story.author')}</dt>
            <dd>{snapshot.author}</dd>
          </div>
        )}
        {genreList(snapshot.genre).length > 0 && (
          <div>
            <dt>{t('story.genre')}</dt>
            <dd className="chips">
              {genreList(snapshot.genre).map((genre) => (
                <span className="chip" key={genre}>
                  {genre}
                </span>
              ))}
            </dd>
          </div>
        )}
        {snapshot.language && (
          <div>
            <dt>{t('story.language')}</dt>
            <dd>{snapshot.language}</dd>
          </div>
        )}
        <div>
          <dt>{t('story.structure')}</dt>
          <dd>{t(`story.${snapshot.type}`)}</dd>
        </div>
        <div>
          <dt>{t('story.theme')}</dt>
          <dd>{paletteDisplayName(snapshot.theme)}</dd>
        </div>
      </dl>

      <section className="versions">
        <h2>{t('story.downloadTitle')}</h2>
        <p className="muted">{t('story.downloadIntro')}</p>

        <ul className="version-list">
          <li className="version newest">
            <div>
              <span className="version-label">{newest.label}</span>
              <span className="version-sub">
                {formatDate(newest.createdAt, i18n.language)} · {formatBytes(newest.byteSize)}
                {newest.mediaTotal > 0 &&
                  ` · ${t('story.mediaCount', {
                    included: newest.mediaIncluded,
                    total: newest.mediaTotal,
                  })}`}
              </span>
            </div>
            <button
              type="button"
              className="download-button"
              disabled={downloading === newest.id}
              onClick={() => void download(newest.id)}
            >
              {downloading === newest.id ? t('story.preparing') : t('story.downloadLatest')}
            </button>
          </li>

          {older.map((version) => (
            <li className="version" key={version.id}>
              <div>
                <span className="version-label">{version.label}</span>
                <span className="version-sub">
                  {formatDate(version.createdAt, i18n.language)} · {formatBytes(version.byteSize)}
                </span>
              </div>
              <button
                type="button"
                className="download-button ghost"
                disabled={downloading === version.id}
                onClick={() => void download(version.id)}
              >
                {downloading === version.id ? t('story.preparing') : t('story.download')}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="error-text">{error}</p>}
      </section>
    </section>
  );
}
