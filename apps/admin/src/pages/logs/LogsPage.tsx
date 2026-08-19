import { KeyboardEvent, useEffect, useState } from 'react';
import { ApiLogEntry, ApiLogFilters, LogsApiService } from '../../api/LogsApiService';

const LEVEL_CLASS: Record<ApiLogEntry['level'], string> = {
  info: 'level-info',
  warn: 'level-warn',
  error: 'level-error',
};

const LEVELS = ['info', 'warn', 'error'] as const;

export function LogsPage() {
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
        <h1>Logs</h1>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          Level
          <select value={levelInput} onChange={(e) => setLevelInput(e.target.value)}>
            <option value="">All levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </label>
        <label>
          Story ID
          <input value={storyIdInput} onChange={(e) => setStoryIdInput(e.target.value)} />
        </label>
        <label>
          User ID
          <input value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)} />
        </label>
        <label>
          Search
          <input
            placeholder="Message..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label>
          From
          <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} />
        </label>
        <button type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <div className="log-layout">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Level</th>
                  <th>Message</th>
                  <th>Story</th>
                  <th>User</th>
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
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className={LEVEL_CLASS[entry.level]}>{entry.level}</td>
                    <td className="message-cell">{entry.message}</td>
                    <td>{entry.storyId ?? '-'}</td>
                    <td>{entry.userId ?? '-'}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No entries. Search above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedEntry && (
            <div className="detail-panel">
              <h3>Log detail</h3>
              <dl>
                <dt>Level</dt>
                <dd className={LEVEL_CLASS[selectedEntry.level]}>{selectedEntry.level}</dd>
                <dt>Story</dt>
                <dd>{selectedEntry.storyId ?? '-'}</dd>
                <dt>User</dt>
                <dd>{selectedEntry.userId ?? '-'}</dd>
                <dt>When</dt>
                <dd>{new Date(selectedEntry.createdAt).toLocaleString()}</dd>
              </dl>
              <p>{selectedEntry.message}</p>
              <pre>{JSON.stringify(selectedEntry.meta, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} total)
        </span>
        <button
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
