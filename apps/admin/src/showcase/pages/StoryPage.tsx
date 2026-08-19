import { useCallback, useEffect, useState } from 'react';
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
      setError(caught instanceof Error ? caught.message : 'Could not load this story.');
    }
  }, [storyId]);

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
      setError(caught instanceof Error ? caught.message : 'Could not start the download.');
    } finally {
      setDownloading(null);
    }
  };

  if (error && !detail && !locked) {
    return (
      <section className="story-page">
        <p className="error-text">{error}</p>
        <Link to="/" className="back-link">
          ← All stories
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
    return <p className="muted story-page">Loading…</p>;
  }

  const { snapshot, owner, versions } = detail;
  const [newest, ...older] = versions;

  return (
    // Aqui sim a paleta da história pinta a página inteira: é a página *dela*.
    <section className="story-page themed" style={paletteVars(snapshot.theme, resolved)}>
      <Link to="/" className="back-link">
        ← All stories
      </Link>

      <header className="story-head">
        <span className={`badge badge-${snapshot.type}`}>{snapshot.type}</span>
        <h1>{snapshot.title}</h1>
        <div className="owner">
          <OwnerAvatar owner={owner} size={34} />
          <span className="owner-name">
            {snapshot.author || owner.username}
            <span className="owner-tag">
              {owner.username}#{owner.tag}
            </span>
          </span>
        </div>
      </header>

      {snapshot.description && <p className="story-description">{snapshot.description}</p>}

      <dl className="story-facts">
        {genreList(snapshot.genre).length > 0 && (
          <div>
            <dt>Genre</dt>
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
            <dt>Language</dt>
            <dd>{snapshot.language}</dd>
          </div>
        )}
        <div>
          <dt>Structure</dt>
          <dd>{snapshot.type === 'branching' ? 'Branching' : 'Linear'}</dd>
        </div>
        <div>
          <dt>Theme</dt>
          <dd>{paletteDisplayName(snapshot.theme)}</dd>
        </div>
      </dl>

      <section className="versions">
        <h2>Download</h2>
        <p className="muted">
          Each version is a complete Keres package - the story and its media - that imports
          straight back into the app.
        </p>

        <ul className="version-list">
          <li className="version newest">
            <div>
              <span className="version-label">{newest.label}</span>
              <span className="version-sub">
                {formatDate(newest.createdAt)} · {formatBytes(newest.byteSize)}
                {newest.mediaTotal > 0 &&
                  ` · ${newest.mediaIncluded}/${newest.mediaTotal} media`}
              </span>
            </div>
            <button
              type="button"
              className="download-button"
              disabled={downloading === newest.id}
              onClick={() => void download(newest.id)}
            >
              {downloading === newest.id ? 'Preparing…' : 'Download latest'}
            </button>
          </li>

          {older.map((version) => (
            <li className="version" key={version.id}>
              <div>
                <span className="version-label">{version.label}</span>
                <span className="version-sub">
                  {formatDate(version.createdAt)} · {formatBytes(version.byteSize)}
                </span>
              </div>
              <button
                type="button"
                className="download-button ghost"
                disabled={downloading === version.id}
                onClick={() => void download(version.id)}
              >
                {downloading === version.id ? 'Preparing…' : 'Download'}
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="error-text">{error}</p>}
      </section>
    </section>
  );
}
