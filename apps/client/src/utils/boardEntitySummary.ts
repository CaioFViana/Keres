import type { BoardPinEntity } from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createCharacterService } from '../services/storymanagement/CharacterService';
import { createGalleryService } from '../services/storymanagement/GalleryService';
import { createItemService } from '../services/storymanagement/ItemService';
import { createLocationService } from '../services/storymanagement/LocationService';
import { createNoteService } from '../services/storymanagement/NoteService';
import { createSceneService } from '../services/storymanagement/SceneService';
import { createWorldRuleService } from '../services/storymanagement/WorldRuleService';

/** A light summary of an entity pin, shown when its board node is opened. */
export interface BoardEntitySummary {
  title: string;
  details: string | null;
}

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
  switch (entityType) {
    case 'Character': {
      const row = await createCharacterService(db).getById(entityId);
      return row ? { title: row.name, details: row.description } : null;
    }
    case 'Location': {
      const row = await createLocationService(db).getById(entityId);
      return row ? { title: row.name, details: row.description } : null;
    }
    case 'Scene': {
      const row = await createSceneService(db).getById(entityId);
      return row ? { title: row.name, details: row.summary } : null;
    }
    case 'Item': {
      const row = await createItemService(db).getById(entityId);
      return row ? { title: row.name, details: row.description } : null;
    }
    case 'Chapter': {
      const row = await createChapterService(db).getById(entityId);
      return row ? { title: row.name, details: row.summary ?? row.extraNotes } : null;
    }
    case 'Gallery': {
      const row = await createGalleryService(db).getById(entityId);
      return row ? { title: row.title ?? row.fileName, details: row.extraNotes } : null;
    }
    case 'WorldRule': {
      const row = await createWorldRuleService(db).getById(entityId);
      return row ? { title: row.title, details: row.description } : null;
    }
    case 'Note': {
      const row = await createNoteService(db).getById(entityId);
      return row ? { title: row.title, details: row.body } : null;
    }
    default:
      return null;
  }
}