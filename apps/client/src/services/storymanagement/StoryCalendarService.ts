import type { CalendarDefinitionType } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StoryCalendarInsert, StoryCalendarSelect } from '../../db/schema';
import { storyCalendars } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/**
 * The story's calendars.
 *
 * ## The primary
 *
 * Exactly one calendar is primary: it is the one the graphs render in, and the one whose units the
 * story's durations are written in. The invariant is owned here rather than by the database, because
 * "exactly one true per story" is not expressible as a partial unique index without also forbidding
 * zero - and a story mid-setup legitimately has none.
 *
 * Two mechanisms keep it true. Promoting one demotes the rest in the same call, and `getPrimary`
 * picks deterministically when it finds more than one. The second exists because synchronization can
 * produce two: promoting on one device while another promotes a different calendar is not a
 * conflict either side can detect, and refusing to read in that state would be worse than choosing.
 */

export interface StoryCalendarService {
  getCalendarsForStory(storyId: string): Promise<StoryCalendarSelect[]>;
  getById(calendarId: string): Promise<StoryCalendarSelect | undefined>;
  /** The calendar the graphs use, or `undefined` when the story has none. */
  getPrimary(storyId: string): Promise<StoryCalendarSelect | undefined>;
  /** The primary's definition, or `null` - which is what the timing helpers take. */
  getPrimaryDefinition(storyId: string): Promise<CalendarDefinitionType | null>;
  createCalendar(
    currentUserId: string,
    data: Create<StoryCalendarInsert>,
  ): Promise<StoryCalendarSelect>;
  updateCalendar(
    currentUserId: string,
    calendarId: string,
    changes: Partial<{
      name: string;
      description: string | null;
      definition: CalendarDefinitionType;
      extraNotes: string | null;
    }>,
  ): Promise<StoryCalendarSelect>;
  /** Makes this one primary and demotes every other calendar in the story. */
  setPrimary(currentUserId: string, calendarId: string): Promise<void>;
  deleteCalendar(currentUserId: string, calendarId: string): Promise<void>;
}

export const createStoryCalendarService = (db: AppDrizzleClient): StoryCalendarService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(storyCalendars.storyId, storyId), eq(storyCalendars.isDeleted, false));

  const logOperation = async (
    currentUserId: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    calendarId: string,
    payload: Record<string, unknown>,
  ) => {
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await recordLocalOperation(
      db,
      storyId,
      userIdToLog,
      type,
      'StoryCalendar',
      calendarId,
      payload,
    );
    entityEventEmitter.emit('story_calendar_changed', storyId, calendarId);
  };

  const service: StoryCalendarService = {
    async getCalendarsForStory(storyId) {
      return db
        .select()
        .from(storyCalendars)
        .where(liveInStory(storyId))
        .orderBy(asc(storyCalendars.name))
        .all();
    },

    async getById(calendarId) {
      return db.query.storyCalendars.findFirst({ where: eq(storyCalendars.id, calendarId) });
    },

    async getPrimary(storyId) {
      const calendars = await service.getCalendarsForStory(storyId);
      /*
       * The oldest primary wins when two exist, and the tie is broken by id.
       * Deterministic rather than correct - there is no correct here, and every device has to make
       * the same choice or the same story would draw two different sets of dates.
       */
      const primaries = calendars
        .filter((calendar) => calendar.isPrimary)
        .sort(
          (a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime() ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );
      return primaries[0];
    },

    async getPrimaryDefinition(storyId) {
      return (await service.getPrimary(storyId))?.definition ?? null;
    },

    async createCalendar(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);

      /*
       * The first calendar a story gets is its primary, whatever the caller asked for. A story with
       * calendars and no primary would render no dates at all, which reads as the feature being
       * broken rather than as a setting being unset.
       */
      const existing = await service.getCalendarsForStory(data.storyId);
      const calendar = prepareNewEntityData<StoryCalendarInsert>({
        ...data,
        isPrimary: existing.length === 0 ? true : (data.isPrimary ?? false),
      });
      const result = await db.insert(storyCalendars).values(calendar).returning().get();

      if (result.isPrimary && existing.length > 0) {
        await service.setPrimary(currentUserId, result.id);
      }

      await logOperation(currentUserId, calendar.storyId, 'create', calendar.id, { ...result });
      return result;
    },

    async updateCalendar(currentUserId, calendarId, changes) {
      const original = await service.getById(calendarId);
      if (!original) throw new Error(`StoryCalendar with ID ${calendarId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const changed = getChangedFields(original, { ...original, ...changes });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      await db
        .update(storyCalendars)
        .set({ ...changes, updatedAt: new Date(), version: sql`${storyCalendars.version} + 1` })
        .where(eq(storyCalendars.id, calendarId));

      const updated = await service.getById(calendarId);
      if (!updated) throw new Error(`Failed to retrieve updated StoryCalendar ${calendarId}.`);

      const operationChanges = getChangedFields(original, updated);
      // A calendar definition is validated as one document. A recursive diff can retain only a
      // changed scalar (for example `daysPerWeek`) and omit required parts such as `months`.
      if (operationChanges.definition !== undefined) {
        operationChanges.definition = updated.definition;
      }

      await logOperation(currentUserId, updated.storyId, 'update', calendarId, operationChanges);
      return updated;
    },

    async setPrimary(currentUserId, calendarId) {
      const target = await service.getById(calendarId);
      if (!target) throw new Error(`StoryCalendar with ID ${calendarId} not found.`);
      await assertStoryIsWritable(db, target.storyId);

      const calendars = await service.getCalendarsForStory(target.storyId);
      /*
       * Every row that changes is logged separately, including the demotions. A single "promote"
       * operation would leave the other devices to infer the demotions, and an inference the log
       * does not state is one the other device can get wrong.
       */
      for (const calendar of calendars) {
        const shouldBePrimary = calendar.id === calendarId;
        if (calendar.isPrimary === shouldBePrimary) continue;

        await db
          .update(storyCalendars)
          .set({
            isPrimary: shouldBePrimary,
            updatedAt: new Date(),
            version: sql`${storyCalendars.version} + 1`,
          })
          .where(eq(storyCalendars.id, calendar.id));

        await logOperation(currentUserId, target.storyId, 'update', calendar.id, {
          isPrimary: shouldBePrimary,
        });
      }
    },

    async deleteCalendar(currentUserId, calendarId) {
      const calendar = await service.getById(calendarId);
      if (!calendar) {
        console.warn(`Attempted to delete non-existent StoryCalendar ${calendarId}.`);
        return;
      }
      await assertStoryIsWritable(db, calendar.storyId);

      const [updated] = await db
        .update(storyCalendars)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${storyCalendars.version} + 1`,
        })
        .where(eq(storyCalendars.id, calendarId))
        .returning({
          id: storyCalendars.id,
          storyId: storyCalendars.storyId,
          isDeleted: storyCalendars.isDeleted,
          version: storyCalendars.version,
        });
      if (!updated) throw new Error(`Failed to delete StoryCalendar ${calendarId}.`);

      await logOperation(currentUserId, updated.storyId, 'delete', calendarId, {
        id: updated.id,
        isDeleted: updated.isDeleted,
        version: updated.version,
      });

      /*
       * Deleting the primary promotes whatever is left. A story that still has calendars but no
       * primary would silently stop showing dates, and the writer would have no way to tell that
       * the deletion is what did it.
       */
      if (calendar.isPrimary) {
        const remaining = await service.getCalendarsForStory(calendar.storyId);
        if (remaining.length > 0) await service.setPrimary(currentUserId, remaining[0].id);
      }
    },
  };

  return service;
};
