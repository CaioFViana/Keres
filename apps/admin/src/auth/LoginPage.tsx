import type { FormEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { ADMIN_LANGUAGE_KEY } from '../i18n';
import { LanguageSelect } from '../i18n/LanguageSelect';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login, isAuthenticated, isBootstrapping } = useAuth();
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isBootstrapping) {
    return <p className="loading-text">{t('common.loading')}</p>;
  }

  if (isAuthenticated) {
    return <Navigate to="/users" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/users', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>{t('login.title')}</h1>
        <label>
          {t('login.username')}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            autoComplete="username"
          />
        </label>
        <label>
          {t('login.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? t('login.signingIn') : t('login.signIn')}
        </button>
        {/* Antes de entrar: quem não lê inglês precisa poder trocar o idioma já no login. */}
        <LanguageSelect storageKey={ADMIN_LANGUAGE_KEY} className="login-language" />
      </form>
    </div>
  );
}
