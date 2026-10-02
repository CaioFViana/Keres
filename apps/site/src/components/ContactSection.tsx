import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LandingApiError, sendContactMessage } from '../api/landing';

const BODY_LIMIT = 5000;

/** What people write in for, so the page says what is welcome before they have to guess. */
const POINTS = ['plans', 'server', 'account'] as const;

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M3 10h13m0 0l-5-5m5 5l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <div className="section-inner contact-layout">
        <header className="section-head contact-intro">
          <h2>{t('contact.title')}</h2>
          <p>{t('contact.lead')}</p>
          <ul className="contact-points">
            {POINTS.map((point) => (
              <li key={point}>
                <span className="contact-point-icon">
                  <CheckIcon />
                </span>
                {t(`contact.points.${point}`)}
              </li>
            ))}
          </ul>
        </header>
        {sent ? (
          <div className="card contact-sent">
            <span className="contact-sent-icon">
              <CheckIcon />
            </span>
            <p>{t('contact.sent')}</p>
            <button type="button" className="button button-ghost" onClick={sendAnother}>
              {t('contact.sendAnother')}
            </button>
          </div>
        ) : (
          <form className="contact-form" onSubmit={(e) => void submit(e)}>
            <div className="contact-fields">
              <label className="contact-field contact-subject">
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
              <label className="contact-field contact-email">
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
            </div>
            <label className="contact-field contact-message">
              {t('contact.body')}
              <textarea
                value={body}
                maxLength={BODY_LIMIT}
                required
                rows={7}
                placeholder={t('contact.bodyPlaceholder')}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="contact-actions">
              <span className="contact-counter">
                {body.length} / {BODY_LIMIT}
              </span>
              <button type="submit" className="button button-primary" disabled={sending}>
                {sending ? t('contact.sending') : t('contact.send')}
                {!sending && <SendIcon />}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
