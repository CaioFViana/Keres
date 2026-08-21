import { KeyboardEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiLogEntry, ApiLogFilters, LogsApiService } from '../../api/LogsApiService';

const LEVEL_CLASS: Record<ApiLogEntry['level'], string> = {
  info: 'level-info',
  warn: 'level-warn',
  error: 'level-error',
};

const LEVELS = ['info', 'warn', 'error'] as const;

export function LogsPage() {
  const { t, i18n } = useTranslation('admin');
  const [levelInput, setLevelInput] = useState('');
  const [storyIdInput, setStoryIdInput] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  const [applied, setApplied] = useState({
    level: '',
    storyId: '',
    userId: '',
    search: '',
    from: '',
    to: '',
  });

  const [entries, setEntries] = useState<ApiLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<ApiLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    const filters: ApiLogFilters = {
      level: (LEVELS.includes(applied.level as (typeof LEVELS)[number])
        ? applied.level
        : undefined) as ApiLogFilters['level'],
      storyId: applied.storyId || undefined,
      userId: applied.userId || undefined,
      search: applied.search || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      page,
      pageSize,
    };
    LogsApiService.list(filters)
      .then((res) => {
        if (ignore) return;
        setEntries(res.items);
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
  }, [page, applied]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setApplied({
      level: levelInput,
      storyId: storyIdInput.trim(),
      userId: userIdInput.trim(),
      search: searchInput.trim(),
      from: fromInput,
      to: toInput,
    });
  };

  const selectEntry = (entry: ApiLogEntry) => setSelectedEntry(entry);

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, entry: ApiLogEntry) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectEntry(entry);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('logs.title')}</h1>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          {t('logs.level')}
          <select value={levelInput} onChange={(e) => setLevelInput(e.target.value)}>
            <option value="">{t('logs.allLevels')}</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </label>
        <label>
          {t('logs.storyId')}
          <input
            placeholder={t('common.optional')}
            value={storyIdInput}
            onChange={(e) => setStoryIdInput(e.target.value)}
          />
        </label>
        <label>
          {t('logs.userId')}
          <input
            placeholder={t('common.optional')}
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
          />
        </label>
        <label>
          {t('common.search')}
          <input
            placeholder={t('logs.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label>
          {t('logs.from')}
          <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
        </label>
        <label>
          {t('logs.to')}
          <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} />
        </label>
        <button type="submit">{t('common.search')}</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className={`log-layout${selectedEntry ? ' has-detail' : ''}`}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('logs.columnWhen')}</th>
                  <th>{t('logs.columnLevel')}</th>
                  <th>{t('logs.columnMessage')}</th>
                  <th>{t('logs.columnStory')}</th>
                  <th>{t('logs.columnUser')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => selectEntry(entry)}
                    onKeyDown={(e) => onRowKeyDown(e, entry)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedEntry?.id === entry.id}
                    className={`clickable-row${selectedEntry?.id === entry.id ? ' is-selected' : ''}`}
                  >
                    <td>{new Date(entry.createdAt).toLocaleString(i18n.language)}</td>
                    <td className={LEVEL_CLASS[entry.level]}>{entry.level}</td>
                    <td className="message-cell">{entry.message}</td>
                    <td title={entry.storyId ?? undefined}>
                      {entry.storyTitle ?? entry.storyId ?? '-'}
                    </td>
                    <td title={entry.userId ?? undefined}>
                      {entry.username ?? entry.userId ?? '-'}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      {t('logs.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedEntry && (
            <div className="detail-panel">
              <h3>{t('logs.detail')}</h3>
              <dl>
                <dt>{t('logs.columnLevel')}</dt>
                <dd className={LEVEL_CLASS[selectedEntry.level]}>{selectedEntry.level}</dd>
                <dt>{t('logs.columnStory')}</dt>
                <dd title={selectedEntry.storyId ?? undefined}>
                  {selectedEntry.storyTitle ?? selectedEntry.storyId ?? '-'}
                </dd>
                <dt>{t('logs.columnUser')}</dt>
                <dd title={selectedEntry.userId ?? undefined}>
                  {selectedEntry.username ?? selectedEntry.userId ?? '-'}
                </dd>
                <dt>{t('logs.columnWhen')}</dt>
                <dd>{new Date(selectedEntry.createdAt).toLocaleString(i18n.language)}</dd>
              </dl>
              <p>{selectedEntry.message}</p>
              <pre>{JSON.stringify(selectedEntry.meta, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t('common.previous')}
        </button>
        <span>
          {t('common.pagination', {
            page,
            pages: Math.max(1, Math.ceil(total / pageSize)),
            total,
          })}
        </span>
        <button
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
