import type { MapExportFormat } from '@keres/shared/entities/ClientSettings';
import { create } from 'zustand';

interface ExportFormatPromptState {
  /** True while the chooser is on screen; the host renders it. */
  open: boolean;
  ask: () => Promise<MapExportFormat | null>;
  /** The user's answer; `null` is a dismissal and cancels the export. */
  answer: (format: MapExportFormat | null) => void;
}

let resolver: ((format: MapExportFormat | null) => void) | null = null;

/**
 * Bridge between any canvas screen's export flow and the one chooser modal (`ExportFormatHost`,
 * mounted once in `App.tsx`) - the same shape as `AppAlert` and the raster host: the caller awaits
 * the answer without mounting anything locally. A second request while one is open dismisses the
 * first, so a stray double tap never leaves an export hanging.
 */
export const useExportFormatPromptStore = create<ExportFormatPromptState>((set) => ({
  open: false,
  ask: () =>
    new Promise((resolve) => {
      resolver?.(null);
      resolver = resolve;
      set({ open: true });
    }),
  answer: (format) => {
    const current = resolver;
    resolver = null;
    set({ open: false });
    current?.(format);
  },
}));
