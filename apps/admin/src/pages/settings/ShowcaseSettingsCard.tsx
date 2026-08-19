import { useEffect, useState } from 'react';
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
  const [settings, setSettings] = useState<ShowcaseSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    ShowcaseSettingsApiService.get()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'));
  }, []);

  const toggle = async (isShowcaseEnabled: boolean) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(await ShowcaseSettingsApiService.update({ isShowcaseEnabled }));
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card">
      <h2>Public Showcase</h2>
      <p className="hint">
        When enabled, this server serves a public page at its root address, listing the stories its
        users chose to publish. Anyone can browse and download those stories - no account needed.
        Password-protected stories stay unlisted either way.
      </p>

      {!settings && !error && <p className="loading-text">Loading...</p>}

      {settings && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.isShowcaseEnabled}
            disabled={saving}
            onChange={(e) => void toggle(e.target.checked)}
          />
          Showcase enabled
        </label>
      )}

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
    </div>
  );
}
