import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdminStoryApiService,
  type AdminStoryBoardSummary,
  type AdminStoryEntities,
  type AdminStoryEntityType,
  type AdminStoryItem,
  type AdminStoryLocationMapSummary,
  type AdminStoryMediaItem,
  type AdminStorySketchSummary,
} from '../../api/AdminStoryApiService';
import { Pagination } from '../../components/Pagination';

type ContentTab = 'media' | 'boards' | 'sketches' | 'maps' | 'entities';

const PREVIEWABLE = new Set(['image', 'video', 'audio']);

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaCard({ storyId, item }: { storyId: string; item: AdminStoryMediaItem }) {
  const { t } = useTranslation('admin');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!PREVIEWABLE.has(item.mediaType)) return;
    let alive = true;
    let url: string | null = null;
    AdminStoryApiService.blob(storyId, item.hash)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [storyId, item.hash, item.mediaType]);

  const download = async () => {
    const blob = await AdminStoryApiService.blob(storyId, item.hash);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <li className="content-card">
      {item.mediaType === 'image' && objectUrl && (
        <img src={objectUrl} alt={item.title ?? item.fileName} className="content-preview" />
      )}
      {item.mediaType === 'video' && objectUrl && (
        <video src={objectUrl} controls className="content-preview" />
      )}
      {item.mediaType === 'audio' && objectUrl && (
        <audio src={objectUrl} controls className="content-preview-audio" />
      )}
      {failed && <span className="error-text">{t('stories.content.previewFailed')}</span>}
      <div className="content-meta">
        <strong>{item.title || item.fileName}</strong>{' '}
        <span className="hint">
          {item.mediaType} · {item.mimeType} · {formatBytes(item.sizeBytes)}
          {item.isFavorite ? ` · ${t('stories.content.favorite')}` : ''}
        </span>
        {item.extraNotes && <p className="hint">{item.extraNotes}</p>}
        {item.mediaType === 'link' && item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.sourceUrl}
          </a>
        ) : (
          item.mediaType !== 'link' && (
            <button type="button" className="button-secondary" onClick={() => void download()}>
              {t('stories.content.download')}
            </button>
          )
        )}
      </div>
    </li>
  );
}

function Boards({ rows }: { rows: AdminStoryBoardSummary[] }) {
  const { t } = useTranslation('admin');
  if (rows.length === 0) return <p className="hint">{t('stories.content.emptyBoards')}</p>;
  return (
    <ul>
      {rows.map((board) => (
        <li key={board.id} className="content-card">
          <strong>{board.name}</strong>{' '}
          <span className="hint">
            {t('stories.content.boardCounts', {
              nodes: board.summary.nodeCount,
              edges: board.summary.edgeCount,
            })}
          </span>
          {board.description && <p className="hint">{board.description}</p>}
          {board.summary.entityPins.length > 0 && (
            <ul>
              {board.summary.entityPins.map((pin) => (
                <li key={`${pin.entityType}:${pin.entityId}`}>
                  {pin.entityType}: {pin.label}
                  {pin.note && <span className="hint"> — {pin.note}</span>}
                </li>
              ))}
            </ul>
          )}
          {board.summary.notes.length > 0 && (
            <ul>
              {board.summary.notes.map((note, index) => (
                <li key={index}>
                  {note.title}
                  {note.body && <span className="hint"> — {note.body}</span>}
                </li>
              ))}
            </ul>
          )}
          {board.summary.edgeLabels.length > 0 && (
            <p className="hint">
              {t('stories.content.edgeLabels')}: {board.summary.edgeLabels.join(', ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Sketches({ rows }: { rows: AdminStorySketchSummary[] }) {
  const { t } = useTranslation('admin');
  if (rows.length === 0) return <p className="hint">{t('stories.content.emptySketches')}</p>;
  return (
    <ul>
      {rows.map((sketch) => (
        <li key={sketch.id} className="content-card">
          <strong>{sketch.name}</strong>{' '}
          <span className="hint">
            {t('stories.content.sketchCounts', {
              layers: sketch.summary.layerCount,
              strokes: sketch.summary.strokeCount,
              fills: sketch.summary.fillCount,
              overlays: sketch.summary.overlayCount,
            })}
          </span>
          {sketch.description && <p className="hint">{sketch.description}</p>}
          {sketch.summary.texts.length > 0 && (
            <ul>
              {sketch.summary.texts.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function LocationMaps({ rows }: { rows: AdminStoryLocationMapSummary[] }) {
  const { t } = useTranslation('admin');
  if (rows.length === 0) return <p className="hint">{t('stories.content.emptyMaps')}</p>;
  return (
    <ul>
      {rows.map((map) => (
        <li key={map.id} className="content-card">
          <strong>{map.name}</strong>{' '}
          <span className="hint">
            {t('stories.content.mapCounts', {
              images: map.summary.imageCount,
              nodes: map.summary.nodeCount,
              markers: map.summary.markers.length,
            })}
          </span>
          {map.description && <p className="hint">{map.description}</p>}
          {map.summary.markers.length > 0 && (
            <ul>
              {map.summary.markers.map((marker, index) => (
                <li key={index}>
                  {marker.title}
                  {marker.note && <span className="hint"> — {marker.note}</span>}
                </li>
              ))}
            </ul>
          )}
          {map.summary.relationTexts.length > 0 && (
            <p className="hint">
              {t('stories.content.relationTexts')}: {map.summary.relationTexts.join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rowLabel(row: Record<string, unknown>): string {
  for (const key of ['name', 'title', 'label']) {
    if (typeof row[key] === 'string' && (row[key] as string).length > 0) {
      return row[key] as string;
    }
  }
  return typeof row.id === 'string' ? row.id : JSON.stringify(row).slice(0, 60);
}

/**
 * Every synced entity of the story, raw field values for analysis. Types load first (with
 * live counts); rows of the selected type load on demand, newest first, capped server-side.
 */
function Entities({ storyId }: { storyId: string }) {
  const { t } = useTranslation('admin');
  const [types, setTypes] = useState<AdminStoryEntityType[] | null>(null);
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminStoryEntities | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    AdminStoryApiService.entityTypes(storyId)
      .then((entries) => {
        if (!alive) return;
        setTypes(entries);
        setSelected(entries.find((entry) => entry.liveCount > 0)?.entityType ?? '');
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('common.actionFailed'));
      });
    return () => {
      alive = false;
    };
  }, [storyId, t]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setLoadingRows(true);
    setRows(null);
    AdminStoryApiService.entities(storyId, selected, page)
      .then((result) => {
        if (alive) setRows(result);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('common.actionFailed'));
      })
      .finally(() => {
        if (alive) setLoadingRows(false);
      });
    return () => {
      alive = false;
    };
  }, [storyId, selected, page, t]);

  if (error) {
    return <span className="error-text">{error}</span>;
  }
  if (types === null) {
    return <span className="loading-text">{t('common.loading')}</span>;
  }
  return (
    <div>
      <label>
        {t('stories.content.entityType')}
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPage(1);
          }}
        >
          {types.map((entry) => (
            <option key={entry.entityType} value={entry.entityType}>
              {entry.entityType} ({entry.liveCount})
            </option>
          ))}
        </select>
      </label>
      {loadingRows && <p className="loading-text">{t('common.loading')}</p>}
      {rows !== null && (
        <>
          <Pagination
            page={page}
            pageSize={rows.pageSize}
            total={rows.total}
            onPageChange={setPage}
          />
          {rows.items.length === 0 && <p className="hint">{t('stories.content.emptyEntities')}</p>}
          {rows.items.map((row, index) => (
            <details key={typeof row.id === 'string' ? row.id : index}>
              <summary>{rowLabel(row)}</summary>
              <div className="table-scroll">
                <table className="data-table">
                  <tbody>
                    {Object.entries(row).map(([field, value]) => (
                      <tr key={field}>
                        <th scope="row">{field}</th>
                        <td className="mono-code">{formatFieldValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * What the server stores of a story, for moderation review: the media files (viewable and
 * downloadable), board and location-map summaries (pin labels and free texts, since the
 * drawings themselves need the story canvas to render), and the raw entities. Loaded
 * lazily - only when the reviewer opens the section.
 */
export function StoryContent({ story }: { story: AdminStoryItem }) {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ContentTab>('media');
  const [media, setMedia] = useState<AdminStoryMediaItem[] | null>(null);
  const [boards, setBoards] = useState<AdminStoryBoardSummary[] | null>(null);
  const [sketches, setSketches] = useState<AdminStorySketchSummary[] | null>(null);
  const [maps, setMaps] = useState<AdminStoryLocationMapSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    if (media !== null) return;
    try {
      const [mediaRows, boardRows, sketchRows, mapRows] = await Promise.all([
        AdminStoryApiService.media(story.id),
        AdminStoryApiService.boards(story.id),
        AdminStoryApiService.sketches(story.id),
        AdminStoryApiService.locationMaps(story.id),
      ]);
      setMedia(mediaRows);
      setBoards(boardRows);
      setSketches(sketchRows);
      setMaps(mapRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  if (!open) {
    return (
      <button type="button" className="button-secondary" onClick={() => void load()}>
        {t('stories.showContent')}
      </button>
    );
  }
  if (error) {
    return <span className="error-text">{error}</span>;
  }
  if (media === null || boards === null || sketches === null || maps === null) {
    return <span className="loading-text">{t('common.loading')}</span>;
  }
  return (
    <div className="story-content">
      <div className="tabs" role="tablist">
        {(['media', 'boards', 'sketches', 'maps', 'entities'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            className={tab === entry ? 'tab active' : 'tab button-secondary'}
            onClick={() => setTab(entry)}
          >
            {t(`stories.content.tabs.${entry}`)}
          </button>
        ))}
      </div>
      {tab === 'media' && (
        <>
          {media.length === 0 && <p className="hint">{t('stories.content.emptyMedia')}</p>}
          <ul className="content-grid">
            {media.map((item) => (
              <MediaCard key={item.id} storyId={story.id} item={item} />
            ))}
          </ul>
        </>
      )}
      {tab === 'boards' && <Boards rows={boards} />}
      {tab === 'sketches' && <Sketches rows={sketches} />}
      {tab === 'maps' && <LocationMaps rows={maps} />}
      {tab === 'entities' && <Entities storyId={story.id} />}
    </div>
  );
}
