import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Tier } from '@keres/shared';
import { AdminUserApiService } from '../../api/AdminUserApiService';
import { TierApiService } from '../../api/TierApiService';

export function UserFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tag, setTag] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [tierId, setTierId] = useState<string>('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  /** Mostrados só uma vez - depois disto só o hash de cada um existe no servidor. */
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    TierApiService.list()
      .then(setTiers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    AdminUserApiService.get(id)
      .then((u) => {
        setUsername(u.username);
        setTag(u.tag);
        setIsAdmin(u.isAdmin);
        setTierId(u.tierId ?? '');
        setBio(u.bio ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await AdminUserApiService.create({
          username,
          password,
          tag: tag || undefined,
          isAdmin,
          tierId: tierId || null,
        });
        // Fica na tela mostrando os códigos em vez de navegar - é a única vez que eles
        // aparecem em texto puro, e o admin precisa repassá-los pra pessoa (não há e-mail).
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
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const onRegenerateRecoveryCodes = async () => {
    if (!id) return;
    if (
      !confirm(
        `Regenerate ${username}'s recovery codes? All of their previous codes will stop working.`,
      )
    ) {
      return;
    }
    setRegeneratingCodes(true);
    setError(null);
    try {
      const { recoveryCodes: codes } = await AdminUserApiService.regenerateRecoveryCodes(id);
      setRecoveryCodes(codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate recovery codes.');
    } finally {
      setRegeneratingCodes(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  if (recoveryCodes) {
    return (
      <div>
        <h1>Recovery codes for {username}</h1>
        <div className="form-card">
          <p className="hint">
            Each code can be used once to reset the password without knowing the current one. Shown
            only this once - hand them to the user now, they cannot be retrieved again later.
          </p>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code} style={{ fontFamily: 'monospace', fontSize: '1.1em' }}>
                {code}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => navigate('/users')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{isNew ? 'New user' : `Edit ${username}`}</h1>
      <form className="form-card" onSubmit={onSubmit}>
        {isNew && (
          <>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
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
          Tag
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder={isNew ? username || '(defaults to username)' : ''}
          />
        </label>
        {!isNew && (
          <label>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
          </label>
        )}
        <label>
          Tier
          <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
            <option value="">(none / default)</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Admin access
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/users')}>
            Cancel
          </button>
        </div>
      </form>

      {!isNew && (
        <div className="form-card">
          <h3>Locked out of their account?</h3>
          <p className="hint">
            Issues a fresh batch of recovery codes and invalidates any old ones. Hand a code to the
            user - they use it to set their own new password, which you never see.
          </p>
          <button type="button" onClick={onRegenerateRecoveryCodes} disabled={regeneratingCodes}>
            {regeneratingCodes ? 'Regenerating...' : 'Regenerate recovery codes'}
          </button>
        </div>
      )}
    </div>
  );
}
