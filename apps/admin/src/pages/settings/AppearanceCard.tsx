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
  const { palette, setPalette, preference, cyclePreference } = useTheme();

  return (
    <div className="form-card">
      <h2>{t('appearance.title')}</h2>
      <p className="hint">{t('appearance.hint')}</p>

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

      <div className="form-actions">
        <button type="button" onClick={cyclePreference}>
          {t(`theme.${preference}`)}
        </button>
        {preference === 'system' && <span className="hint">{t('appearance.followingSystem')}</span>}
      </div>
    </div>
  );
}
