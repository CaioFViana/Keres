import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShowcaseSettingsApiService,
  type ShowcaseSettings,
} from '../../api/ShowcaseSettingsApiService';

/**
 * A chave do site público deste servidor.
 *
 * Desligado (o padrão), `/` volta a redirecionar para a documentação, as rotas `/public/*`
 * respondem 404 e publicar é recusado. Nada é apagado: religar traz de volta exatamente o que
 * já estava publicado.
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

  const toggle = async (isShowcaseEnabled: boolean) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.update({ isShowcaseEnabled }));
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
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.isShowcaseEnabled}
            disabled={saving}
            onChange={(e) => void toggle(e.target.checked)}
          />
          {t('showcaseSettings.enabled')}
        </label>
      )}

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
    </div>
  );
}
