import type { FountainImportPlan } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { createChapterService } from './ChapterService';
import { createCharacterSceneService } from './CharacterSceneService';
import { createCharacterService } from './CharacterService';
import { createLocationService } from './LocationService';
import { createSceneService } from './SceneService';

export interface FountainImportChoices {
  /** Places to create, by their name in capitals as the plan offers them. Anything else is only linked if it exists. */
  places: ReadonlySet<string>;
  /** Characters to create, likewise. */
  characters: ReadonlySet<string>;
}

export interface FountainImportInput {
  storyId: string;
  /** The work the chapters join; `null` lets the chapter service file them in the default one. */
  arcId: string | null;
  plan: FountainImportPlan;
  choices: FountainImportChoices;
  /** Names for what the file leaves unnamed: scenes under no section, text before the first heading. */
  fallbackChapterName: string;
  openingSceneName: string;
}

export interface FountainImportResult {
  chapters: number;
  scenes: number;
  places: number;
  characters: number;
}

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toUpperCase();

/** `THE OLD MILL` as `The Old Mill`: a script writes names in capitals, a cast list does not. */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_whole, before: string, letter: string) => {
      return `${before}${letter.toUpperCase()}`;
    });
}

/**
 * Brings a planned Fountain script in: a chapter per section and a scene per heading, each with its
 * text, its synopsis, its place and the characters who speak in it. Places and characters that already
 * exist in the story (by name) are linked; the ones the person ticked are created; the rest are left
 * as text in the scene - nothing is created that was not asked for.
 */
export async function importFountain(
  db: AppDrizzleClient,
  userId: string,
  input: FountainImportInput,
): Promise<FountainImportResult> {
  const { storyId, plan, choices } = input;
  const locationService = createLocationService(db);
  const characterService = createCharacterService(db);

  const placeIds = new Map<string, string>(
    (await locationService.getAllByStoryId(storyId))
      .filter((row) => !row.isDeleted)
      .map((row) => [key(row.name), row.id]),
  );
  const characterIds = new Map<string, string>(
    (await characterService.getAllByStoryId(storyId))
      .filter((row) => !row.isDeleted)
      .map((row) => [key(row.name), row.id]),
  );

  let placesCreated = 0;
  for (const place of plan.places) {
    const id = key(place.name);
    if (placeIds.has(id) || !choices.places.has(id)) continue;
    const created = await locationService.createLocation(userId, {
      storyId,
      name: titleCase(place.name),
      intExt: place.intExt,
    } as never);
    placeIds.set(id, created.id);
    placesCreated += 1;
  }
  let charactersCreated = 0;
  for (const character of plan.characters) {
    const id = key(character.name);
    if (characterIds.has(id) || !choices.characters.has(id)) continue;
    const created = await characterService.createCharacter(userId, {
      storyId,
      name: titleCase(character.name),
    } as never);
    characterIds.set(id, created.id);
    charactersCreated += 1;
  }

  const chapterService = createChapterService(db);
  const sceneService = createSceneService(db);
  const castService = createCharacterSceneService(db);
  const existing = await chapterService.getAllByStoryId(storyId, 'chapter');
  let nextIndex = existing.length > 0 ? Math.max(...existing.map((row) => row.index || 0)) + 1 : 1;
  let chapters = 0;
  let scenes = 0;

  for (const section of plan.sections) {
    if (section.scenes.length === 0) continue;
    const chapter = await chapterService.createChapter(userId, {
      storyId,
      name: (section.name ?? input.fallbackChapterName).slice(0, 120),
      index: nextIndex,
      type: 'chapter',
      arcId: input.arcId,
    } as never);
    nextIndex += 1;
    chapters += 1;
    for (const planned of section.scenes) {
      const place = planned.place ? placeIds.get(key(planned.place.name)) : undefined;
      const scene = await sceneService.createScene(userId, {
        storyId,
        chapterId: chapter.id,
        name: (planned.heading ?? input.openingSceneName).slice(0, 120),
        summary: planned.synopsis,
        body: planned.body || null,
        locationId: place ?? null,
      } as never);
      scenes += 1;
      for (const name of planned.cast) {
        const characterId = characterIds.get(key(name));
        if (characterId) {
          await castService.saveCharacterScene(userId, {
            storyId,
            characterId,
            sceneId: scene.id,
          });
        }
      }
    }
  }
  return { chapters, scenes, places: placesCreated, characters: charactersCreated };
}
