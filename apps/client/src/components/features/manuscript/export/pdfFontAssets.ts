import { base64ToBytes } from '@keres/shared';
import type { PdfFontMatrices } from '@keres/shared/manuscript/export';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import italicAsset from '@/assets/fonts/NotoSerif-Italic-Variable.ttf';
import regularAsset from '@/assets/fonts/NotoSerif-Variable.ttf';

/**
 * The bundled serif matrices for PDF export (Noto Serif variable files: bold
 * resolves from `wght` instances, so two files cover the four faces). Loaded
 * lazily and only for PDF exports - every other format never touches them -
 * and cached for the session. A null return means "fall back to the WinAnsi
 * Times path": the export must never break because a font failed to load.
 */
let cached: PdfFontMatrices | null = null;

async function assetBytes(moduleId: number): Promise<Uint8Array> {
  const [asset] = await Asset.loadAsync(moduleId);
  const uri = asset?.localUri ?? asset?.uri;
  if (!uri) throw new Error('Serif asset resolved to no URI.');
  try {
    return new Uint8Array(await new File(uri).bytes());
  } catch {
    try {
      const base64 = await LegacyFileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return base64ToBytes(base64);
    } catch {
      // Web has no filesystem at all (both expo-file-system APIs are stubs
      // there), but the asset URI itself is fetchable (http(s) or blob:).
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Serif asset fetch failed: HTTP ${response.status}.`);
      return new Uint8Array(await response.arrayBuffer());
    }
  }
}

export async function pdfFontMatrices(): Promise<PdfFontMatrices | null> {
  if (cached) return cached;
  try {
    const [regular, italic] = await Promise.all([
      assetBytes(regularAsset),
      assetBytes(italicAsset),
    ]);
    cached = { regular, italic };
    return cached;
  } catch (error) {
    console.warn('[manuscript] Bundled serif failed to load; PDF falls back to Times.', error);
    return null;
  }
}
