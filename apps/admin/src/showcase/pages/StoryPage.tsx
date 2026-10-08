import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ShowcaseStoryDetail, ShowcaseVersion } from '@keres/shared';
import {
  fetchDownloadUrl,
  fetchManuscriptDownloadUrl,
  fetchStory,
  unlockStory,
} from '../api/showcaseApi';
import { useShowcaseAuth } from '../auth/ShowcaseAuthProvider';
import { LoginDialog } from '../components/LoginDialog';
import { OwnerAvatar } from '../components/OwnerAvatar';
import { PasswordGate } from '../components/PasswordGate';
import { formatBytes, formatDate, genreList } from '../format';
import { paletteDisplayName, paletteVars } from '../theme/paletteVars';
import { useShowcaseTheme } from '../theme/ShowcaseThemeProvider';

export function StoryPage() {
  const { storyId = '' } = useParams();
  const { resolved } = useShowcaseTheme();
  const { t } = useTranslation('showcase');
  const { status: authStatus, seesNsfw } = useShowcaseAuth();

  const [detail, setDetail] = useState<ShowcaseStoryDetail | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingManuscript, setDownloadingManuscript] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

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
    // Gating is per viewer class: signing in or out can reveal or hide this very story.
    if (authStatus === 'loading') {
      return;
    }
    setDetail(null);
    setLocked(false);
    setError(null);
    void load();
  }, [load, authStatus]);

  const download = async (publicationId: string) => {
    setDownloading(publicationId);
    setError(null);
    try {
      // The link is requested on demand: for a protected story it carries a 60-second token, too short
      // to be worth keeping on the page.
      window.location.href = await fetchDownloadUrl(storyId, publicationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('story.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  const downloadManuscript = async (publicationId: string) => {
    setDownloadingManuscript(publicationId);
    setError(null);
    try {
      window.location.href = await fetchManuscriptDownloadUrl(storyId, publicationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('story.downloadFailed'));
    } finally {
      setDownloadingManuscript(null);
    }
  };

  if (error && !detail && !locked) {
    return (
      <section className="story-page">
        {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
        <p className="error-text">{error}</p>
        {/* A gated (+18) or shadowbanned story answers 404 like an unpublished one: whoever is
            not signed in as a verified adult gets the sign-in offer, not the distinction. */}
        {!seesNsfw && (
          <p className="muted">
            {t('story.gatedHint')}{' '}
            <button type="button" className="button-secondary" onClick={() => setLoginOpen(true)}>
              {t('auth.signIn')}
            </button>
          </p>
        )}
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
  const groups = groupVersions(versions);

  return (
    // Here the story's palette does tint the whole page: it is *its* page.
    <section className="story-page themed" style={paletteVars(snapshot.theme, resolved)}>
      <Link to="/" className="back-link">
        {t('story.back')}
      </Link>

      <header className="story-head">
        <span className={`badge badge-${snapshot.type}`}>{t(`story.${snapshot.type}`)}</span>
        {snapshot.isNsfw && <span className="badge badge-adult">{t('story.adultsOnly')}</span>}
        <h1>{snapshot.title}</h1>
        {/*
          The publisher, always - it is a fact about this page. The work's author is a different
          thing, shown among the story's data below.
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
          Free text from the story itself: it may be a pseudonym, a team, or a public-domain
          attribution. It has no relation to the account that published, so it never falls back
          to that account's name when empty.
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

      {groups.map((group) => (
        <section
          className="versions"
          key={group.key}
          data-testid={group.arc ? `work-${group.arc.id}` : 'universe-versions'}
        >
          {group.arc ? (
            <>
              <h2>{group.arc.title}</h2>
              <p className="muted work-meta">
                <span className="badge">{t(`story.medium.${group.arc.medium}`)}</span>
                {group.arc.author ? ` ${t('story.workBy', { author: group.arc.author })}` : ''}
              </p>
              {group.arc.description && (
                <p className="story-description">{group.arc.description}</p>
              )}
            </>
          ) : (
            <>
              <h2>{groups.length > 1 ? t('story.universeTitle') : t('story.downloadTitle')}</h2>
              <p className="muted">
                {groups.length > 1 ? t('story.universeIntro') : t('story.downloadIntro')}
              </p>
            </>
          )}
          <ul className="version-list">
            {group.versions.map((version, index) => (
              <VersionRow
                key={version.id}
                version={version}
                storyId={storyId}
                newest={index === 0}
                downloading={downloading === version.id}
                downloadingManuscript={downloadingManuscript === version.id}
                onDownload={() => void download(version.id)}
                onDownloadManuscript={() => void downloadManuscript(version.id)}
              />
            ))}
          </ul>
        </section>
      ))}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}

/** What the page lists together: the whole universe's versions, then each work's. */
export type VersionGroup = {
  key: string;
  arc: NonNullable<ShowcaseVersion['arc']> | null;
  versions: ShowcaseVersion[];
};

/**
 * The versions grouped by what they release. The universe comes first; each work follows, the one
 * released most recently before the others. Inside a group the newest version leads.
 */
export function groupVersions(versions: readonly ShowcaseVersion[]): VersionGroup[] {
  const universe: ShowcaseVersion[] = [];
  const works = new Map<string, VersionGroup>();
  for (const version of versions) {
    if (!version.arc) {
      universe.push(version);
      continue;
    }
    const group = works.get(version.arc.id) ?? {
      key: version.arc.id,
      arc: version.arc,
      versions: [],
    };
    group.versions.push(version);
    works.set(version.arc.id, group);
  }
  const groups: VersionGroup[] = [];
  if (universe.length > 0) groups.push({ key: 'universe', arc: null, versions: universe });
  return [...groups, ...works.values()];
}

function VersionRow({
  version,
  storyId,
  newest,
  downloading,
  downloadingManuscript,
  onDownload,
  onDownloadManuscript,
}: {
  version: ShowcaseVersion;
  storyId: string;
  newest: boolean;
  downloading: boolean;
  downloadingManuscript: boolean;
  onDownload: () => void;
  onDownloadManuscript: () => void;
}) {
  const { t, i18n } = useTranslation('showcase');
  return (
    <li className={newest ? 'version newest' : 'version'}>
      <div>
        <span className="version-label">{version.label}</span>
        <span className="version-sub">
          {formatDate(version.createdAt, i18n.language)}
          {version.packageIncluded !== false && ` · ${formatBytes(version.byteSize)}`}
          {newest &&
            version.packageIncluded !== false &&
            version.mediaTotal > 0 &&
            ` · ${t('story.mediaCount', {
              included: version.mediaIncluded,
              total: version.mediaTotal,
            })}`}
        </span>
      </div>
      <div className="version-actions">
        {/* A version may be only a manuscript and/or the reading: then there is no story file to offer. */}
        {version.packageIncluded !== false && (
          <button
            type="button"
            className={newest ? 'download-button' : 'download-button ghost'}
            disabled={downloading}
            onClick={onDownload}
          >
            {downloading
              ? t('story.preparing')
              : newest
                ? t('story.downloadLatest')
                : t('story.download')}
          </button>
        )}
        {version.reader && (
          <Link
            to={`/story/${storyId}/read/${version.id}`}
            className="download-button ghost reader-button"
          >
            {t('story.readOnline')}
          </Link>
        )}
        {version.manuscript && (
          <button
            type="button"
            className="download-button ghost manuscript-button"
            disabled={downloadingManuscript}
            onClick={onDownloadManuscript}
          >
            {downloadingManuscript
              ? t('story.preparing')
              : t('story.manuscriptDownload', {
                  format: version.manuscript.format.toUpperCase(),
                  size: formatBytes(version.manuscript.byteSize),
                })}
          </button>
        )}
      </div>
    </li>
  );
}
