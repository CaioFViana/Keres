import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { AuditEvent, AuditSummary, AuditUserRef } from '@keres/shared';
import { AUDIT_CATEGORIES, AUDIT_OUTCOMES } from '@keres/shared/metadata/AuditEvents';
import { ActivityApiService, type ActivityFilters } from '../../api/ActivityApiService';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { useAdminList } from '../../hooks/useAdminList';

const PAGE_SIZE = 50;
const WINDOWS = [1, 24, 168, 720] as const;

/** The outcome column folded into the action cell: a coloured mark with the word as its label. */
const OUTCOME_MARKS = {
  success: '✓',
  failure: '✕',
  denied: '!',
} as const;

/** `a.b_c` -> `a_b_c`: the locale files nest on dots, so an action's dot cannot be part of a key. */
const actionKey = (action: string) => action.replace('.', '_');

interface Applied {
  search: string;
  category: string;
  outcome: string;
  action: string;
  userId: string;
  from: string;
  to: string;
  order: 'desc' | 'asc';
}

const EMPTY: Applied = {
  search: '',
  category: 'all',
  outcome: 'all',
  action: '',
  userId: '',
  from: '',
  to: '',
  order: 'desc',
};

/** A date typed in the filter as the start / end of that local day, as the server wants it. */
const startOfDay = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
const endOfDay = (value: string) =>
  value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;

function filtersOf(applied: Applied): ActivityFilters {
  return {
    search: applied.search || undefined,
    category: (applied.category === 'all'
      ? undefined
      : applied.category) as ActivityFilters['category'],
    outcome: (applied.outcome === 'all'
      ? undefined
      : applied.outcome) as ActivityFilters['outcome'],
    action: applied.action || undefined,
    userId: applied.userId || undefined,
    from: startOfDay(applied.from),
    to: endOfDay(applied.to),
    order: applied.order,
  };
}

function UserCell({ user }: { user: AuditUserRef | null }) {
  const { t } = useTranslation('admin');
  if (!user) return <>-</>;
  const label = user.tag ? `@${user.tag}` : user.username;
  return (
    <>
      {user.id && !user.isDeleted ? <Link to={`/users/${user.id}`}>{label}</Link> : label}{' '}
      {user.tag && <span className="hint">{user.username}</span>}
      {user.isDeleted && <span className="hint"> {t('activity.deletedAccount')}</span>}
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'bad' | 'warn';
}) {
  return (
    <div className={`stat-card${tone ? ` is-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * The activity record, for the administrators to monitor the server: how it is doing and what happened in
 * the last hours, and below it the whole record - who did what to whom, from where, and how it ended -
 * filterable, followable per user (`?user=`), and exportable. It holds no content: never a password,
 * token or the text of a message.
 */
export function ActivityPage() {
  const { t, i18n } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUser = searchParams.get('user') ?? '';

  const [form, setForm] = useState<Applied>({ ...EMPTY, userId: initialUser });
  const [applied, setApplied] = useState<Applied>({ ...EMPTY, userId: initialUser });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [hours, setHours] = useState<number>(24);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setSummaryError(null);
    ActivityApiService.summary(hours)
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch((err) => {
        if (!ignore) setSummaryError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [hours]);

  const {
    items: events,
    total,
    loading,
    error,
  } = useAdminList(
    () => ActivityApiService.list({ ...filtersOf(applied), page, pageSize: PAGE_SIZE }),
    [applied, page],
  );

  const apply = (next: Applied) => {
    setPage(1);
    setSelected(null);
    setApplied(next);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    apply({ ...form, search: form.search.trim(), action: form.action.trim() });
  };

  const clearUser = () => {
    const next = { ...form, userId: '' };
    setForm(next);
    apply({ ...applied, userId: '' });
    setSearchParams({}, { replace: true });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await ActivityApiService.exportCsv(filtersOf(applied));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `keres-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('activity.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const when = (value: string) => new Date(value).toLocaleString(i18n.language);
  const actionLabel = (action: string) =>
    t(`activity.actions.${actionKey(action)}`, { defaultValue: action });

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, entry: AuditEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelected(entry);
    }
  };

  const maxPerDay = Math.max(1, ...(summary?.perDay.map((day) => day.count) ?? [1]));

  return (
    <div>
      <div className="page-header">
        <h1>{t('activity.title')}</h1>
      </div>

      <section aria-label={t('activity.summaryTitle')} className="activity-summary">
        <div className="toolbar">
          <label>
            {t('activity.window')}
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {WINDOWS.map((value) => (
                <option key={value} value={value}>
                  {t(`activity.windows.h${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {summaryError && <p className="error-text">{summaryError}</p>}
        {summary && (
          <>
            <div className="stat-cards">
              <SummaryCard label={t('activity.cards.events')} value={summary.total} />
              <SummaryCard
                label={t('activity.cards.failedLogins')}
                value={summary.failedLogins}
                tone={summary.failedLogins > 0 ? 'warn' : undefined}
              />
              <SummaryCard
                label={t('activity.cards.denied')}
                value={summary.denied}
                tone={summary.denied > 0 ? 'warn' : undefined}
              />
              <SummaryCard label={t('activity.cards.failures')} value={summary.failures} />
              <SummaryCard label={t('activity.cards.newAccounts')} value={summary.newAccounts} />
              <SummaryCard label={t('activity.cards.messages')} value={summary.messages} />
              <SummaryCard label={t('activity.cards.limitHits')} value={summary.limitHits} />
              <SummaryCard label={t('activity.cards.adminActions')} value={summary.adminActions} />
              <SummaryCard
                label={t('activity.cards.errorLogs')}
                value={summary.system.errorLogs}
                tone={summary.system.errorLogs > 0 ? 'bad' : undefined}
              />
            </div>

            <div className="activity-panels">
              <div className="form-card">
                <h3>{t('activity.perDay')}</h3>
                <div className="bar-chart" role="img" aria-label={t('activity.perDay')}>
                  {summary.perDay.map((day) => (
                    <div key={day.day} className="bar" title={`${day.day}: ${day.count}`}>
                      <span style={{ height: `${(day.count / maxPerDay) * 100}%` }} />
                    </div>
                  ))}
                </div>
                {summary.topFailedLoginIps.length > 0 && (
                  <>
                    <h3>{t('activity.topFailedIps')}</h3>
                    <ul className="plain-list">
                      {summary.topFailedLoginIps.map((entry) => (
                        <li key={entry.ip}>
                          <code>{entry.ip}</code> · {entry.count}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="form-card">
                <h3>{t('activity.system.title')}</h3>
                <dl className="system-info">
                  <dt>{t('activity.system.version')}</dt>
                  <dd>{summary.system.version}</dd>
                  <dt>{t('activity.system.uptime')}</dt>
                  <dd>{formatUptime(summary.system.uptimeSeconds)}</dd>
                  <dt>{t('activity.system.database')}</dt>
                  <dd>{summary.system.databaseDriver}</dd>
                  <dt>{t('activity.system.runtime')}</dt>
                  <dd>{summary.system.runtime}</dd>
                  <dt>{t('activity.system.memory')}</dt>
                  <dd>{summary.system.memoryRssMb} MB</dd>
                  <dt>{t('activity.system.users')}</dt>
                  <dd>
                    {t('activity.system.usersValue', {
                      active: summary.system.users.active,
                      deleted: summary.system.users.deleted,
                      admins: summary.system.users.admins,
                    })}
                  </dd>
                  <dt>{t('activity.system.stories')}</dt>
                  <dd>{summary.system.stories}</dd>
                  <dt>{t('activity.system.retention')}</dt>
                  <dd>
                    {t('activity.system.retentionValue', { days: summary.system.retentionDays })}
                  </dd>
                </dl>
              </div>
            </div>
          </>
        )}
      </section>

      <h2>{t('activity.recordTitle')}</h2>
      <p className="hint">{t('activity.privacyNote')}</p>

      {applied.userId && (
        <p className="filter-chip">
          {t('activity.filteredByUser', { id: applied.userId })}{' '}
          <button type="button" className="button-secondary" onClick={clearUser}>
            {t('activity.clearUser')}
          </button>
        </p>
      )}

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          {t('common.search')}
          <input
            placeholder={t('activity.searchPlaceholder')}
            value={form.search}
            onChange={(e) => setForm({ ...form, search: e.target.value })}
          />
        </label>
        <label>
          {t('activity.category')}
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="all">{t('activity.all')}</option>
            {AUDIT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`activity.categories.${category}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('activity.outcome')}
          <select
            value={form.outcome}
            onChange={(e) => setForm({ ...form, outcome: e.target.value })}
          >
            <option value="all">{t('activity.all')}</option>
            {AUDIT_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {t(`activity.outcomes.${outcome}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('activity.action')}
          <input
            placeholder={t('activity.actionPlaceholder')}
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
          />
        </label>
        <label>
          {t('activity.from')}
          <input
            type="date"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </label>
        <label>
          {t('activity.to')}
          <input
            type="date"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <label>
          {t('activity.order')}
          <select
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value as Applied['order'] })}
          >
            <option value="desc">{t('activity.orderDesc')}</option>
            <option value="asc">{t('activity.orderAsc')}</option>
          </select>
        </label>
        <button type="submit">{t('common.search')}</button>
        <button
          type="button"
          className="button-secondary"
          disabled={exporting}
          onClick={() => void exportCsv()}
        >
          {t('activity.export')}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className={`log-layout${selected ? ' has-detail' : ''}`}>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('activity.columnWhen')}</th>
                  <th>{t('activity.columnAction')}</th>
                  <th>{t('activity.columnActor')}</th>
                  <th>{t('activity.columnSubject')}</th>
                  <th>{t('activity.columnIp')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    onKeyDown={(e) => onRowKeyDown(e, entry)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected?.id === entry.id}
                    className={`clickable-row${selected?.id === entry.id ? ' is-selected' : ''}`}
                  >
                    <td>{when(entry.createdAt)}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--icon outcome-${entry.outcome}`}
                        title={t(`activity.outcomes.${entry.outcome}`)}
                        aria-label={t(`activity.outcomes.${entry.outcome}`)}
                      >
                        {OUTCOME_MARKS[entry.outcome]}
                      </span>{' '}
                      <span className="status-badge">
                        {t(`activity.categories.${entry.category}`)}
                      </span>{' '}
                      {actionLabel(entry.action)}
                    </td>
                    <td>
                      <UserCell user={entry.actor} />
                    </td>
                    <td>
                      <UserCell user={entry.subject} />
                    </td>
                    <td>{entry.ip ?? '-'}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      {t('activity.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="detail-panel">
              <div className="detail-header">
                <h3>{actionLabel(selected.action)}</h3>
                <button type="button" onClick={() => setSelected(null)}>
                  {t('common.close')}
                </button>
              </div>
              <dl>
                <dt>{t('activity.columnWhen')}</dt>
                <dd>{when(selected.createdAt)}</dd>
                <dt>{t('activity.category')}</dt>
                <dd>{t(`activity.categories.${selected.category}`)}</dd>
                <dt>{t('activity.columnOutcome')}</dt>
                <dd>{t(`activity.outcomes.${selected.outcome}`)}</dd>
                <dt>{t('activity.columnActor')}</dt>
                <dd>
                  <UserCell user={selected.actor} />
                </dd>
                <dt>{t('activity.columnSubject')}</dt>
                <dd>
                  <UserCell user={selected.subject} />
                </dd>
                <dt>{t('activity.target')}</dt>
                <dd>
                  {selected.targetType ? `${selected.targetType} ${selected.targetId ?? ''}` : '-'}
                </dd>
                <dt>{t('activity.columnIp')}</dt>
                <dd>{selected.ip ?? '-'}</dd>
                <dt>{t('activity.userAgent')}</dt>
                <dd>{selected.userAgent ?? '-'}</dd>
                <dt>{t('activity.rawAction')}</dt>
                <dd>
                  <code>{selected.action}</code>
                </dd>
              </dl>
              <pre>{JSON.stringify(selected.meta, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {notice && (
        <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Modal>
      )}
    </div>
  );
}
