import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * The gate of a story published without listing, behind a password.
 *
 * At this point the page knows nothing about the story - not even the title - because the server
 * does not tell: a leaked link on its own does not reveal what is on the other side. The error is
 * always the same, whether the story exists or not.
 */
export function PasswordGate({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const { t } = useTranslation('showcase');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (caught) {
      // The server's message is not translated; the local one covers the common case.
      setError(caught instanceof Error ? caught.message : t('gate.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gate">
      <div className="gate-card">
        <h1>{t('gate.title')}</h1>
        <p className="muted">{t('gate.intro')}</p>
        <form onSubmit={(event) => void submit(event)}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('gate.password')}
            autoFocus
            required
          />
          <button type="submit" disabled={busy || !password}>
            {busy ? t('gate.opening') : t('gate.open')}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        <Link to="/" className="back-link">
          {t('story.back')}
        </Link>
      </div>
    </section>
  );
}
