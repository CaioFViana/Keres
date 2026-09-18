import { create } from 'zustand';

export interface SvgRasterJob {
  id: number;
  svg: string;
  /** Exact raster pixels; the caller caps the document size before requesting. */
  width: number;
  height: number;
}

interface PendingRaster {
  resolve: (bytes: Uint8Array) => void;
  reject: (error: unknown) => void;
}

interface SvgRasterState {
  job: SvgRasterJob | null;
  requestRaster: (svg: string, width: number, height: number) => Promise<Uint8Array>;
  finishRaster: (id: number, bytes: Uint8Array) => void;
  failRaster: (id: number, error: unknown) => void;
}

const pending = new Map<number, PendingRaster>();
let sequence = 0;

/**
 * Bridge between any screen's export flow and the single hidden raster canvas (`SvgRasterHost`,
 * mounted once in `App.tsx`) - the same shape as `AppAlert`: the caller awaits bytes without
 * mounting anything locally.
 */
export const useSvgRasterStore = create<SvgRasterState>((set) => ({
  job: null,

  requestRaster: (svg: string, width: number, height: number) => {
    const id = ++sequence;
    const done = new Promise<Uint8Array>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    // A second request supersedes the first: exports are user-paced, never concurrent, and a
    // stale job must not resolve with another drawing's pixels.
    for (const [queuedId, queued] of pending) {
      if (queuedId !== id) {
        pending.delete(queuedId);
        queued.reject(new Error('svg raster superseded by a newer request'));
      }
    }
    set({ job: { id, svg, width, height } });
    return done;
  },

  finishRaster: (id: number, bytes: Uint8Array) => {
    const found = pending.get(id);
    pending.delete(id);
    if (found) {
      set({ job: null });
      found.resolve(bytes);
    }
  },

  failRaster: (id: number, error: unknown) => {
    const found = pending.get(id);
    pending.delete(id);
    if (found) {
      set({ job: null });
      found.reject(error);
    }
  },
}));

/** Test-only escape hatch: drops pending jobs without resolving them. */
export function __resetSvgRasterForTests(): void {
  pending.clear();
  sequence = 0;
  useSvgRasterStore.setState({ job: null });
}
