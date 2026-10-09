import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type {
  AdminPaymentEvent,
  AdminPaymentHealth,
  AdminPaymentSummary,
  AdminPaymentUser,
  AdminSubscription,
} from '@keres/shared';
import {
  GIFT_PROVIDER_ID,
  PAYMENT_LEDGER_KINDS,
  PAYMENT_WARNING_DAYS,
  SUBSCRIPTION_STATUSES,
} from '@keres/shared/metadata/Payments';
import { PaymentsApiService } from '../../api/PaymentsApiService';
import { Pagination } from '../../components/Pagination';

const PAGE_SIZE = 25;
/** A payment can happen at any moment, away from this page: it looks again by itself while it is in view. */
export const REFRESH_MS = 10_000;

type View = 'subscriptions' | 'ledger';

function UserCell({ user }: { user: AdminPaymentUser | null }) {
  const { t } = useTranslation('admin');
  if (!user) return <>-</>;
  return (
    <>
      {user.isDeleted ? `@${user.tag}` : <Link to={`/users/${user.id}`}>@{user.tag}</Link>}{' '}
      <span className="hint">
        {user.username}
        {user.isDeleted ? ` ${t('payments.deletedAccount')}` : ''}
      </span>
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'bad' | 'warn';
}) {
  return (
    <div className={`stat-card${tone ? ` is-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * Payments for the administrators: who is paid up, who is late, who is leaving, and what came in - the
 * situation and the key values, read only. There is nothing else to show: no way to pay is kept anywhere,
 * so the provider's own reference is what an administrator uses to find a payment there.
 */
export function PaymentsPage() {
  const { t, i18n } = useTranslation('admin');
  const [summary, setSummary] = useState<AdminPaymentSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [health, setHealth] = useState<AdminPaymentHealth | null>(null);
  const [view, setView] = useState<View>('subscriptions');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [page, setPage] = useState(1);
  // Bumped by the timer: a look at the same page again, without the "loading" flash or losing the place.
  const [tick, setTick] = useState(0);
  const silent = useRef(false);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [events, setEvents] = useState<AdminPaymentEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    PaymentsApiService.summary()
      .then((result) => {
        if (!ignore) {
          setSummary(result);
          setSummaryError(null);
        }
      })
      .catch((err) => {
        if (!ignore) setSummaryError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [tick]);

  // The health panel is a side note: if it cannot be read the page is still the page.
  useEffect(() => {
    let ignore = false;
    PaymentsApiService.health()
      .then((result) => {
        if (!ignore) setHealth(result);
      })
      .catch(() => {
        if (!ignore) setHealth(null);
      });
    return () => {
      ignore = true;
    };
  }, [tick]);

  const look = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    silent.current = true;
    setTick((value) => value + 1);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(look, REFRESH_MS);
    // Coming back to the tab is the likeliest moment for something new to be there.
    window.addEventListener('focus', look);
    document.addEventListener('visibilitychange', look);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', look);
      document.removeEventListener('visibilitychange', look);
    };
  }, [look]);

  useEffect(() => {
    let ignore = false;
    const quiet = silent.current;
    silent.current = false;
    if (!quiet) setLoading(true);
    setError(null);
    const load =
      view === 'subscriptions'
        ? PaymentsApiService.subscriptions({
            status: status as 'all',
            search: appliedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          }).then((result) => {
            if (ignore) return;
            setSubscriptions(result.items);
            setTotal(result.total);
          })
        : PaymentsApiService.events({
            kind: kind as 'all',
            search: appliedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
          }).then((result) => {
            if (ignore) return;
            setEvents(result.items);
            setTotal(result.total);
          });
    load
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [view, status, kind, appliedSearch, page, tick]);

  const money = (cents: number | null, currency: string | null) => {
    if (cents === null) return '-';
    const code = currency ?? summary?.currency ?? 'BRL';
    try {
      return new Intl.NumberFormat(i18n.language, { style: 'currency', currency: code }).format(
        cents / 100,
      );
    } catch {
      return `${(cents / 100).toFixed(2)} ${code}`;
    }
  };
  // A plan given by an administrator has no provider: say what it is, not the id it is stored under.
  const providerLabel = (providerId: string) =>
    providerId === GIFT_PROVIDER_ID ? t('payments.giftProvider') : providerId;
  const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language);

  const switchView = (next: View) => {
    setView(next);
    setPage(1);
  };
  const searchPlaceholder =
    view === 'subscriptions'
      ? t('payments.searchPlaceholder')
      : t('payments.searchLedgerPlaceholder');

  return (
    <div>
      <div className="page-header">
        <h1>{t('payments.title')}</h1>
      </div>
      <p className="hint">{t('payments.intro')}</p>

      {summaryError && <p className="error-text">{summaryError}</p>}
      {summary && !summary.enabled && (
        <p className="notice" role="status">
          {t('payments.noConnector')}
        </p>
      )}
      {summary?.noDefaultTier && (
        <p className="notice" role="alert" data-testid="no-default-tier">
          {t('payments.noDefaultTier')}
        </p>
      )}
      {summary?.enabled && summary.provider && (
        <p className="hint">{t('payments.provider', { name: summary.provider.displayName })}</p>
      )}
      {summary && (
        <div className="stat-cards">
          <SummaryCard label={t('payments.active')} value={summary.subscriptions.active} />
          <SummaryCard
            label={t('payments.due')}
            value={summary.subscriptions.due}
            tone={summary.subscriptions.due > 0 ? 'warn' : undefined}
          />
          <SummaryCard label={t('payments.canceled')} value={summary.subscriptions.canceled} />
          <SummaryCard
            label={t('payments.endingSoon', { days: PAYMENT_WARNING_DAYS })}
            value={summary.endingSoon}
            tone={summary.endingSoon > 0 ? 'warn' : undefined}
          />
          <SummaryCard
            label={t('payments.received30')}
            value={money(summary.last30Days.amountCents, summary.currency)}
          />
          <SummaryCard label={t('payments.payments30')} value={summary.last30Days.payments} />
          <SummaryCard
            label={t('payments.failures30')}
            value={summary.last30Days.failures}
            tone={summary.last30Days.failures > 0 ? 'bad' : undefined}
          />
          {summary.last30Days.refundedCents > 0 && (
            <SummaryCard
              label={t('payments.refunded30')}
              value={money(summary.last30Days.refundedCents, summary.currency)}
              tone="warn"
            />
          )}
          <SummaryCard
            label={t('payments.monthlyRecurring')}
            value={money(summary.monthlyRecurringCents, summary.currency)}
          />
        </div>
      )}

      {health && (
        <section
          className="card"
          data-testid="payments-health"
          aria-label={t('payments.health.title')}
        >
          <h2>{t('payments.health.title')}</h2>
          {health.warnings.map((code) => (
            <p key={code} className="notice" role="alert" data-testid={`payments-warning-${code}`}>
              {t(`payments.warnings.${code}`)}
            </p>
          ))}
          <ul className="plain-list">
            <li>
              {health.connector.connected
                ? t('payments.health.connected', {
                    id: health.connector.id,
                    capabilities:
                      health.connector.capabilities.join(', ') || t('payments.health.noOptional'),
                  })
                : t('payments.health.notConnected')}
            </li>
            <li>
              {health.lastNoticeAt
                ? t('payments.health.lastNotice', { when: when(health.lastNoticeAt) })
                : t('payments.health.noNotice')}
            </li>
            <li>
              {health.reconciliation
                ? t('payments.health.safetyNet', {
                    when: when(health.reconciliation.lastRunAt),
                    subscriptions: health.reconciliation.subscriptionsAsked,
                    attempts: health.reconciliation.attemptsAsked,
                    found: health.reconciliation.found,
                  })
                : t('payments.health.safetyNetNotYet')}
            </li>
            <li>
              {t('payments.health.overdue', {
                renewing: health.overdue.renewing,
                due: health.overdue.due,
              })}
            </li>
          </ul>
        </section>
      )}

      <div className="tabs" role="tablist">
        {(['subscriptions', 'ledger'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            className={view === tab ? 'tab active' : 'tab button-secondary'}
            onClick={() => switchView(tab)}
          >
            {t(`payments.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
          setPage(1);
        }}
      >
        <label>
          {t('common.search')}
          <input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {view === 'subscriptions' ? (
          <label>
            {t('payments.status')}
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t('payments.statusAll')}</option>
              {SUBSCRIPTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`payments.statuses.${value}`)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {t('payments.kind')}
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t('payments.kindAll')}</option>
              {PAYMENT_LEDGER_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`payments.kinds.${value}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">{t('common.search')}</button>
      </form>
      <p className="hint" data-testid="payments-live">
        {t('payments.autoRefresh', { seconds: REFRESH_MS / 1000 })}
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : view === 'subscriptions' ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.columnUser')}</th>
                <th>{t('payments.columnPlan')}</th>
                <th>{t('payments.columnStatus')}</th>
                <th>{t('payments.columnPaidUntil')}</th>
                <th>{t('payments.columnLastPayment')}</th>
                <th>{t('payments.columnAmount')}</th>
                <th>{t('payments.columnProvider')}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((item) => (
                <tr key={item.user?.id ?? item.providerReference ?? item.createdAt}>
                  <td>
                    <UserCell user={item.user} />
                  </td>
                  <td>
                    {item.tierName}{' '}
                    <span className="hint">{t(`payments.intervals.${item.interval}`)}</span>
                  </td>
                  <td>
                    <span
                      className={`status-badge subscription-${item.status}`}
                      data-status={item.status}
                    >
                      {t(`payments.statuses.${item.status}`)}
                    </span>
                    {item.cancelAtPeriodEnd && item.status === 'active' && (
                      <span className="hint"> {t('payments.leaving')}</span>
                    )}
                  </td>
                  <td>{day(item.paidUntil)}</td>
                  <td>{item.lastPaymentAt ? day(item.lastPaymentAt) : '-'}</td>
                  <td>{money(item.amountCents, item.currency)}</td>
                  <td>
                    {providerLabel(item.providerId)}
                    {item.providerReference && (
                      <>
                        {' '}
                        <code>{item.providerReference}</code>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {t('payments.emptySubscriptions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payments.columnWhen')}</th>
                <th>{t('payments.columnEvent')}</th>
                <th>{t('payments.columnUser')}</th>
                <th>{t('payments.columnPlan')}</th>
                <th>{t('payments.columnAmount')}</th>
                <th>{t('payments.columnProvider')}</th>
                <th>{t('payments.columnDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item) => (
                <tr key={item.id}>
                  <td>{when(item.createdAt)}</td>
                  <td>
                    <span className={`status-badge ledger-${item.kind}`}>
                      {t(`payments.kinds.${item.kind}`)}
                    </span>
                  </td>
                  <td>
                    <UserCell user={item.user} />
                  </td>
                  <td>{item.tierName ?? '-'}</td>
                  <td>{money(item.amountCents, item.currency)}</td>
                  <td>
                    {providerLabel(item.providerId)}
                    {item.providerReference && (
                      <>
                        {' '}
                        <code>{item.providerReference}</code>
                      </>
                    )}
                  </td>
                  <td>{item.detail ?? '-'}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {t('payments.emptyLedger')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
