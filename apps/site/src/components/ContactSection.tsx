import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LandingApiError, sendContactMessage } from '../api/landing';

export function ContactSection() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await sendContactMessage({ subject, body, contactEmail });
      setSent(true);
    } catch (err) {
      // The API's rejection messages are user-facing (validation, rate limit).
      setError(err instanceof LandingApiError ? err.message : t('contact.failed'));
    } finally {
      setSending(false);
    }
  };

  const sendAnother = () => {
    setSubject('');
    setBody('');
    setContactEmail('');
    setSent(false);
  };

  return (
    <section className="band" id="contact">
      <div className="section-inner">
        <header className="section-head">
          <h2>{t('contact.title')}</h2>
          <p>{t('contact.lead')}</p>
        </header>
        {sent ? (
          <div className="card">
            <p>{t('contact.sent')}</p>
            <button type="button" className="button button-ghost" onClick={sendAnother}>
              {t('contact.sendAnother')}
            </button>
          </div>
        ) : (
          <form className="contact-form" onSubmit={(e) => void submit(e)}>
            <label>
              {t('contact.subject')}
              <input
                type="text"
                value={subject}
                maxLength={120}
                required
                placeholder={t('contact.subjectPlaceholder')}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label>
              {t('contact.email')}
              <input
                type="email"
                value={contactEmail}
                maxLength={254}
                required
                placeholder={t('contact.emailPlaceholder')}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
            <label>
              {t('contact.body')}
              <textarea
                value={body}
                maxLength={5000}
                required
                rows={6}
                placeholder={t('contact.bodyPlaceholder')}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="button button-primary" disabled={sending}>
              {sending ? t('contact.sending') : t('contact.send')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
