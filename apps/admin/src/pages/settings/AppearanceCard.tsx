import { PALETTE_NAMES, paletteLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * A paleta do painel.
 *
 * As cores do `styles.css` sempre foram uma cópia da paleta `default` do app; agora que as
 * paletas moram em `@keres/shared`, o painel pode usar qualquer uma. Escolha guardada em
 * `localStorage`, por navegador - é preferência de quem está olhando, não configuração do
 * servidor, então nada disso vai para a API.
 */
export function AppearanceCard() {
  const { palette, setPalette, preference, cyclePreference, preferenceLabel } = useTheme();

  return (
    <div className="form-card">
      <h2>Appearance</h2>
      <p className="hint">Saved in this browser only.</p>

      <label>
        Palette
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
          {preferenceLabel}
        </button>
        {preference === 'system' && <span className="hint">Following your device setting.</span>}
      </div>
    </div>
  );
}
