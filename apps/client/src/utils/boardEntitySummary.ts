import { summarizeBoardEntity, type BoardEntitySummary, type BoardPinEntity } from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createGalleryService } from '../services/storymanagement/GalleryService';
import { createItemService } from '../services/storymanagement/ItemService';
import { createLocationService } from '../services/storymanagement/LocationService';
import { createNoteService } from '../services/storymanagement/NoteService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { createWorldRuleService } from '../services/storymanagement/WorldRuleService';
import { createBoardService } from '../services/storymanagement/BoardService';

/**
 * Loads the summary of the entity behind a board pin. Each entity kind contributes its own
 * descriptive field - a character's `description`, a scene's `summary`, a gallery's `extraNotes` -
 * and the sheet shows it as context without opening the entity's own screen.
 */
export async function loadBoardEntitySummary(
  db: AppDrizzleClient,
  entityType: BoardPinEntity,
  entityId: string,
): Promise<BoardEntitySummary | null> {
  const loaderByEntity = {
    Character: createCharacterService(db).getById,
    Location: createLocationService(db).getById,
    Scene: createSceneService(db).getById,
    Item: createItemService(db).getById,
    Chapter: createChapterService(db).getById,
    Gallery: createGalleryService(db).getById,
    WorldRule: createWorldRuleService(db).getById,
    Note: createNoteService(db).getById,
    Board: createBoardService(db).getById,
  } as const;
  const row = await loaderByEntity[entityType](entityId);
  return row ? summarizeBoardEntity(entityType, row) : null;
}

export type { BoardEntitySummary };
