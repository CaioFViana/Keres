import type { CreateStoryCalendarDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateStoryCalendarDataSchema, PartialStoryCalendarSchema } from '@keres/shared';
import { db } from '../../db';
import { storyCalendars } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

/**
 * A story's calendars.
 *
 * There is nothing to validate against other rows: a calendar references no other entity, and two
 * of them are two ways of reading the same time rather than a disagreement. Even `isPrimary` is not
 * enforced here - the reader picks deterministically when a merge leaves two, which is the only
 * behaviour that cannot lose an edit.
 */
export class StoryCalendarSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStoryCalendarDataSchema,
  typeof PartialStoryCalendarSchema
> {
  entityName = 'StoryCalendar';

  constructor() {
    super(
      'storyCalendars',
      'id',
      'version',
      CreateStoryCalendarDataSchema,
      PartialStoryCalendarSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStoryCalendarDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: StoryCalendar with ID ${update.id} already exists.`);
    }

    await db.insert(storyCalendars).values({
      id: update.id!,
      storyId,
      ...validatedData,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
