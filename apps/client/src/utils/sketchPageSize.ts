import {
  PAGE_FORMAT_ASPECT,
  SKETCH_PAGE_PRESETS,
  type PageFormat,
  type SketchPagePresetId,
} from '@keres/shared';

/** The width a drawn page takes when its shape is not one of the Sketch's papers. */
const DRAWN_PAGE_WIDTH = 800;

export interface DrawnPageSize {
  width: number;
  height: number;
  /** The Sketch paper the size is, `null` for a size the Sketch has no name for. */
  preset: SketchPagePresetId | null;
}

/**
 * The size a Sketch drawn as a page of a work takes: the work's page format. A5 and the 16:9 frame are
 * papers the Sketch already has; the comic book and manga pages are cut to their own shape.
 */
export function sketchSizeForPageFormat(format: PageFormat): DrawnPageSize {
  const named: Partial<Record<PageFormat, SketchPagePresetId>> = { a5: 'a5', wide: 'wide' };
  const presetId = named[format];
  if (presetId) {
    const preset = SKETCH_PAGE_PRESETS.find((candidate) => candidate.id === presetId);
    if (preset) return { width: preset.width, height: preset.height, preset: preset.id };
  }
  return {
    width: DRAWN_PAGE_WIDTH,
    height: Math.round(DRAWN_PAGE_WIDTH / PAGE_FORMAT_ASPECT[format]),
    preset: null,
  };
}
