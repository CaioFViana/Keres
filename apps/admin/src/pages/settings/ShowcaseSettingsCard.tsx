import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShowcaseSettingsApiService,
  type ShowcaseSettings,
  type ShowcaseSettingsPatch,
} from '../../api/ShowcaseSettingsApiService';
import { PALETTE_NAMES, paletteLabel } from '../../theme/theme';

/**
 * Controls for the pages hosted on the API's own origin.
 *
 * The showcase starts off, while the hosted client starts on. Turning either off deletes no data:
 * turning it back on restores whatever was already published, or the client at `/`.
 *
 * Branding (name, palette, logo) is the public site's face; the toggles stay immediate while the
 * name and palette save together through one button.
 */
export function ShowcaseSettingsCard() {
  const { t } = useTranslation('admin');
  const [settings, setSettings] = useState<ShowcaseSettings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [sitePalette, setSitePalette] = useState('default');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Drafts follow the server once, on load - afterwards they are the operator's until saved, so a
  // toggle round-trip in between does not wipe what is being typed.
  const draftsInitialised = useRef(false);

  useEffect(() => {
    ShowcaseSettingsApiService.get()
      .then((loaded) => {
        setSettings(loaded);
        if (!draftsInitialised.current) {
          draftsInitialised.current = true;
          setSiteName(loaded.siteName ?? 'Keres');
          setSitePalette(loaded.sitePalette ?? 'default');
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t('showcaseSettings.loadFailed')),
      );
  }, []);

  const save = async (patch: ShowcaseSettingsPatch) => {
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

  const upload = async (file: File) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.uploadLogo(file));
      setMessage(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.deleteLogo());
      setMessage(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // The public logo route, cache-busted by the upload instant the settings carry.
  const logoUrl =
    settings?.logoContentType && settings.logoUpdatedAt
      ? `/api/public/showcase-logo?v=${Date.parse(settings.logoUpdatedAt)}`
      : null;

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
              onChange={(e) => void save({ isShowcaseEnabled: e.target.checked })}
            />
            {t('showcaseSettings.enabled')}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.isHostedClientEnabled}
              disabled={saving}
              onChange={(e) => void save({ isHostedClientEnabled: e.target.checked })}
            />
            {t('showcaseSettings.hostedClientEnabled')}
          </label>

          <h3>{t('showcaseSettings.branding')}</h3>
          <label>
            {t('showcaseSettings.siteName')}
            <input
              type="text"
              value={siteName}
              maxLength={60}
              disabled={saving}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </label>
          <label>
            {t('showcaseSettings.sitePalette')}
            <select
              value={sitePalette}
              disabled={saving}
              onChange={(e) => setSitePalette(e.target.value)}
            >
              {PALETTE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {paletteLabel(name)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save({ siteName, sitePalette })}
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>

          <h3>{t('showcaseSettings.logo')}</h3>
          <p className="hint">{t('showcaseSettings.logoHint')}</p>
          {logoUrl && (
            <p>
              <img src={logoUrl} alt={t('showcaseSettings.logoPreview')} height={40} />
            </p>
          )}
          <label>
            {t('showcaseSettings.uploadLogo')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={saving}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(file);
              }}
            />
          </label>
          {logoUrl && (
            <div className="form-actions">
              <button type="button" disabled={saving} onClick={() => void removeLogo()}>
                {t('showcaseSettings.removeLogo')}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
    </div>
  );
}
