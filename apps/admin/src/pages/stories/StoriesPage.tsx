import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  AdminStoryApiService,
  type AdminStoryCollaborator,
  type AdminStoryItem,
} from '../../api/AdminStoryApiService';

type NsfwFilter = 'all' | 'nsfw' | 'safe';

const PAGE_SIZE = 25;

function Collaborators({ story }: { story: AdminStoryItem }) {
  const { t } = useTranslation('admin');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AdminStoryCollaborator[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    if (rows !== null) return;
    try {
      setRows(await AdminStoryApiService.collaborators(story.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  const remove = async (row: AdminStoryCollaborator) => {
    if (!confirm(t('stories.confirmRemove', { name: row.username, title: story.title }))) return;
    try {
      await AdminStoryApiService.removeCollaborator(story.id, row.userId);
      setRows((current) => (current ?? []).filter((entry) => entry.userId !== row.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  if (!open) {
    return (
      <button type="button" className="button-secondary" onClick={() => void load()}>
        {t('stories.showCollaborators')}
      </button>
    );
  }
  if (error) {
    return <span className="error-text">{error}</span>;
  }
  if (rows === null) {
    return <span className="loading-text">{t('common.loading')}</span>;
  }
  if (rows.length === 0) {
    return <span className="hint">{t('stories.noCollaborators')}</span>;
  }
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.userId}>
          <Link to={`/users/${row.userId}`}>@{row.tag}</Link> ({row.permissionType}){' '}
          <button type="button" className="button-danger" onClick={() => void remove(row)}>
            {t('common.delete')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function StoriesPage() {
  const { t, i18n } = useTranslation('admin');
  const [items, setItems] = useState<AdminStoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [nsfwFilter, setNsfwFilter] = useState<NsfwFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    AdminStoryApiService.list({
      search: appliedSearch || undefined,
      nsfw: nsfwFilter === 'all' ? undefined : nsfwFilter === 'nsfw',
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (ignore) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, nsfwFilter, appliedSearch]);

  const toggleNsfw = async (story: AdminStoryItem) => {
    if (!story.isNsfw && !confirm(t('stories.confirmNsfw', { title: story.title }))) {
      return;
    }
    setToggling(story.id);
    try {
      const updated = await AdminStoryApiService.setNsfw(story.id, !story.isNsfw);
      setItems((rows) =>
        rows.map((row) => (row.id === updated.id ? { ...row, isNsfw: updated.isNsfw } : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    } finally {
      setToggling(null);
    }
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('stories.title')}</h1>
      </div>
      <p className="hint">{t('stories.description')}</p>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          {t('common.search')}
          <input
            placeholder={t('stories.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t('stories.searchAriaLabel')}
          />
        </label>
        <label>
          {t('stories.filterNsfw')}
          <select
            value={nsfwFilter}
            onChange={(e) => {
              setNsfwFilter(e.target.value as NsfwFilter);
              setPage(1);
            }}
          >
            <option value="all">{t('stories.nsfw.all')}</option>
            <option value="nsfw">{t('stories.nsfw.nsfw')}</option>
            <option value="safe">{t('stories.nsfw.safe')}</option>
          </select>
        </label>
        <button type="submit">{t('common.search')}</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('stories.columnTitle')}</th>
                <th>{t('stories.columnOwner')}</th>
                <th>{t('stories.columnNsfw')}</th>
                <th>{t('stories.columnUpdated')}</th>
                <th>{t('stories.columnCollaborators')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((story) => (
                <tr key={story.id} className={story.isDeleted ? 'row-deleted' : ''}>
                  <td>{story.title}</td>
                  <td>
                    <Link to={`/users/${story.ownerUserId}`}>@{story.ownerTag}</Link>{' '}
                    <span className="hint">
                      {story.ownerUsername}
                      {story.ownerDeleted ? ` ${t('stories.ownerDeleted')}` : ''}
                    </span>
                  </td>
                  <td>
                    {story.isNsfw ? (
                      <span className="status-badge accent">{t('stories.nsfwBadge')}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{new Date(story.updatedAt).toLocaleDateString(i18n.language)}</td>
                  <td>
                    <Collaborators story={story} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={toggling === story.id}
                      onClick={() => void toggleNsfw(story)}
                    >
                      {story.isNsfw ? t('stories.clearNsfw') : t('stories.flagNsfw')}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {t('stories.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t('common.previous')}
        </button>
        <span>
          {t('common.pagination', {
            page,
            pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            total,
          })}
        </span>
        <button
          type="button"
          disabled={page * PAGE_SIZE >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
