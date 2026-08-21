import { FormEvent, KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RECOVERABLE_ENTITY_TYPES } from '@keres/shared';
import { DeletedItem, OperationLogEntry, RecoveryApiService } from '../../api/RecoveryApiService';

export function RecoveryPage() {
  const { t, i18n } = useTranslation('admin');
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
    if (!confirm(t('recovery.confirmRestore', { entityType: item.entityType, label }))) return;
    try {
      await RecoveryApiService.restore(item.entityType, item.id);
      setItems((prev) =>
        prev.filter((i) => !(i.entityType === item.entityType && i.id === item.id)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.restoreFailed'));
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
    return item.storyId ?? t('common.none');
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('recovery.title')}</h1>
      </div>

      <section>
        <h2>{t('recovery.deletedItems')}</h2>
        <form className="toolbar" onSubmit={search}>
          <label>
            {t('recovery.entityType')}
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">{t('recovery.allEntityTypes')}</option>
              {RECOVERABLE_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('recovery.storyId')}
            <input
              placeholder={t('common.optional')}
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
            />
          </label>
          <label>
            {t('common.search')}
            <input
              placeholder={t('recovery.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
                  <th>{t('recovery.columnEntity')}</th>
                  <th>{t('recovery.columnName')}</th>
                  <th>{t('recovery.columnId')}</th>
                  <th>{t('recovery.columnStory')}</th>
                  <th>{t('recovery.columnDeletedAt')}</th>
                  <th>{t('recovery.columnVersion')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.entityType}:${item.id}`}>
                    <td>{item.entityType}</td>
                    <td>{item.name ?? <span className="hint">{t('recovery.unnamed')}</span>}</td>
                    <td className="mono-code">{item.id}</td>
                    <td>{storyCell(item)}</td>
                    <td>
                      {item.deletedAt
                        ? new Date(item.deletedAt).toLocaleString(i18n.language)
                        : t('common.none')}
                    </td>
                    <td>{item.version}</td>
                    <td>
                      <button type="button" onClick={() => void restore(item)}>
                        {t('common.restore')}
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      {t('recovery.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>{t('recovery.operationLog')}</h2>
        <form className="toolbar" onSubmit={searchLog}>
          <label>
            {t('recovery.storyId')}
            <input value={logStoryId} onChange={(e) => setLogStoryId(e.target.value)} />
          </label>
          <label>
            {t('common.search')}
            <input
              placeholder={t('recovery.logSearchPlaceholder')}
              value={logSearchInput}
              onChange={(e) => setLogSearchInput(e.target.value)}
            />
          </label>
          <button type="submit">{t('common.search')}</button>
        </form>

        {logError && <p className="error-text">{logError}</p>}
        {logLoading ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : (
          <div className={`log-layout${selectedEntry ? ' has-detail' : ''}`}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('recovery.columnWhen')}</th>
                    <th>{t('recovery.columnType')}</th>
                    <th>{t('recovery.columnEntity')}</th>
                    <th>{t('recovery.columnName')}</th>
                    <th>{t('recovery.columnStory')}</th>
                    <th>{t('recovery.columnUser')}</th>
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
                      <td>{new Date(entry.createdAt).toLocaleString(i18n.language)}</td>
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
                        {t('recovery.logEmpty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedEntry && (
              <div className="detail-panel">
                <h3>{t('recovery.operationDetail')}</h3>
                <dl>
                  <dt>{t('recovery.columnType')}</dt>
                  <dd>{selectedEntry.operationType}</dd>
                  <dt>{t('recovery.columnEntity')}</dt>
                  <dd>
                    {selectedEntry.entityType}
                    {selectedEntry.entityName ? ` · ${selectedEntry.entityName}` : ''}
                  </dd>
                  <dt>{t('recovery.columnId')}</dt>
                  <dd className="mono-code">{selectedEntry.entityId}</dd>
                  <dt>{t('recovery.columnStory')}</dt>
                  <dd title={selectedEntry.storyId}>
                    {selectedEntry.storyTitle ?? selectedEntry.storyId}
                  </dd>
                  <dt>{t('recovery.columnUser')}</dt>
                  <dd title={selectedEntry.userId}>
                    {selectedEntry.username ?? selectedEntry.userId}
                  </dd>
                  <dt>{t('recovery.operationVersion')}</dt>
                  <dd>{selectedEntry.operationVersion}</dd>
                  <dt>{t('recovery.entityVersion')}</dt>
                  <dd>{selectedEntry.entityVersion ?? t('common.none')}</dd>
                  <dt>{t('recovery.columnWhen')}</dt>
                  <dd>{new Date(selectedEntry.createdAt).toLocaleString(i18n.language)}</dd>
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
