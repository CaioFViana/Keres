import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShowcaseAuth } from '../auth/ShowcaseAuthProvider';

/**
 * The showcase's own sign-in: username + password in a small dialog, for unlocking the
 * adults-only shelf. Tab-scoped and separate from every other session on the origin.
 */
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('showcase');
  const { login } = useShowcaseAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-backdrop" onClick={onClose}>
      <div
        className="gate-card"
        role="dialog"
        aria-modal="true"
        aria-label={t('auth.signIn')}
        onClick={(event) => event.stopPropagation()}
      >
        <h1>{t('auth.signIn')}</h1>
        <p className="muted">{t('auth.signInHint')}</p>
        <form onSubmit={(event) => void submit(event)}>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t('auth.username')}
            autoComplete="username"
            aria-label={t('auth.username')}
            autoFocus
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('auth.password')}
            autoComplete="current-password"
            aria-label={t('auth.password')}
            required
          />
          {error && <p className="error-text">{error}</p>}
          <div className="gate-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AuthButton({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation('showcase');
  const { status, viewer, logout } = useShowcaseAuth();

  if (status === 'loading') {
    return null;
  }
  if (status === 'anonymous') {
    return (
      <button type="button" className="button-secondary" onClick={onSignIn}>
        {t('auth.signIn')}
      </button>
    );
  }
  return (
    <span className="auth-state">
      <span className="auth-name" title={viewer ? `@${viewer.tag}` : undefined}>
        {viewer?.username}
        {viewer && !viewer.isAdultVerified && ` (${t('auth.unverified')})`}
      </span>{' '}
      <button type="button" className="button-secondary" onClick={() => void logout()}>
        {t('auth.signOut')}
      </button>
    </span>
  );
}
