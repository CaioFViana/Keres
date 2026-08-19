import { useEffect, useState } from 'react';
import type { RegistrationSettings, Tier } from '@keres/shared';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';
import { AppearanceCard } from './AppearanceCard';
import { ShowcaseSettingsCard } from './ShowcaseSettingsCard';

export function RegistrationSettingsPage() {
  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    RegistrationSettingsApiService.get()
      .then(setSettings)
      .catch((err) => setError(err.message));
    TierApiService.list()
      .then(setTiers)
      .catch((err) => setTierError(err instanceof Error ? err.message : 'Failed to load tiers.'));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!settings) return;
      const updated = await RegistrationSettingsApiService.update({
        isRegistrationOpen: settings.isRegistrationOpen,
        maxUsers: settings.maxUsers,
        autoManage: settings.autoManage,
        defaultTierId: settings.defaultTierId,
      });
      setSettings(updated);
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // A página reúne mais de um assunto: cadastro, site público e aparência. Os dois últimos não
  // dependem do carregamento do primeiro, então continuam utilizáveis mesmo se ele falhar.
  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {!settings ? (
        <p className="loading-text">
          {error ? <span className="error-text">{error}</span> : 'Loading...'}
        </p>
      ) : (
        <form className="form-card" onSubmit={(e) => void save(e)}>
          <h2>Registration</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoManage}
              onChange={(e) => setSettings({ ...settings, autoManage: e.target.checked })}
            />
            Auto-manage open/closed based on max users
          </label>

          {!settings.autoManage && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.isRegistrationOpen}
                onChange={(e) => setSettings({ ...settings, isRegistrationOpen: e.target.checked })}
              />
              Registration open
            </label>
          )}

          <label>
            Max users <span className="hint">(blank = no cap)</span>
            <input
              type="number"
              value={settings.maxUsers ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxUsers: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>

          <label>
            Default tier for new signups
            <select
              value={settings.defaultTierId ?? ''}
              onChange={(e) => setSettings({ ...settings, defaultTierId: e.target.value || null })}
            >
              <option value="">(none / unlimited)</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {tierError && <p className="error-text">{tierError}</p>}
          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <ShowcaseSettingsCard />
      <AppearanceCard />
    </div>
  );
}
