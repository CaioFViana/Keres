import {
  MANUSCRIPT_PRESET_SETTINGS,
  type ManuscriptFormat,
  type ManuscriptPreset,
  type ManuscriptStyle,
} from '@keres/shared';

/**
 * Everything the export screen asks, shared by the local export and the publish of a manuscript
 * to the showcase: one set of choices, one set of defaults.
 */
export type ManuscriptExportSettings = {
  /** Which preset the settings started from; `custom` once anything departs from it. */
  preset: ManuscriptPreset | 'custom';
  format: ManuscriptFormat;
  includeSceneNames: boolean;
  includeLooseScenes: boolean;
  resetSceneNumbers: boolean;
  includeIndex: boolean;
  /** Branching only: how the gamebook numbers its scenes. */
  sceneOrder: 'discovery' | 'shuffled';
  /** Which arc to export; null exports every arc. */
  arcId: string | null;
  /** A generated title page: the author and a copyright line under the title. */
  titlePage: boolean;
  /** The book's author (EPUB metadata, title page); the story's by default. */
  author: string;
  style: ManuscriptStyle;
};

export function defaultExportSettings(author = ''): ManuscriptExportSettings {
  return {
    preset: 'custom',
    format: 'docx',
    includeSceneNames: false,
    includeLooseScenes: false,
    resetSceneNumbers: false,
    includeIndex: false,
    sceneOrder: 'discovery',
    arcId: null,
    titlePage: false,
    author,
    style: {},
  };
}

/** A preset's defaults over the current settings; the content scope (arc, loose scenes) stays. */
export function applyPreset(
  settings: ManuscriptExportSettings,
  preset: ManuscriptPreset,
): ManuscriptExportSettings {
  const defaults = MANUSCRIPT_PRESET_SETTINGS[preset];
  return {
    ...settings,
    preset,
    format: defaults.format,
    includeIndex: defaults.includeToc,
    includeSceneNames: defaults.includeSceneNames,
    titlePage: defaults.titlePage,
    style: { ...defaults.style },
  };
}

/** A change made by hand: the settings no longer are the preset's. */
export function withChange(
  settings: ManuscriptExportSettings,
  change: Partial<Omit<ManuscriptExportSettings, 'style' | 'preset'>> & {
    style?: Partial<ManuscriptStyle>;
  },
): ManuscriptExportSettings {
  const { style, ...rest } = change;
  return {
    ...settings,
    ...rest,
    preset: 'custom',
    style: style ? { ...settings.style, ...style } : settings.style,
  };
}

/** Which options a format can honor: the screen hides the others, the renderer ignores them. */
export const FORMAT_CAPABILITIES: Record<
  ManuscriptFormat,
  { index: boolean; face: boolean; body: boolean; page: boolean }
> = {
  docx: { index: true, face: true, body: true, page: false },
  pdf: { index: true, face: false, body: true, page: true },
  epub: { index: true, face: true, body: true, page: false },
  html: { index: true, face: true, body: true, page: false },
  md: { index: true, face: false, body: false, page: false },
  txt: { index: false, face: false, body: false, page: false },
};

/**
 * The style as the pipeline takes it: the title page as localized lines, the author and the date
 * as placeholders, and only what the format can honor.
 */
export function styleForExport(
  settings: ManuscriptExportSettings,
  titlePageLines: { byLine: string; copyright: string },
  now: Date,
): ManuscriptStyle {
  const capabilities = FORMAT_CAPABILITIES[settings.format];
  const { fontFamily, fontSize, lineSpacing, paragraphStyle, pageSize, ...rest } = settings.style;
  const author = settings.author.trim();
  return {
    ...rest,
    ...(capabilities.face && fontFamily ? { fontFamily } : {}),
    ...(capabilities.body && fontSize ? { fontSize } : {}),
    ...(capabilities.body && lineSpacing ? { lineSpacing } : {}),
    ...(capabilities.body && paragraphStyle ? { paragraphStyle } : {}),
    ...(capabilities.page && pageSize ? { pageSize } : {}),
    ...(settings.titlePage && author
      ? { frontMatter: [titlePageLines.byLine, titlePageLines.copyright] }
      : {}),
    placeholders: {
      ...(author ? { author } : {}),
      year: String(now.getFullYear()),
      date: now.toISOString().slice(0, 10),
      ...rest.placeholders,
    },
  };
}
