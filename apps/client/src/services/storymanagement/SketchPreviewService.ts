import type { SketchContentType } from '@keres/shared';
import {
  decodeSketchDocument,
  sketchContentHash,
  validateSketchContent,
} from '@keres/shared';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { renderSketchSvg } from '../../utils/sketchSvg';
import type { SvgExportColors } from '../../utils/svgExport';
import { fitRasterSize, rasterizeMapSvg } from '../../utils/svgRaster';
import { hashText } from '../SongAudioService';
import * as webMediaStore from '../webMediaStore';

/** How many preview PNGs are kept on the device; the oldest goes first. */
export const SKETCH_PREVIEW_CACHE_BYTES = 30 * 1024 * 1024;
/** Bump when the rendering changes, or previews kept from the old one would linger. */
const PREVIEW_VERSION = 1;

/** The look a preview is drawn with: the theme for display, plain paper for print. */
export interface SketchPreviewLook {
  colors: SvgExportColors;
  paper: string;
}

/**
 * Print look: a manuscript page is paper whatever theme the app is in, so a preview drawn
 * for one is too. Display previews use the theme instead (see `sketchLookFromTheme`).
 */
export const SKETCH_PREVIEW_PRINT_LOOK: SketchPreviewLook = {
  colors: {
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1f1f1f',
    textSecondary: '#5a5a5a',
    border: '#c8c8c8',
    primary: '#3b5bdb',
  },
  paper: '#ffffff',
};

/**
 * Where preview PNGs live. Each is named by a hash of what made it (the drawing, the look),
 * so the same drawing under the same look is never rendered twice and a changed stroke makes
 * a new file rather than a stale one. Nothing here is a Gallery row and nothing syncs: every
 * device draws its own previews, in its own theme.
 */
export interface SketchPreviewStore {
  /** The address of a preview already made, or `null`. */
  find(key: string): Promise<string | null>;
  put(key: string, bytes: Uint8Array): Promise<string>;
  /** The bytes behind an address made by this store, or `null` when unreadable. */
  read(uri: string): Promise<Uint8Array | null>;
  /** Drops the oldest previews until what is kept fits. */
  prune(maxBytes: number): Promise<void>;
}

function nativeStore(): SketchPreviewStore {
  const directory = () => new Directory(Paths.cache, 'sketch-previews');
  return {
    async find(key) {
      const file = new File(directory(), `${key}.png`);
      return file.exists ? file.uri : null;
    },
    async put(key, bytes) {
      const folder = directory();
      folder.create({ intermediates: true, idempotent: true });
      const file = new File(folder, `${key}.png`);
      file.create({ overwrite: true });
      file.write(bytes);
      return file.uri;
    },
    async read(uri) {
      try {
        return await new File(uri).bytes();
      } catch {
        return null;
      }
    },
    async prune(maxBytes) {
      const folder = directory();
      if (!folder.exists) return;
      const entries = folder.list().flatMap((entry) => {
        if (!(entry instanceof File)) return [];
        let modified = 0;
        try {
          modified = entry.info().modificationTime ?? 0;
        } catch {
          // Without a time the file counts as the oldest, and goes first.
        }
        return [{ file: entry, size: entry.size ?? 0, modified }];
      });
      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      for (const entry of entries.sort((a, b) => a.modified - b.modified)) {
        if (total <= maxBytes) break;
        try {
          entry.file.delete();
          total -= entry.size;
        } catch (error) {
          console.log('SketchPreviewService: could not drop a preview.', error);
        }
      }
    },
  };
}

function webStore(): SketchPreviewStore {
  const relativePath = (key: string) => `sketch-previews/${key}.png`;
  const uriOf = (key: string) => `${webMediaStore.DESKTOP_MEDIA_URI_PREFIX}${relativePath(key)}`;
  return {
    async find(key) {
      return webMediaStore.existsSync(relativePath(key)) ? uriOf(key) : null;
    },
    async put(key, bytes) {
      await webMediaStore.writeBytes(relativePath(key), bytes);
      return uriOf(key);
    },
    async read(uri) {
      try {
        if (!uri.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) return null;
        return await webMediaStore.readBytes(uri.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length));
      } catch {
        return null;
      }
    },
    // No listing API to prune by; the store is quota-backed and previews are small.
    async prune() {},
  };
}

export const defaultSketchPreviewStore = (): SketchPreviewStore =>
  Platform.OS === 'web' ? webStore() : nativeStore();

/** What decides the pixels: the drawing and the look it is drawn with. */
export function sketchPreviewKey(content: SketchContentType, look: SketchPreviewLook): string {
  const colors = look.colors;
  return hashText(
    [
      PREVIEW_VERSION,
      sketchContentHash(content),
      colors.background,
      colors.surface,
      colors.text,
      colors.textSecondary,
      colors.border,
      colors.primary,
      look.paper,
    ].join('|'),
  );
}

export interface EnsuredSketchPreview {
  uri: string;
  /** The freshly rendered bytes; `null` when the preview was already made. */
  bytes: Uint8Array | null;
  /** It was already made: no rendering was done. */
  cached: boolean;
}

export interface SketchPreviewDeps {
  store?: SketchPreviewStore;
  maxBytes?: number;
}

/**
 * Draws a sketch to a PNG kept outside the Gallery. A byte-identical drawing under the same
 * look reuses one file; anything else makes a new one. Pruning is housekeeping: failing it
 * never fails the preview that was just made.
 */
export function createSketchPreviewService(deps: SketchPreviewDeps = {}) {
  const store = deps.store ?? defaultSketchPreviewStore();
  const maxBytes = deps.maxBytes ?? SKETCH_PREVIEW_CACHE_BYTES;

  return {
    /** The address of a preview already made for this drawing and look, or `null`. */
    async peek(content: SketchContentType, look: SketchPreviewLook): Promise<string | null> {
      try {
        const validated = validateSketchContent(content);
        return store.find(sketchPreviewKey(validated, look));
      } catch {
        return null;
      }
    },

    async ensure(
      name: string,
      content: SketchContentType,
      look: SketchPreviewLook,
    ): Promise<EnsuredSketchPreview> {
      const validated = validateSketchContent(content);
      const key = sketchPreviewKey(validated, look);
      const kept = await store.find(key);
      if (kept) return { uri: kept, bytes: null, cached: true };

      const doc = decodeSketchDocument(validated);
      const svg = renderSketchSvg(doc, { title: name, colors: look.colors, paper: look.paper });
      const pixels = fitRasterSize(doc.page.width, doc.page.height);
      const bytes = await rasterizeMapSvg(svg, pixels.width, pixels.height);
      const uri = await store.put(key, bytes);
      store.prune(maxBytes).catch((error) => {
        console.log('SketchPreviewService: could not prune the previews.', error);
      });
      return { uri, bytes, cached: false };
    },

    readBytes(uri: string): Promise<Uint8Array | null> {
      return store.read(uri);
    },
  };
}

export const sketchPreviewService = createSketchPreviewService();
