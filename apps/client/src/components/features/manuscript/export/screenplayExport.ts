import {
  type CompileStoryManuscriptInput,
  type ManuscriptSceneMusic,
  type ManuscriptOptions,
  ManuscriptOptionsSchema,
  type ScreenplayEstimate,
  compileScreenplayManuscript,
  estimateScreenplayPages,
  screenplayFountainOf,
  screenplayPreset,
} from '@keres/shared';
import type { ChapterSelect, LocationSelect, SceneSelect } from '../../../../db/schema';
import type { ManuscriptExportSettings } from './manuscriptExportSettings';

/** What the screenplay compiler reads, from the rows the app already holds. */
export function screenplayInputOf({
  title,
  chapters,
  scenes,
  locations,
  arcs,
  music,
}: {
  title: string;
  chapters: readonly ChapterSelect[];
  scenes: readonly SceneSelect[];
  locations: readonly LocationSelect[];
  arcs: readonly { id: string; title: string }[];
  /** Each scene's music, when the export carries it. */
  music?: ReadonlyMap<string, ManuscriptSceneMusic[]> | null;
}): CompileStoryManuscriptInput {
  const locationsById = new Map(locations.map((row) => [row.id, row]));
  return {
    storyTitle: title,
    storyType: 'linear',
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      index: chapter.index,
      type: chapter.type,
      arcId: chapter.arcId,
    })),
    scenes: scenes.map((scene) => {
      const place = scene.locationId ? locationsById.get(scene.locationId) : undefined;
      return {
        id: scene.id,
        chapterId: scene.chapterId,
        name: scene.name,
        index: scene.index,
        body: scene.body,
        isDeleted: scene.isDeleted,
        summary: scene.summary,
        locationName: place?.name ?? null,
        locationIntExt: place?.intExt ?? null,
        ...(music?.has(scene.id) ? { music: music.get(scene.id) } : {}),
      };
    }),
    choices: [],
    arcs: arcs.map((arc) => ({ id: arc.id, title: arc.title })),
  };
}

/** The options a screenplay export means, from what the export screen collected. */
export function screenplayOptionsOf(
  settings: ManuscriptExportSettings,
  language: string,
  /** What a note says before the title of a piece of music; the default when absent. */
  musicLabel?: string,
): ManuscriptOptions {
  return ManuscriptOptionsSchema.parse({
    format: settings.format,
    arcId: settings.arcId ?? undefined,
    includeLooseScenes: settings.includeLooseScenes,
    author: settings.author.trim() || undefined,
    language,
    screenplay: {
      paper: settings.screenplay.paper,
      numberScenes: settings.screenplay.numberScenes,
      generateHeadings: settings.screenplay.generateHeadings,
      includeMusicNotes: settings.includeMusicCues,
    },
    ...(musicLabel ? { labels: { musicLabel } } : {}),
  });
}

/** The script's length under the settings' paper, and the preset it stands on. */
export function screenplayEstimateOf(
  input: CompileStoryManuscriptInput,
  settings: ManuscriptExportSettings,
  language: string,
): ScreenplayEstimate {
  const options = screenplayOptionsOf({ ...settings, format: 'fountain' }, language);
  const { text } = screenplayFountainOf(input, options);
  return estimateScreenplayPages(text, screenplayPreset(settings.screenplay.paper));
}

export { compileScreenplayManuscript };
