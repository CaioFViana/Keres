import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AccessRecord } from '@keres/shared';
import { AccessRecordsApiService, type AccessRecordFilters } from '@/api/AccessRecordsApiService';
import { Modal } from '@/components/Modal';

const PAGE_SIZE = 50;
/** The server's cap on one export (`ACCESS_RECORD_EXPORT_MAX_ROWS`): what a truncated export says it holds. */
const EXPORT_MAX_ROWS = 50_000;
/** An account's id is a ULID; anything else typed in the account box is a name. */
const ID_SHAPE = /^[0-9A-Z]{26}$/;
/** Days in the note's month: the retention is kept in days and shown in months. */
const DAYS_PER_MONTH = 30;

interface Applied {
  account: string;
  address: string;
  from: string;
  to: string;
}

const EMPTY: Applied = { account: '', address: '', from: '', to: '' };

/** A date typed in the filter as the start / end of that local day, as the server wants it. */
const startOfDay = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
const endOfDay = (value: string) =>
  value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;

function filtersOf(applied: Applied): AccessRecordFilters {
  const account = applied.account.trim();
  const isId = ID_SHAPE.test(account);
  return {
    userId: account && isId ? account : undefined,
    username: account && !isId ? account : undefined,
    ip: applied.address.trim() || undefined,
    from: startOfDay(applied.from),
    to: endOfDay(applied.to),
  };
}

/**
 * The access records: when somebody signed in (or tried to), signed up, recovered an account or renewed a session,
 * and from which address. Kept for the months the law asks, under secrecy, so the page says so and says for how
 * long. Reading it and exporting it are themselves on the activity record (by the server).
 */
export function AccessRecordsPage() {
  const { t, i18n } = useTranslation('admin');
  const [form, setForm] = useState<Applied>(EMPTY);
  const [applied, setApplied] = useState<Applied>(EMPTY);
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    AccessRecordsApiService.list({ ...filtersOf(applied), limit: PAGE_SIZE })
      .then((page) => {
        if (ignore) return;
        setRecords(page.items);
        setNextCursor(page.nextCursor);
        setRetentionDays(page.retentionDays);
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // Only `applied` starts a search: typing in the form does not, until it is submitted.
  }, [applied]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setApplied({ ...form, account: form.account.trim(), address: form.address.trim() });
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await AccessRecordsApiService.list({
        ...filtersOf(applied),
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setRecords((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('accessRecords.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, truncated } = await AccessRecordsApiService.exportCsv(filtersOf(applied));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `keres-access-records-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      if (truncated) {
        setNotice(t('accessRecords.exportTruncated', { count: EXPORT_MAX_ROWS }));
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('accessRecords.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const when = (value: string) => new Date(value).toLocaleString(i18n.language);
  const months =
    retentionDays === null ? null : Math.max(1, Math.round(retentionDays / DAYS_PER_MONTH));

  return (
    <div>
      <div className="page-header">
        <h1>{t('accessRecords.title')}</h1>
      </div>
      <p className="hint">{t('accessRecords.intro')}</p>
      {months !== null && <p className="hint">{t('accessRecords.retentionNote', { months })}</p>}

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          {t('accessRecords.account')}
          <input
            placeholder={t('accessRecords.accountPlaceholder')}
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
          />
        </label>
        <label>
          {t('accessRecords.address')}
          <input
            placeholder={t('accessRecords.addressPlaceholder')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label>
          {t('accessRecords.from')}
          <input
            type="date"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </label>
        <label>
          {t('accessRecords.to')}
          <input
            type="date"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <button type="submit">{t('accessRecords.search')}</button>
        <button
          type="button"
          className="button-secondary"
          disabled={exporting}
          onClick={() => void exportCsv()}
        >
          {t('accessRecords.export')}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('accessRecords.columnWhen')}</th>
                <th>{t('accessRecords.columnEvent')}</th>
                <th>{t('accessRecords.columnAccount')}</th>
                <th>{t('accessRecords.columnAddress')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{when(record.occurredAt)}</td>
                  <td>{t(`accessRecords.events.${record.event}`)}</td>
                  <td>
                    {record.userId && record.username ? (
                      <Link to={`/users/${record.userId}`}>{record.username}</Link>
                    ) : record.usernameTried ? (
                      <>
                        <span className="hint">{t('accessRecords.nameTried')}</span>{' '}
                        {record.usernameTried}
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <code>{record.ip}</code>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {t('accessRecords.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && !loading && (
        <div className="toolbar">
          <button
            type="button"
            className="button-secondary"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {t('accessRecords.loadMore')}
          </button>
        </div>
      )}

      {notice && (
        <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </Modal>
      )}
    </div>
  );
}
