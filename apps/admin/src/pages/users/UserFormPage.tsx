import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { Tier } from '@keres/shared';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { TierApiService } from '../../api/TierApiService';

export function UserFormPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialIsAdmin, setInitialIsAdmin] = useState(false);
  const [tierId, setTierId] = useState<string>('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  /** Mostrados só uma vez - depois disto só o hash de cada um existe no servidor. */
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    TierApiService.list()
      .then(setTiers)
      .catch((err) =>
        setTierError(err instanceof Error ? err.message : t('userForm.loadTiersFailed')),
      );
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    let ignore = false;
    AdminUserApiService.get(id)
      .then((u) => {
        if (ignore) return;
        setUsername(u.username);
        setTag(u.tag);
        setIsAdmin(u.isAdmin);
        setInitialIsAdmin(u.isAdmin);
        setTierId(u.tierId ?? '');
        setBio(u.bio ?? '');
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
  }, [id, isNew]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const grantingAdmin = isAdmin && (isNew || !initialIsAdmin);
      if (
        grantingAdmin &&
        !confirm(
          isNew
            ? t('userForm.confirmAdmin')
            : `Grant admin access to "${username}"? They will be able to manage the panel.`,
        )
      ) {
        return;
      }

      if (isNew) {
        const created = await AdminUserApiService.create({
          username,
          password,
          tag: tag || undefined,
          isAdmin,
          tierId: tierId || null,
        });
        setRecoveryCodes(created.recoveryCodes);
        return;
      } else if (id) {
        await AdminUserApiService.update(id, {
          isAdmin,
          tierId: tierId || null,
          tag: tag || undefined,
          bio: bio || null,
        });
      }
      navigate('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onRegenerateRecoveryCodes = async () => {
    if (!id) return;
    if (!confirm(t('userForm.confirmRegenerate', { username }))) {
      return;
    }
    setRegeneratingCodes(true);
    setError(null);
    try {
      const { recoveryCodes: codes } = await AdminUserApiService.regenerateRecoveryCodes(id);
      setRecoveryCodes(codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('userForm.regenerateFailed'));
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopyMessage(t('userForm.copied'));
    } catch {
      setCopyMessage(t('userForm.copyFailed'));
    }
  };

  if (loading) return <p className="loading-text">{t('common.loading')}</p>;

  if (recoveryCodes) {
    return (
      <div>
        <div className="page-header">
          <h1>{t('userForm.recoveryTitle', { username })}</h1>
        </div>
        <div className="form-card">
          <p className="hint">{t('userForm.recoveryHint')}</p>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code} className="mono-code">
                {code}
              </li>
            ))}
          </ul>
          {copyMessage && <p className="success-text">{copyMessage}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => void copyCodes()}>
              {t('userForm.copyCodes')}
            </button>
            <button type="button" className="button-secondary" onClick={() => navigate('/users')}>
              {t('common.done')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? t('userForm.newTitle') : t('userForm.editTitle', { username })}</h1>
      </div>
      <form className="form-card" onSubmit={(e) => void onSubmit(e)}>
        {isNew && (
          <>
            <label>
              {t('userForm.username')}
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              {t('userForm.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          </>
        )}
        <label>
          {t('userForm.tag')}
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder={isNew ? username || t('userForm.tagPlaceholder') : ''}
          />
        </label>
        {!isNew && (
          <label>
            {t('userForm.bio')}
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
          </label>
        )}
        <label>
          {t('userForm.tier')}
          <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
            <option value="">{t('userForm.tierNone')}</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {tierError && <p className="error-text">{tierError}</p>}
        <label className="checkbox-label">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          {t('userForm.adminAccess')}
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" className="button-secondary" onClick={() => navigate('/users')}>
            {t('common.cancel')}
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="form-card">
          <h3>{t('userForm.lockedOutTitle')}</h3>
          <p className="hint">{t('userForm.lockedOutHint')}</p>
          <button
            type="button"
            onClick={() => void onRegenerateRecoveryCodes()}
            disabled={regeneratingCodes}
          >
            {regeneratingCodes ? t('userForm.regenerating') : t('userForm.regenerate')}
          </button>
        </div>
      )}
    </div>
  );
}
