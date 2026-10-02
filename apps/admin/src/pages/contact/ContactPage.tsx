import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContactMessage } from '@keres/shared';
import { ContactApiService } from '../../api/ContactApiService';

export function ContactPage() {
  const { t } = useTranslation('admin');
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    ContactApiService.list()
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = async (id: string) => {
    try {
      const message = await ContactApiService.get(id);
      setSelected(message);
      setMessages((rows) => rows.map((row) => (row.id === id ? message : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.actionFailed'));
    }
  };

  const remove = async (message: ContactMessage) => {
    if (!confirm(t('contact.confirmDelete', { subject: message.subject }))) return;
    try {
      await ContactApiService.remove(message.id);
      setMessages((rows) => rows.filter((row) => row.id !== message.id));
      setSelected((current) => (current?.id === message.id ? null : current));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  };

  const when = (value: ContactMessage['createdAt']) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('contact.title')}</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {selected ? (
        <div className="form-card">
          <h3>{selected.subject}</h3>
          <p className="hint">
            {selected.contactEmail} · {when(selected.createdAt)}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</p>
          <div className="form-actions">
            <a
              className="button button-secondary"
              href={`mailto:${selected.contactEmail}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
            >
              {t('contact.replyByEmail')}
            </a>
            <button type="button" className="button-secondary" onClick={() => setSelected(null)}>
              {t('common.done')}
            </button>
            <button type="button" className="button-danger" onClick={() => void remove(selected)}>
              {t('common.delete')}
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('contact.columnStatus')}</th>
                <th>{t('contact.columnSubject')}</th>
                <th>{t('contact.columnEmail')}</th>
                <th>{t('contact.columnWhen')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className={message.isRead ? '' : 'row-unread'}>
                  <td>{message.isRead ? '' : t('contact.unread')}</td>
                  <td>{message.subject}</td>
                  <td>{message.contactEmail}</td>
                  <td>{when(message.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => void open(message.id)}>
                        {t('contact.open')}
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
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t('contact.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
