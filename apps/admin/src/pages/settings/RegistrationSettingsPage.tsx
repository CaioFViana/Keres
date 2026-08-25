import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegistrationSettings, Tier } from '@keres/shared';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';
import { AppearanceCard } from './AppearanceCard';
import { ShowcaseSettingsCard } from './ShowcaseSettingsCard';

export function RegistrationSettingsPage() {
  const { t } = useTranslation('admin');
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
      .catch((err) =>
        setTierError(err instanceof Error ? err.message : t('settings.loadTiersFailed')),
      );
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
      setMessage(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // The page gathers more than one subject: registration, public site and appearance. The last two
  // do not depend on the first one loading, so they stay usable even if it fails.
  return (
    <div>
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>

      {!settings ? (
        <p className="loading-text">
          {error ? <span className="error-text">{error}</span> : t('common.loading')}
        </p>
      ) : (
        <form className="form-card" onSubmit={(e) => void save(e)}>
          <h2>{t('settings.registration')}</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoManage}
              onChange={(e) => setSettings({ ...settings, autoManage: e.target.checked })}
            />
            {t('settings.autoManage')}
          </label>

          {!settings.autoManage && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.isRegistrationOpen}
                onChange={(e) => setSettings({ ...settings, isRegistrationOpen: e.target.checked })}
              />
              {t('settings.registrationOpen')}
            </label>
          )}

          <label>
            {t('settings.maxUsers')} <span className="hint">{t('settings.maxUsersHint')}</span>
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
            {t('settings.defaultTier')}
            <select
              value={settings.defaultTierId ?? ''}
              onChange={(e) => setSettings({ ...settings, defaultTierId: e.target.value || null })}
            >
              <option value="">{t('settings.defaultTierNone')}</option>
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
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      <ShowcaseSettingsCard />
      <AppearanceCard />
    </div>
  );
}
