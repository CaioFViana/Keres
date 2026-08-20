import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * A porta de uma história publicada sem listagem, atrás de senha.
 *
 * A página não sabe nada sobre a história neste ponto - nem o título - porque o servidor não
 * conta: um link vazado sozinho não revela o que está do outro lado. O erro é sempre o mesmo,
 * exista a história ou não.
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
      // A mensagem do servidor não é traduzida; a local cobre o caso comum.
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
