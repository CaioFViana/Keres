import { useTranslation } from 'react-i18next';
import { PALETTE_NAMES, paletteLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The panel's palette.
 *
 * The colours in `styles.css` were always a copy of the app's `default` palette; now that the
 * palettes live in `@keres/shared`, the panel can use any of them. The choice is kept in
 * `localStorage`, per browser - it is a preference of whoever is looking, not server configuration,
 * so none of it goes to the API.
 */
export function AppearanceCard() {
  const { t } = useTranslation('admin');
  const { palette, setPalette, preference, setPreference } = useTheme();
  const options = ['system', 'light', 'dark'] as const;

  return (
    <div className="form-card">
      <h2>{t('appearance.title')}</h2>
      <p className="hint">{t('appearance.hint')}</p>

      <div className="segmented-field">
        <span id="appearance-theme-label">{t('appearance.themeLabel')}</span>
        <div className="segmented" role="group" aria-labelledby="appearance-theme-label">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={preference === option}
              onClick={() => setPreference(option)}
            >
              {t(`appearance.themeOptions.${option}`)}
            </button>
          ))}
        </div>
        {preference === 'system' && <p className="hint">{t('appearance.followingSystem')}</p>}
      </div>

      <label>
        {t('appearance.palette')}
        <select value={palette} onChange={(e) => setPalette(e.target.value)}>
          {PALETTE_NAMES.map((name) => (
            <option key={name} value={name}>
              {paletteLabel(name)}
            </option>
          ))}
        </select>
      </label>

      <div className="appearance-preview" aria-hidden="true">
        <div className="appearance-preview-sidebar">
          <span />
          <span className="active" />
          <span />
        </div>
        <div className="appearance-preview-main">
          <span className="appearance-preview-title" />
          <span className="appearance-preview-button" />
          <span className="appearance-preview-card" />
        </div>
      </div>
    </div>
  );
}
