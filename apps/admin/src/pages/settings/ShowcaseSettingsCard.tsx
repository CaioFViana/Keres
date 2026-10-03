import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShowcaseSettingsApiService,
  type ShowcaseSettings,
} from '../../api/ShowcaseSettingsApiService';
import { PALETTE_NAMES, paletteLabel } from '../../theme/theme';

/**
 * Controls for the pages hosted on the API's own origin.
 *
 * The root resolves in order: the landing page when it is enabled, otherwise the hosted client
 * at `/client`, otherwise the showcase, otherwise the API docs. The showcase and the landing
 * start off, while the hosted client starts on. Turning any off deletes no data.
 *
 * Branding (name, palette, logo) is the public site's face; the toggles stay immediate while the
 * name and palette save together through one button.
 */
export function ShowcaseSettingsCard() {
  const { t } = useTranslation('admin');
  const [settings, setSettings] = useState<ShowcaseSettings | null>(null);
  const [toggles, setToggles] = useState({
    isShowcaseEnabled: false,
    isHostedClientEnabled: false,
    isLandingEnabled: false,
  });
  const [siteName, setSiteName] = useState('');
  const [sitePalette, setSitePalette] = useState('default');
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Drafts follow the server once, on load - afterwards they are the operator's until saved.
  useEffect(() => {
    ShowcaseSettingsApiService.get()
      .then((loaded) => {
        setSettings(loaded);
        const draft = {
          isShowcaseEnabled: loaded.isShowcaseEnabled,
          isHostedClientEnabled: loaded.isHostedClientEnabled,
          isLandingEnabled: loaded.isLandingEnabled ?? false,
        };
        setToggles(draft);
        const name = loaded.siteName ?? 'Keres';
        const palette = loaded.sitePalette ?? 'default';
        setSiteName(name);
        setSitePalette(palette);
        setSavedSnapshot(JSON.stringify({ ...draft, siteName: name, sitePalette: palette }));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t('showcaseSettings.loadFailed')),
      );
  }, []);

  const draft = { ...toggles, siteName, sitePalette };
  const dirty = savedSnapshot !== null && JSON.stringify(draft) !== savedSnapshot;

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.update(draft));
      setSavedSnapshot(JSON.stringify(draft));
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

      {!settings &&
        (error ? (
          <p className="error-text">{error}</p>
        ) : (
          <p className="loading-text">{t('common.loading')}</p>
        ))}

      {settings && (
        <>
          <label className="checkbox-label switch">
            <input
              type="checkbox"
              checked={toggles.isShowcaseEnabled}
              disabled={saving}
              onChange={(e) =>
                setToggles((prev) => ({ ...prev, isShowcaseEnabled: e.target.checked }))
              }
            />
            {t('showcaseSettings.enabled')}
          </label>
          <label className="checkbox-label switch">
            <input
              type="checkbox"
              checked={toggles.isHostedClientEnabled}
              disabled={saving}
              onChange={(e) =>
                setToggles((prev) => ({ ...prev, isHostedClientEnabled: e.target.checked }))
              }
            />
            {t('showcaseSettings.hostedClientEnabled')}
          </label>
          <label className="checkbox-label switch">
            <input
              type="checkbox"
              checked={toggles.isLandingEnabled}
              disabled={saving}
              onChange={(e) =>
                setToggles((prev) => ({ ...prev, isLandingEnabled: e.target.checked }))
              }
            />
            {t('showcaseSettings.landingEnabled')}
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
          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}
          <div className="form-actions">
            <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <span className={dirty ? 'hint' : 'success-text'} role="status">
              {dirty ? t('settings.unsavedChanges') : t('settings.allSaved')}
            </span>
          </div>

          <h3>{t('showcaseSettings.logo')}</h3>
          <p className="hint">{t('showcaseSettings.logoHint')}</p>
          {logoUrl && (
            <p>
              <img src={logoUrl} alt={t('showcaseSettings.logoPreview')} height={40} />
            </p>
          )}
          <span>{t('showcaseSettings.uploadLogo')}</span>
          <div className="form-actions">
            <label className="file-picker">
              <span className="file-picker-button" aria-hidden="true">
                {fileName ?? t('showcaseSettings.uploadLogo')}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={saving}
                aria-label={t('showcaseSettings.uploadLogo')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setFileName(file.name);
                  void upload(file);
                }}
              />
            </label>
          </div>
          {logoUrl && (
            <div className="form-actions">
              <button type="button" disabled={saving} onClick={() => void removeLogo()}>
                {t('showcaseSettings.removeLogo')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
