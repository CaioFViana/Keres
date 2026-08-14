import { useEffect, useState } from 'react';
import { ApiLogEntry, ApiLogFilters, LogsApiService } from '../../api/LogsApiService';

const LEVEL_CLASS: Record<ApiLogEntry['level'], string> = {
  info: 'level-info',
  warn: 'level-warn',
  error: 'level-error',
};

export function LogsPage() {
  const [level, setLevel] = useState('');
  const [storyId, setStoryId] = useState('');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [entries, setEntries] = useState<ApiLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<ApiLogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 50;

  const load = () => {
    setLoading(true);
    setError(null);
    const filters: ApiLogFilters = {
      level: (level as ApiLogFilters['level']) || undefined,
      storyId: storyId || undefined,
      userId: userId || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize,
    };
    LogsApiService.list(filters)
      .then((res) => {
        setEntries(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div>
      <h1>Logs</h1>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <input
          placeholder="Story ID"
          value={storyId}
          onChange={(e) => setStoryId(e.target.value)}
        />
        <input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <input
          placeholder="Search message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="log-layout">
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
                  onClick={() => setSelectedEntry(entry)}
                  className="clickable-row"
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
                  <td colSpan={5}>No entries. Search above.</td>
                </tr>
              )}
            </tbody>
          </table>

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
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))} ({total} total)
        </span>
        <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
