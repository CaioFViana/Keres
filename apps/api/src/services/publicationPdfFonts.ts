import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { PdfFontMatrices } from '@keres/shared/manuscript/export';
import { apiPackageRoot } from '../config/resourceRoot';

/**
 * The serif matrices for server-side PDF manuscripts, read once from the
 * resources beside the server (`assets/fonts`, fetched by `bun run fonts:fetch`,
 * shipped inside the launcher zip) and cached for the process. Absent files
 * mean the legacy WinAnsi Times path: the server must publish with or without
 * them, so this resolves to `undefined` instead of throwing - once warned.
 */
let cached: PdfFontMatrices | null | undefined;
let warned = false;

export async function publicationPdfFontMatrices(): Promise<PdfFontMatrices | undefined> {
  if (cached !== undefined) return cached ?? undefined;
  const dir = path.join(apiPackageRoot(), 'assets', 'fonts');
  const regularPath = path.join(dir, 'NotoSerif-Variable.ttf');
  const italicPath = path.join(dir, 'NotoSerif-Italic-Variable.ttf');
  if (existsSync(regularPath) && existsSync(italicPath)) {
    cached = {
      regular: new Uint8Array(readFileSync(regularPath)),
      italic: new Uint8Array(readFileSync(italicPath)),
    };
    return cached;
  }
  cached = null;
  if (!warned) {
    warned = true;
    console.warn(
      `[publication] PDF serif matrices absent in ${dir} (run \`bun run fonts:fetch\`); manuscripts fall back to Times.`,
    );
  }
  return undefined;
}
