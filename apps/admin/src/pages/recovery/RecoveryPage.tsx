import { useState } from 'react';
import { DeletedItem, OperationLogEntry, RecoveryApiService } from '../../api/RecoveryApiService';

const ENTITY_TYPES = [
  'Story',
  'Character',
  'Chapter',
  'Scene',
  'Location',
  'Note',
  'WorldRule',
  'Choice',
  'Gallery',
  'GalleryRelation',
  'Item',
  'ItemJourney',
  'CharacterRelation',
  'CharacterScene',
  'Tag',
  'TagRelation',
  'NoteRelation',
  'Suggestion',
];

export function RecoveryPage() {
  const [entityType, setEntityType] = useState('');
  const [storyId, setStoryId] = useState('');
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [logStoryId, setLogStoryId] = useState('');
  const [logEntries, setLogEntries] = useState<OperationLogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<OperationLogEntry | null>(null);

  const search = () => {
    setLoading(true);
    setError(null);
    RecoveryApiService.listDeleted({
      entityType: entityType || undefined,
      storyId: storyId || undefined,
    })
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const restore = async (item: DeletedItem) => {
    if (!confirm(`Restore ${item.entityType} ${item.id}?`)) return;
    try {
      await RecoveryApiService.restore(item.entityType, item.id);
      setItems((prev) =>
        prev.filter((i) => !(i.entityType === item.entityType && i.id === item.id)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const searchLog = () => {
    RecoveryApiService.browseOperationLog({ storyId: logStoryId || undefined, pageSize: 50 })
      .then((res) => setLogEntries(res.items))
      .catch((err) => setError(err.message));
  };

  return (
    <div>
      <h1>Recovery</h1>

      <section>
        <h2>Deleted items</h2>
        <div className="toolbar">
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All entity types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            placeholder="Story ID (optional)"
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
          />
          <button onClick={search}>Search</button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p>Loading...</p>
        ) : (
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
                  <td>{item.id}</td>
                  <td>{item.storyId ?? '-'}</td>
                  <td>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '-'}</td>
                  <td>{item.version}</td>
                  <td>
                    <button onClick={() => restore(item)}>Restore</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7}>No deleted items found. Search above.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Operation log</h2>
        <div className="toolbar">
          <input
            placeholder="Story ID"
            value={logStoryId}
            onChange={(e) => setLogStoryId(e.target.value)}
          />
          <button onClick={searchLog}>Search</button>
        </div>

        <div className="log-layout">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Entity</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="clickable-row"
                >
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>{entry.operationType}</td>
                  <td>
                    {entry.entityType}:{entry.entityId}
                  </td>
                  <td>{entry.userId}</td>
                </tr>
              ))}
              {logEntries.length === 0 && (
                <tr>
                  <td colSpan={4}>No entries. Search above.</td>
                </tr>
              )}
            </tbody>
          </table>

          {selectedEntry && (
            <div className="detail-panel">
              <h3>Operation detail</h3>
              <dl>
                <dt>Type</dt>
                <dd>{selectedEntry.operationType}</dd>
                <dt>Entity</dt>
                <dd>
                  {selectedEntry.entityType}:{selectedEntry.entityId}
                </dd>
                <dt>User</dt>
                <dd>{selectedEntry.userId}</dd>
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
      </section>
    </div>
  );
}
