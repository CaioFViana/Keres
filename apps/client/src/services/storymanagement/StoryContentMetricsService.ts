import { and, count, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { choices, scenes, stories } from '../../db/schema';
import { createChapterService } from './ChapterService';
import { createCharacterService } from './CharacterService';
import { createChoiceService } from './ChoiceService';
import { createGalleryService } from './GalleryService';
import { createItemService } from './ItemService';
import { createLocationService } from './LocationService';
import { createNoteService } from './NoteService';
import { createSceneService } from './SceneService';
import { createStorySchemaFieldService } from './StorySchemaFieldService';
import { createTagService } from './TagService';
import { createWorldRuleService } from './WorldRuleService';

export interface StoryCatalogCounts {
  totalStories: number;
  branchingStories: number;
}

/** The aggregate counts displayed in the story selection and dashboard read models. */
export interface StoryContentCounts {
  characterCount: number;
  choiceCount: number;
  locationCount: number;
  chapterCount: number;
  sceneCount: number;
  noteCount: number;
  worldRuleCount: number;
  itemCount: number;
  galleryCount: number;
  tagCount: number;
  customAttributeCount: number;
  branchingStoryForkCount: number;
}

export interface StoryContentMetricsService {
  getCatalogCounts(): Promise<StoryCatalogCounts>;
  getContentCounts(storyId?: string): Promise<StoryContentCounts>;
}

/**
 * Query-side composition for story overview screens. Entity services continue to own each
 * table's live-row count; this service only groups those independent facts into one read model.
 */
export const createStoryContentMetricsService = (
  db: AppDrizzleClient,
): StoryContentMetricsService => {
  const characterService = createCharacterService(db);
  const chapterService = createChapterService(db);
  const choiceService = createChoiceService(db);
  const galleryService = createGalleryService(db);
  const itemService = createItemService(db);
  const locationService = createLocationService(db);
  const noteService = createNoteService(db);
  const sceneService = createSceneService(db);
  const storySchemaFieldService = createStorySchemaFieldService(db);
  const tagService = createTagService(db);
  const worldRuleService = createWorldRuleService(db);

  const getBranchingStoryForkCount = async (storyId?: string): Promise<number> => {
    const result = await db
      .select({ count: count(scenes.id) })
      .from(scenes)
      .innerJoin(stories, eq(scenes.storyId, stories.id))
      .leftJoin(choices, and(eq(scenes.id, choices.sceneId), eq(choices.isDeleted, false)))
      .where(
        storyId
          ? and(
              eq(stories.id, storyId),
              eq(stories.type, 'branching'),
              eq(stories.isDeleted, false),
              eq(scenes.isDeleted, false),
            )
          : and(
              eq(stories.type, 'branching'),
              eq(stories.isDeleted, false),
              eq(scenes.isDeleted, false),
            ),
      )
      .groupBy(scenes.id)
      .having(sql`count(${choices.id}) > 1`)
      .all();

    return result.length;
  };

  return {
    async getCatalogCounts(): Promise<StoryCatalogCounts> {
      const [total, branching] = await Promise.all([
        db.select({ count: count() }).from(stories).where(eq(stories.isDeleted, false)).get(),
        db
          .select({ count: count() })
          .from(stories)
          .where(and(eq(stories.type, 'branching'), eq(stories.isDeleted, false)))
          .get(),
      ]);
      return {
        totalStories: total?.count ?? 0,
        branchingStories: branching?.count ?? 0,
      };
    },

    async getContentCounts(storyId?: string): Promise<StoryContentCounts> {
      const [
        characterCount,
        choiceCount,
        locationCount,
        chapterCount,
        sceneCount,
        noteCount,
        worldRuleCount,
        itemCount,
        galleryCount,
        tagCount,
        customAttributeCount,
        branchingStoryForkCount,
      ] = await Promise.all([
        characterService.getCharacterCount(storyId),
        choiceService.getChoiceCount(storyId),
        locationService.getLocationCount(storyId),
        chapterService.getChapterCount(storyId),
        sceneService.getSceneCount(storyId),
        noteService.getNoteCount(storyId),
        worldRuleService.getWorldRuleCount(storyId),
        itemService.getItemCount(storyId),
        galleryService.getGalleryCount(storyId),
        tagService.getTagCount(storyId),
        storySchemaFieldService.getCustomAttributeCount(storyId),
        getBranchingStoryForkCount(storyId),
      ]);

      return {
        characterCount,
        choiceCount,
        locationCount,
        chapterCount,
        sceneCount,
        noteCount,
        worldRuleCount,
        itemCount,
        galleryCount,
        tagCount,
        customAttributeCount,
        branchingStoryForkCount,
      };
    },
  };
};
