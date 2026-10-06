import {
  MANUSCRIPT_PRESET_SETTINGS,
  type ManuscriptFormat,
  type ManuscriptPreset,
  type ManuscriptStyle,
  type ScreenplayPaper,
} from '@keres/shared';

/** The two formats of a screenplay: Fountain text, and the PDF set the way the industry sets it. */
export const SCREENPLAY_FORMATS = [
  'fountain',
  'screenplay-pdf',
] as const satisfies readonly ManuscriptFormat[];

export function isScreenplayFormat(format: ManuscriptFormat): boolean {
  return (SCREENPLAY_FORMATS as readonly ManuscriptFormat[]).includes(format);
}

/** What only a screenplay export asks. */
export type ScreenplayExportSettings = {
  paper: ScreenplayPaper;
  numberScenes: boolean;
  generateHeadings: boolean;
};

export const DEFAULT_SCREENPLAY_SETTINGS: ScreenplayExportSettings = {
  paper: 'letter',
  numberScenes: false,
  generateHeadings: true,
};

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
  /** Only read for a screenplay format. */
  screenplay: ScreenplayExportSettings;
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
    screenplay: { ...DEFAULT_SCREENPLAY_SETTINGS },
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
  change: Partial<Omit<ManuscriptExportSettings, 'style' | 'preset' | 'screenplay'>> & {
    style?: Partial<ManuscriptStyle>;
    screenplay?: Partial<ScreenplayExportSettings>;
  },
): ManuscriptExportSettings {
  const { style, screenplay, ...rest } = change;
  return {
    ...settings,
    ...rest,
    preset: 'custom',
    style: style ? { ...settings.style, ...style } : settings.style,
    screenplay: screenplay ? { ...settings.screenplay, ...screenplay } : settings.screenplay,
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
  // A screenplay sets its own page: the choices of a book mean nothing to it.
  fountain: { index: false, face: false, body: false, page: false },
  'screenplay-pdf': { index: false, face: false, body: false, page: false },
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
