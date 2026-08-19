import { FormEvent, KeyboardEvent, useState } from 'react';
import { RECOVERABLE_ENTITY_TYPES } from '@keres/shared';
import { DeletedItem, OperationLogEntry, RecoveryApiService } from '../../api/RecoveryApiService';

export function RecoveryPage() {
  const [entityType, setEntityType] = useState('');
  const [storyId, setStoryId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [logStoryId, setLogStoryId] = useState('');
  const [logSearchInput, setLogSearchInput] = useState('');
  const [logEntries, setLogEntries] = useState<OperationLogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<OperationLogEntry | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const search = (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    RecoveryApiService.listDeleted({
      entityType: entityType || undefined,
      storyId: storyId.trim() || undefined,
      search: searchInput.trim() || undefined,
    })
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const restore = async (item: DeletedItem) => {
    const label = item.name ? `"${item.name}"` : item.id;
    if (!confirm(`Restore ${item.entityType} ${label}?`)) return;
    try {
      await RecoveryApiService.restore(item.entityType, item.id);
      setItems((prev) =>
        prev.filter((i) => !(i.entityType === item.entityType && i.id === item.id)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const searchLog = (e?: FormEvent) => {
    e?.preventDefault();
    setLogLoading(true);
    setLogError(null);
    RecoveryApiService.browseOperationLog({
      storyId: logStoryId.trim() || undefined,
      search: logSearchInput.trim() || undefined,
      pageSize: 50,
    })
      .then((res) => setLogEntries(res.items))
      .catch((err) => setLogError(err.message))
      .finally(() => setLogLoading(false));
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, entry: OperationLogEntry) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedEntry(entry);
    }
  };

  const storyCell = (item: DeletedItem) => {
    if (item.storyTitle) {
      return <span title={item.storyId ?? undefined}>{item.storyTitle}</span>;
    }
    return item.storyId ?? '-';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Recovery</h1>
      </div>

      <section>
        <h2>Deleted items</h2>
        <form className="toolbar" onSubmit={search}>
          <label>
            Entity type
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All entity types</option>
              {RECOVERABLE_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Story ID
            <input
              placeholder="Optional"
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
            />
          </label>
          <label>
            Search
            <input
              placeholder="Name, story title, id…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <button type="submit">Search</button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Story</th>
                  <th>Deleted at</th>
                  <th>Version</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.entityType}:${item.id}`}>
                    <td>{item.entityType}</td>
                    <td>{item.name ?? <span className="hint">(unnamed)</span>}</td>
                    <td className="mono-code">{item.id}</td>
                    <td>{storyCell(item)}</td>
                    <td>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '-'}</td>
                    <td>{item.version}</td>
                    <td>
                      <button type="button" onClick={() => void restore(item)}>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No deleted items found. Search above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Operation log</h2>
        <form className="toolbar" onSubmit={searchLog}>
          <label>
            Story ID
            <input value={logStoryId} onChange={(e) => setLogStoryId(e.target.value)} />
          </label>
          <label>
            Search
            <input
              placeholder="Name, story, user…"
              value={logSearchInput}
              onChange={(e) => setLogSearchInput(e.target.value)}
            />
          </label>
          <button type="submit">Search</button>
        </form>

        {logError && <p className="error-text">{logError}</p>}
        {logLoading ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <div className={`log-layout${selectedEntry ? ' has-detail' : ''}`}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Entity</th>
                    <th>Name</th>
                    <th>Story</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      onKeyDown={(e) => onRowKeyDown(e, entry)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selectedEntry?.id === entry.id}
                      className={`clickable-row${selectedEntry?.id === entry.id ? ' is-selected' : ''}`}
                    >
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.operationType}</td>
                      <td>{entry.entityType}</td>
                      <td>{entry.entityName ?? <span className="hint">{entry.entityId}</span>}</td>
                      <td title={entry.storyId}>{entry.storyTitle ?? entry.storyId}</td>
                      <td title={entry.userId}>{entry.username ?? entry.userId}</td>
                    </tr>
                  ))}
                  {logEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        No entries. Search above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedEntry && (
              <div className="detail-panel">
                <h3>Operation detail</h3>
                <dl>
                  <dt>Type</dt>
                  <dd>{selectedEntry.operationType}</dd>
                  <dt>Entity</dt>
                  <dd>
                    {selectedEntry.entityType}
                    {selectedEntry.entityName ? ` · ${selectedEntry.entityName}` : ''}
                  </dd>
                  <dt>ID</dt>
                  <dd className="mono-code">{selectedEntry.entityId}</dd>
                  <dt>Story</dt>
                  <dd title={selectedEntry.storyId}>
                    {selectedEntry.storyTitle ?? selectedEntry.storyId}
                  </dd>
                  <dt>User</dt>
                  <dd title={selectedEntry.userId}>
                    {selectedEntry.username ?? selectedEntry.userId}
                  </dd>
                  <dt>Operation version</dt>
                  <dd>{selectedEntry.operationVersion}</dd>
                  <dt>Entity version</dt>
                  <dd>{selectedEntry.entityVersion ?? '-'}</dd>
                  <dt>When</dt>
                  <dd>{new Date(selectedEntry.createdAt).toLocaleString()}</dd>
                </dl>
                <pre>{JSON.stringify(selectedEntry.payload, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
