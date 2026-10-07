import type { AppDrizzleClient } from '../../db';
import type { ChapterSelect, SceneSelect } from '../../db/schema';
import { createAttributeValueService } from './AttributeValueService';
import { createChapterService } from './ChapterService';
import { createSceneService } from './SceneService';
import { createStorySchemaFieldService } from './StorySchemaFieldService';

/** The key the campaign pack gives a session's real date; any story may define a field with it. */
export const SESSION_DATE_FIELD_KEY = 'session_date';

export interface StartSessionInput {
  storyId: string;
  /** The work the session belongs to; `null` lets the chapter service file it in the default one. */
  arcId: string | null;
  chapterName: string;
  sceneName: string;
  /** The real date the table met, canonical `YYYY-MM-DD`. */
  playedOn: string;
}

/**
 * Starts a session of a tabletop campaign in one step: a chapter (the session) after the last one,
 * with its first scene ready to write in. The only thing asked is the real date, which lands in the
 * session's `session_date` attribute when the story has that field (the campaign pack defines it) and
 * in its summary otherwise, so it is never lost for the want of a pack.
 */
export async function startSession(
  db: AppDrizzleClient,
  userId: string,
  input: StartSessionInput,
): Promise<{ chapter: ChapterSelect; scene: SceneSelect }> {
  const chapterService = createChapterService(db);
  const siblings = await chapterService.getAllByStoryId(input.storyId, 'chapter');
  const nextIndex =
    siblings.length > 0 ? Math.max(...siblings.map((row) => row.index || 0)) + 1 : 1;

  const dateField = (
    await createStorySchemaFieldService(db).getFieldsByStoryAndEntityType(input.storyId, 'Chapter')
  ).find((field) => field.key === SESSION_DATE_FIELD_KEY && field.type === 'date');

  const chapter = await chapterService.createChapter(userId, {
    storyId: input.storyId,
    name: input.chapterName,
    index: nextIndex,
    type: 'chapter',
    arcId: input.arcId,
    summary: dateField ? null : input.playedOn,
  } as never);
  if (dateField) {
    await createAttributeValueService(db).saveValuesForEntity(
      userId,
      input.storyId,
      'Chapter',
      chapter.id,
      { [dateField.id]: input.playedOn },
    );
  }
  const scene = await createSceneService(db).createScene(userId, {
    storyId: input.storyId,
    chapterId: chapter.id,
    name: input.sceneName,
  } as never);
  return { chapter, scene };
}
