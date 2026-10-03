import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AdminMessage, AdminMessageDetail, AdminMessageListQuery } from '@keres/shared';
import { MESSAGE_BODY_MAX_LENGTH } from '@keres/shared/metadata/MessageLimits';
import { announceMessagesChanged, MessagesApiService } from '../../api/MessagesApiService';
import { Modal } from '../../components/Modal';

type Source = AdminMessageListQuery['source'];
type ReadFilter = AdminMessageListQuery['read'];
type ArchiveFilter = AdminMessageListQuery['archived'];
type Sort = AdminMessageListQuery['sort'];
type Order = AdminMessageListQuery['order'];

const PAGE_SIZE = 25;
const PREVIEW_LENGTH = 90;

const SOURCES: Source[] = ['all', 'site', 'user'];
const READ_FILTERS: ReadFilter[] = ['all', 'unread', 'read'];
const ARCHIVE_FILTERS: ArchiveFilter[] = ['active', 'archived', 'all'];
const SORTS: Sort[] = ['date', 'sender', 'subject'];
const ORDERS: Order[] = ['desc', 'asc'];

/** The sender as one line: `@tag` of a registered user (linked to their account), or the site visitor's address. */
function Sender({ message }: { message: AdminMessage }) {
  const { t } = useTranslation('admin');
  if (!message.user) {
    return <>{message.contactEmail}</>;
  }
  return (
    <>
      <Link to={`/users/${message.user.id}`}>@{message.user.tag}</Link>{' '}
      <span className="hint">
        {message.user.username}
        {message.user.isDeleted ? ` ${t('messages.deletedAccount')}` : ''}
      </span>
    </>
  );
}

function preview(message: AdminMessage): string {
  const text = message.subject ?? message.body;
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

export function MessagesPage() {
  const { t, i18n } = useTranslation('admin');
  const [items, setItems] = useState<AdminMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [read, setRead] = useState<ReadFilter>('all');
  const [archived, setArchived] = useState<ArchiveFilter>('active');
  const [sort, setSort] = useState<Sort>('date');
  const [order, setOrder] = useState<Order>('desc');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminMessageDetail | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const noticeModal = notice && (
    <Modal title={t('common.notice')} onClose={() => setNotice(null)}>
      <p>{notice}</p>
    </Modal>
  );

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    MessagesApiService.list({
      search: search || undefined,
      source,
      read,
      archived,
      sort,
      order,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (ignore) return;
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [search, source, read, archived, sort, order, page, reloadToken]);

  const reload = () => {
    setReloadToken((n) => n + 1);
    announceMessagesChanged();
  };

  /** A filter changed: the old page number means nothing for the new result. */
  const filterChanged =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const when = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(i18n.language);
  };

  const open = async (id: string) => {
    try {
      setDetail(await MessagesApiService.open(id));
      setReplyText('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  const close = () => {
    setDetail(null);
    reload();
  };

  const patch = async (message: AdminMessage, change: { read?: boolean; archived?: boolean }) => {
    try {
      const updated = await MessagesApiService.patch(message.id, change);
      setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setDetail((current) =>
        current && current.message.id === updated.id ? { ...current, message: updated } : current,
      );
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  const remove = async (message: AdminMessage) => {
    if (!confirm(t('messages.confirmDelete'))) return;
    try {
      await MessagesApiService.remove(message.id);
      setDetail(null);
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  };

  const removeReply = async (reply: AdminMessage) => {
    if (!confirm(t('messages.confirmDeleteReply'))) return;
    try {
      await MessagesApiService.remove(reply.id);
      setDetail((current) =>
        current
          ? { ...current, thread: current.thread.filter((entry) => entry.id !== reply.id) }
          : current,
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !replyText.trim()) return;
    setReplying(true);
    try {
      const reply = await MessagesApiService.reply(detail.message.id, replyText);
      setDetail({
        message: { ...detail.message, isRead: true },
        thread: [...detail.thread, reply],
      });
      setReplyText('');
      reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : t('messages.replyFailed'));
    } finally {
      setReplying(false);
    }
  };

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (detail) {
    const { message, thread } = detail;
    const fromSite = message.channel === 'site';
    return (
      <div>
        <div className="page-header">
          <h1>{t('messages.title')}</h1>
        </div>
        <div className="form-card message-detail">
          <h3>
            {fromSite
              ? (message.subject ?? t('messages.noSubject'))
              : t('messages.fromUser', { name: `@${message.user?.tag ?? ''}` })}
          </h3>
          <p className="hint">
            <span className={`status-badge${fromSite ? '' : ' accent'}`}>
              {fromSite ? t('messages.originSite') : t('messages.originUser')}
            </span>{' '}
            <Sender message={message} /> · {when(message.createdAt)}
            {message.isArchived ? ` · ${t('messages.archivedBadge')}` : ''}
          </p>

          {fromSite ? (
            <>
              <p className="message-body">{message.body}</p>
              <p className="hint">{t('messages.siteReplyHint')}</p>
            </>
          ) : (
            <ol className="message-thread" aria-label={t('messages.conversation')}>
              {thread.map((entry) => (
                <li
                  key={entry.id}
                  className={`${entry.fromAdmin ? 'from-admin' : 'from-user'}${
                    entry.id === message.id ? ' is-opened' : ''
                  }`}
                >
                  <div className="hint">
                    {entry.fromAdmin ? t('messages.fromAdmins') : `@${entry.user?.tag ?? ''}`} ·{' '}
                    {when(entry.createdAt)}
                  </div>
                  <p className="message-body">{entry.body}</p>
                  {entry.fromAdmin && (
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => void removeReply(entry)}
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!fromSite && !message.user?.isDeleted && (
            <form className="message-reply" onSubmit={(e) => void sendReply(e)}>
              <label>
                {t('messages.reply')}
                <textarea
                  rows={4}
                  maxLength={MESSAGE_BODY_MAX_LENGTH}
                  value={replyText}
                  placeholder={t('messages.replyPlaceholder')}
                  onChange={(e) => setReplyText(e.target.value)}
                />
              </label>
              <span className="hint">
                {t('messages.replyHint')} · {replyText.length} / {MESSAGE_BODY_MAX_LENGTH}
              </span>
              <div className="form-actions">
                <button type="submit" disabled={replying || !replyText.trim()}>
                  {t('messages.send')}
                </button>
              </div>
            </form>
          )}

          <div className="form-actions">
            {fromSite && (
              <a
                className="button button-secondary"
                href={`mailto:${message.contactEmail ?? ''}?subject=${encodeURIComponent(`Re: ${message.subject ?? ''}`)}`}
              >
                {t('messages.replyByEmail')}
              </a>
            )}
            <button type="button" className="button-secondary" onClick={close}>
              {t('common.done')}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void patch(message, { read: !message.isRead })}
            >
              {message.isRead ? t('messages.markUnread') : t('messages.markRead')}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void patch(message, { archived: !message.isArchived })}
            >
              {message.isArchived ? t('messages.unarchive') : t('messages.archive')}
            </button>
            <button type="button" className="button-danger" onClick={() => void remove(message)}>
              {t('common.delete')}
            </button>
          </div>
        </div>
        {noticeModal}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('messages.title')}</h1>
      </div>

      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label>
          {t('common.search')}
          <input
            placeholder={t('messages.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t('messages.searchAriaLabel')}
          />
        </label>
        <label>
          {t('messages.filterSource')}
          <select
            value={source}
            onChange={(e) => filterChanged(setSource)(e.target.value as Source)}
          >
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {t(`messages.source.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('messages.filterRead')}
          <select
            value={read}
            onChange={(e) => filterChanged(setRead)(e.target.value as ReadFilter)}
          >
            {READ_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`messages.read.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('messages.filterArchived')}
          <select
            value={archived}
            onChange={(e) => filterChanged(setArchived)(e.target.value as ArchiveFilter)}
          >
            {ARCHIVE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`messages.archived.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('messages.sortBy')}
          <select value={sort} onChange={(e) => filterChanged(setSort)(e.target.value as Sort)}>
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`messages.sort.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('messages.order')}
          <select value={order} onChange={(e) => filterChanged(setOrder)(e.target.value as Order)}>
            {ORDERS.map((value) => (
              <option key={value} value={value}>
                {t(`messages.orderOption.${value}`)}
              </option>
            ))}
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
                <th>{t('messages.columnStatus')}</th>
                <th>{t('messages.columnOrigin')}</th>
                <th>{t('messages.columnFrom')}</th>
                <th>{t('messages.columnMessage')}</th>
                <th>{t('messages.columnWhen')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((message) => (
                <tr
                  key={message.id}
                  className={`${message.isRead ? '' : 'row-unread'}${message.isArchived ? ' row-archived' : ''}`}
                >
                  <td>
                    {message.isRead ? '' : t('messages.unread')}
                    {message.isArchived && (
                      <span className="status-badge">{t('messages.archivedBadge')}</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge${message.channel === 'site' ? '' : ' accent'}`}>
                      {message.channel === 'site'
                        ? t('messages.originSite')
                        : t('messages.originUser')}
                    </span>
                  </td>
                  <td>
                    <Sender message={message} />
                  </td>
                  <td className="message-cell">{preview(message)}</td>
                  <td>{when(message.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => void open(message.id)}>
                        {t('messages.open')}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void patch(message, { archived: !message.isArchived })}
                      >
                        {message.isArchived ? t('messages.unarchive') : t('messages.archive')}
                      </button>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => void remove(message)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {t('messages.empty')}
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
      {noticeModal}
    </div>
  );
}
