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
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/**
 * The story's calendars.
 *
 * ## The primary
 *
 * At most one calendar is primary: it is the one the graphs render in, and the one whose units the
 * story's durations are written in. A story may deliberately have none, in which case duration
 * display keeps the established Gregorian averages and its calendars remain parallel references.
 *
 * Promoting one demotes the rest in the same call. `getPrimary` still picks deterministically when
 * synchronization has produced two: two devices may promote different calendars concurrently, and
 * choosing the same winner everywhere is safer than rendering different dates per device.
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
  /** Demotes the current primary without promoting a replacement. */
  clearPrimary(currentUserId: string, storyId: string): Promise<void>;
  deleteCalendar(currentUserId: string, calendarId: string): Promise<void>;
}

export const createStoryCalendarService = (db: AppDrizzleClient): StoryCalendarService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(storyCalendars.storyId, storyId), eq(storyCalendars.isDeleted, false));

  const userIdFor = (currentUserId: string, storyId: string) =>
    getUserIdForOperation(db, serverService, storyId, currentUserId);

  /** Inside a unit. */
  const logOperation = (
    userIdToLog: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    calendarId: string,
    payload: Record<string, unknown>,
  ) => {
    recordLocalOperationSync(db, storyId, userIdToLog, type, 'StoryCalendar', calendarId, payload);
  };

  const emitChanged = (storyId: string, calendarIds: string[]) => {
    for (const calendarId of calendarIds) {
      entityEventEmitter.emit('story_calendar_changed', storyId, calendarId);
    }
  };

  /**
   * Inside a unit: leaves `primaryId` (or none) as the only primary among `calendars`.
   *
   * Every row that changes is logged separately, including the demotions. A single "promote"
   * operation would leave the other devices to infer the demotions, and an inference the log
   * does not state is one the other device can get wrong.
   */
  const applyPrimary = (
    userIdToLog: string,
    storyId: string,
    calendars: StoryCalendarSelect[],
    primaryId: string | null,
  ): string[] => {
    const changedIds: string[] = [];
    for (const calendar of calendars) {
      const shouldBePrimary = calendar.id === primaryId;
      if (calendar.isPrimary === shouldBePrimary) continue;

      db.update(storyCalendars)
        .set({
          isPrimary: shouldBePrimary,
          updatedAt: new Date(),
          version: sql`${storyCalendars.version} + 1`,
        })
        .where(eq(storyCalendars.id, calendar.id))
        .run();
      logOperation(userIdToLog, storyId, 'update', calendar.id, { isPrimary: shouldBePrimary });
      changedIds.push(calendar.id);
    }
    return changedIds;
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

      const existing = await service.getCalendarsForStory(data.storyId);
      const calendar = prepareNewEntityData<StoryCalendarInsert>({
        ...data,
        isPrimary: data.isPrimary ?? false,
      });
      const userIdToLog = await userIdFor(currentUserId, calendar.storyId);

      const { result, demotedIds } = await runLocalWrite(db, calendar.storyId, () => {
        const inserted = db.insert(storyCalendars).values(calendar).returning().get();
        logOperation(userIdToLog, calendar.storyId, 'create', calendar.id, { ...inserted });
        const demoted = inserted.isPrimary
          ? applyPrimary(userIdToLog, calendar.storyId, existing, inserted.id)
          : [];
        return { result: inserted, demotedIds: demoted };
      });
      emitChanged(calendar.storyId, [...demotedIds, calendar.id]);
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

      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const updated = await runLocalWrite(db, original.storyId, () => {
        db.update(storyCalendars)
          .set({ ...changes, updatedAt: new Date(), version: sql`${storyCalendars.version} + 1` })
          .where(eq(storyCalendars.id, calendarId))
          .run();

        const row = db.select().from(storyCalendars).where(eq(storyCalendars.id, calendarId)).get();
        if (!row) throw new Error(`Failed to retrieve updated StoryCalendar ${calendarId}.`);

        const operationChanges = getChangedFields(original, row);
        // A calendar definition is validated as one document. A recursive diff can retain only a
        // changed scalar (for example `daysPerWeek`) and omit required parts such as `months`.
        if (operationChanges.definition !== undefined) {
          operationChanges.definition = row.definition;
        }

        logOperation(userIdToLog, row.storyId, 'update', calendarId, operationChanges);
        return row;
      });
      emitChanged(updated.storyId, [calendarId]);
      return updated;
    },

    async setPrimary(currentUserId, calendarId) {
      const target = await service.getById(calendarId);
      if (!target) throw new Error(`StoryCalendar with ID ${calendarId} not found.`);
      await assertStoryIsWritable(db, target.storyId);

      const calendars = await service.getCalendarsForStory(target.storyId);
      const userIdToLog = await userIdFor(currentUserId, target.storyId);
      const changedIds = await runLocalWrite(db, target.storyId, () =>
        applyPrimary(userIdToLog, target.storyId, calendars, calendarId),
      );
      emitChanged(target.storyId, changedIds);
    },

    async clearPrimary(currentUserId, storyId) {
      await assertStoryIsWritable(db, storyId);
      const calendars = await service.getCalendarsForStory(storyId);
      if (!calendars.some((calendar) => calendar.isPrimary)) return;
      const userIdToLog = await userIdFor(currentUserId, storyId);
      const changedIds = await runLocalWrite(db, storyId, () =>
        applyPrimary(userIdToLog, storyId, calendars, null),
      );
      emitChanged(storyId, changedIds);
    },

    async deleteCalendar(currentUserId, calendarId) {
      const calendar = await service.getById(calendarId);
      if (!calendar) {
        console.warn(`Attempted to delete non-existent StoryCalendar ${calendarId}.`);
        return;
      }
      await assertStoryIsWritable(db, calendar.storyId);

      const userIdToLog = await userIdFor(currentUserId, calendar.storyId);
      const updated = await runLocalWrite(db, calendar.storyId, () => {
        const deleted = db
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
          })
          .get();
        if (!deleted) throw new Error(`Failed to delete StoryCalendar ${calendarId}.`);

        logOperation(userIdToLog, deleted.storyId, 'delete', calendarId, {
          id: deleted.id,
          isDeleted: deleted.isDeleted,
          version: deleted.version,
        });
        return deleted;
      });
      emitChanged(updated.storyId, [calendarId]);
    },
  };

  return service;
};
