import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Generates `keresIconPaths.ts` from the vendored game-icons.net SVGs (CC BY 3.0, see
// `packages/shared/metadata/keres/NOTICE.md`), so the app (Skia) and the exported SVG
// can draw each Keres icon tinted. Every source holds a black background path plus the
// white glyph paths; the background is dropped and the glyph fill stripped, leaving a
// silhouette the renderers paint with the icon color. Anything outside that shape
// (groups, transforms, strokes, another viewBox) fails loudly instead of shipping a
// broken icon.
const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/shared/metadata/keresIcons.json'), 'utf8'),
) as { name: string }[];

const BACKGROUND_PATH = '<path d="M0 0h512v512H0z"/>';
const entries: string[] = [];
const failures: string[] = [];
for (const { name } of manifest) {
  try {
    const svg = readFileSync(
      join(process.cwd(), 'packages/shared/metadata/keres', `${name}.svg`),
      'utf8',
    );
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
    if (viewBox !== '0 0 512 512') throw new Error(`unexpected viewBox "${viewBox}"`);
    if (/<g[\s>]/.test(svg) || /transform=/.test(svg)) {
      throw new Error('groups and transforms are not supported');
    }
    const shapes = [...svg.matchAll(/<(?:path|circle|rect|polygon)\b[^>]*\/>/g)].map(
      (match) => match[0],
    );
    const glyph = shapes.filter((shape) => shape !== BACKGROUND_PATH);
    if (glyph.length === 0 || glyph.length === shapes.length) {
      throw new Error('expected a background path plus glyph paths');
    }
    const cleaned = glyph.join('').replace(/\sfill="[^"]*"/g, '');
    if (/\sstroke="/.test(cleaned)) throw new Error('stroked shapes are not supported');
    entries.push(`  '${name}': '${cleaned.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`);
  } catch (error) {
    failures.push(`${name}: ${(error as Error).message}`);
  }
}
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const out = `/**
 * Glyph silhouettes of the Keres icon pack (from game-icons.net, CC BY 3.0 - see
 * \`packages/shared/metadata/keres/NOTICE.md\`, viewBox 0 0 512 512), keyed by the names
 * in \`KERES_ICON_OPTIONS\`. Background dropped, fill stripped: renderers paint these with
 * the icon color, on canvas (Skia) and in the exported SVG alike.
 * Regenerate with: bun scripts/generate-keres-icon-paths.ts
 */
export const KERES_ICON_PATHS: Record<string, string> = {
${entries.join('\n')}
};
`;

writeFileSync(join(process.cwd(), 'apps/client/src/utils/keresIconPaths.ts'), out);
console.log(`wrote ${entries.length} icons`);
