import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Generates `locationMapIconPaths.ts` from the ionicons package's SVGs (a transitive dependency
// of @expo/vector-icons), so the exported SVG can draw each map point's icon as a path.
const names = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/shared/metadata/mapIcons.json'), 'utf8'),
) as string[];

const svgDir = join(process.cwd(), 'node_modules/ionicons/dist/svg');
const entries: string[] = [];
for (const name of names) {
  try {
    const svg = readFileSync(join(svgDir, `${name}.svg`), 'utf8');
    const paths = [...svg.matchAll(/<path\b[^>]*\/>/g)]
      .map((match) =>
        match[0]
          // Outline icons draw with `stroke="currentColor"` and no fill; the exported map fills
          // the icon with the node's colour, so the stroke becomes the fill.
          .replace('fill="none"', 'fill="currentColor"')
          .replace('stroke="currentColor"', 'stroke="none"'),
      )
      .join('');
    entries.push(`  '${name}': '${paths.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`);
  } catch {
    entries.push(`  '${name}': '',`);
  }
}

const out = `/**
 * SVG paths of the map icons (from the ionicons package, viewBox 0 0 512 512), keyed by the
 * names in \`MAP_ICON_OPTIONS\`. The exported map draws each point's icon as these paths; an
 * empty string means the icon has no path and the point renders as a coloured circle only.
 * Regenerate with: bun scripts/generate-map-icon-paths.ts
 */
export const LOCATION_MAP_ICON_PATHS: Record<string, string> = {
${entries.join('\n')}
};
`;

writeFileSync(join(process.cwd(), 'apps/client/src/utils/locationMapIconPaths.ts'), out);
console.log(`wrote ${entries.length} icons`);