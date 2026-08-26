import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShowcaseSettingsApiService,
  type ShowcaseSettings,
} from '../../api/ShowcaseSettingsApiService';

/**
 * Controls for the pages hosted on the API's own origin.
 *
 * The showcase starts off, while the hosted client starts on. Turning either off deletes no data:
 * turning it back on restores whatever was already published, or the client at `/`.
 */
export function ShowcaseSettingsCard() {
  const { t } = useTranslation('admin');
  const [settings, setSettings] = useState<ShowcaseSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    ShowcaseSettingsApiService.get()
      .then(setSettings)
      .catch((err) =>
        setError(err instanceof Error ? err.message : t('showcaseSettings.loadFailed')),
      );
  }, []);

  const toggle = async (
    patch: Partial<Pick<ShowcaseSettings, 'isShowcaseEnabled' | 'isHostedClientEnabled'>>,
  ) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.update(patch));
      setMessage(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card">
      <h2>{t('showcaseSettings.title')}</h2>
      <p className="hint">{t('showcaseSettings.description')}</p>

      {!settings && !error && <p className="loading-text">{t('common.loading')}</p>}

      {settings && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.isShowcaseEnabled}
              disabled={saving}
              onChange={(e) => void toggle({ isShowcaseEnabled: e.target.checked })}
            />
            {t('showcaseSettings.enabled')}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.isHostedClientEnabled}
              disabled={saving}
              onChange={(e) => void toggle({ isHostedClientEnabled: e.target.checked })}
            />
            {t('showcaseSettings.hostedClientEnabled')}
          </label>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
    </div>
  );
}
