import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RegistrationSettings, Tier } from '@keres/shared';
import { RegistrationSettingsApiService } from '../../api/RegistrationSettingsApiService';
import { TierApiService } from '../../api/TierApiService';
import { AppearanceCard } from './AppearanceCard';
import { ShowcaseSettingsCard } from './ShowcaseSettingsCard';

const SECTION_IDS = ['settings-registration', 'settings-showcase', 'settings-appearance'] as const;

export function RegistrationSettingsPage() {
  const { t } = useTranslation('admin');
  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof SECTION_IDS)[number]>(SECTION_IDS[0]);

  useEffect(() => {
    RegistrationSettingsApiService.get()
      .then((loaded) => {
        setSettings(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch((err) => setError(err.message));
    TierApiService.list()
      .then(setTiers)
      .catch((err) =>
        setTierError(err instanceof Error ? err.message : t('settings.loadTiersFailed')),
      );
  }, []);

  const sections = [
    { id: SECTION_IDS[0], label: t('settings.registration') },
    { id: SECTION_IDS[1], label: t('showcaseSettings.title') },
    { id: SECTION_IDS[2], label: t('appearance.title') },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      settings?.maxUsers !== null &&
      settings?.maxUsers !== undefined &&
      (!Number.isInteger(settings.maxUsers) || settings.maxUsers < 0)
    ) {
      setError(t('common.nonNegativeInteger'));
      return;
    }
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
        currency: settings.currency,
      });
      setSettings(updated);
      setSavedSnapshot(JSON.stringify(updated));
      setMessage(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const dirty = savedSnapshot !== null && JSON.stringify(settings) !== savedSnapshot;

  // The page gathers more than one subject: registration, public site and appearance. The last two
  // do not depend on the first one loading, so they stay usable even if it fails.
  return (
    <div>
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>

      <div className="tabs" role="tablist" aria-label={t('settings.sectionsLabel')}>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={tab === section.id}
            className={tab === section.id ? 'tab active' : 'tab button-secondary'}
            onClick={() => setTab(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="settings-sections">
        {!settings ? (
          <p className="loading-text">
            {error ? <span className="error-text">{error}</span> : t('common.loading')}
          </p>
        ) : (
          tab === SECTION_IDS[0] && (
            <form className="form-card settings-section" onSubmit={(e) => void save(e)}>
              <h2>{t('settings.registration')}</h2>
              <label className="checkbox-label switch">
                <input
                  type="checkbox"
                  checked={settings.autoManage}
                  onChange={(e) => setSettings({ ...settings, autoManage: e.target.checked })}
                />
                {t('settings.autoManage')}
              </label>

              {!settings.autoManage && (
                <label className="checkbox-label switch">
                  <input
                    type="checkbox"
                    checked={settings.isRegistrationOpen}
                    onChange={(e) =>
                      setSettings({ ...settings, isRegistrationOpen: e.target.checked })
                    }
                  />
                  {t('settings.registrationOpen')}
                </label>
              )}

              <label>
                {t('settings.maxUsers')} <span className="hint">{t('settings.maxUsersHint')}</span>
                <input
                  type="number"
                  min={0}
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
                  onChange={(e) =>
                    setSettings({ ...settings, defaultTierId: e.target.value || null })
                  }
                >
                  <option value="">{t('settings.defaultTierNone')}</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint" data-testid="default-tier-hint">
                {t('settings.defaultTierHint')}
              </p>

              <label>
                {t('settings.currency')} <span className="hint">{t('settings.currencyHint')}</span>
                <input
                  type="text"
                  value={settings.currency ?? ''}
                  maxLength={3}
                  onChange={(e) =>
                    setSettings({ ...settings, currency: e.target.value.toUpperCase() })
                  }
                />
              </label>

              {tierError && <p className="error-text">{tierError}</p>}
              {error && <p className="error-text">{error}</p>}
              {message && <p className="success-text">{message}</p>}
              <div className="form-actions">
                <button type="submit" disabled={saving || !dirty}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <span className={dirty ? 'hint' : 'success-text'} role="status">
                  {dirty ? t('settings.unsavedChanges') : t('settings.allSaved')}
                </span>
              </div>
            </form>
          )
        )}

        {tab === SECTION_IDS[1] && <ShowcaseSettingsCard />}
        {tab === SECTION_IDS[2] && <AppearanceCard />}
      </div>
    </div>
  );
}
