import type { SketchContentType } from '@keres/shared';
import { emptySketchContent, generateSketchLocalId, validateSketchContent } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { SketchInsert, SketchSelect } from '../../db/schema';
import { sketches } from '../../db/schema';
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

export interface SketchService {
  getSketchesForStory(storyId: string): Promise<SketchSelect[]>;
  getById(sketchId: string): Promise<SketchSelect | undefined>;
  createSketch(currentUserId: string, data: Create<SketchInsert>): Promise<SketchSelect>;
  updateSketch(
    currentUserId: string,
    sketchId: string,
    changes: Partial<{
      name: string;
      description: string | null;
      content: SketchContentType;
      coverGalleryId: string | null;
      coverSourceHash: string | null;
    }>,
  ): Promise<SketchSelect>;
  deleteSketch(currentUserId: string, sketchId: string): Promise<void>;
}

export const createSketchService = (db: AppDrizzleClient): SketchService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(sketches.storyId, storyId), eq(sketches.isDeleted, false));

  const userIdFor = (currentUserId: string, storyId: string) =>
    getUserIdForOperation(db, serverService, storyId, currentUserId);

  /** Inside a unit. */
  const logOperation = (
    userIdToLog: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    sketchId: string,
    payload: Record<string, unknown>,
  ) => {
    recordLocalOperationSync(db, storyId, userIdToLog, type, 'Sketch', sketchId, payload);
  };

  return {
    async getSketchesForStory(storyId) {
      return db
        .select()
        .from(sketches)
        .where(liveInStory(storyId))
        .orderBy(asc(sketches.name))
        .all();
    },

    async getById(sketchId) {
      return db.query.sketches.findFirst({ where: eq(sketches.id, sketchId) });
    },

    async createSketch(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const content = validateSketchContent(
        data.content ?? emptySketchContent(generateSketchLocalId(new Set()), 'Layer 1'),
      );
      const sketch = prepareNewEntityData<SketchInsert>({ ...data, content });
      const userIdToLog = await userIdFor(currentUserId, sketch.storyId);
      const result = await runLocalWrite(db, sketch.storyId, () => {
        const inserted = db.insert(sketches).values(sketch).returning().get();
        logOperation(userIdToLog, sketch.storyId, 'create', sketch.id, { ...inserted });
        return inserted;
      });
      entityEventEmitter.emit('sketch_changed', sketch.storyId, sketch.id);
      return result;
    },

    async updateSketch(currentUserId, sketchId, changes) {
      const original = await db.query.sketches.findFirst({ where: eq(sketches.id, sketchId) });
      if (!original) throw new Error(`Sketch with ID ${sketchId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const nextContent =
        changes.content !== undefined ? validateSketchContent(changes.content) : undefined;
      const normalised = {
        ...changes,
        ...(nextContent !== undefined ? { content: nextContent } : {}),
      };
      const changed = getChangedFields(original, { ...original, ...normalised });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const updated = await runLocalWrite(db, original.storyId, () => {
        db.update(sketches)
          .set({ ...normalised, updatedAt: new Date(), version: sql`${sketches.version} + 1` })
          .where(eq(sketches.id, sketchId))
          .run();

        const row = db.select().from(sketches).where(eq(sketches.id, sketchId)).get();
        if (!row) throw new Error(`Failed to retrieve updated Sketch ${sketchId}.`);

        const operationChanges = getChangedFields(original, row);
        // `content` is one validated document on the wire, not a patchable object. The generic
        // diff descends into objects and would turn a change to it into a fragment such as
        // `{ content: { overlays: [...] } }`, omitting the required `page` object. Besides being
        // rejected by the server, that left the original create queued beside the refused update.
        // Always record the complete document when it changed.
        if (operationChanges.content !== undefined) {
          operationChanges.content = row.content;
        }

        logOperation(userIdToLog, row.storyId, 'update', sketchId, operationChanges);
        return row;
      });
      entityEventEmitter.emit('sketch_changed', updated.storyId, sketchId);
      return updated;
    },

    async deleteSketch(currentUserId, sketchId) {
      const original = await db.query.sketches.findFirst({ where: eq(sketches.id, sketchId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent sketch ${sketchId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);

      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const updated = await runLocalWrite(db, original.storyId, () => {
        const deleted = db
          .update(sketches)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${sketches.version} + 1`,
          })
          .where(eq(sketches.id, sketchId))
          .returning({
            id: sketches.id,
            storyId: sketches.storyId,
            isDeleted: sketches.isDeleted,
            version: sketches.version,
          })
          .get();

        if (!deleted) throw new Error(`Failed to delete sketch ${sketchId}.`);

        logOperation(userIdToLog, deleted.storyId, 'delete', sketchId, {
          id: deleted.id,
          isDeleted: deleted.isDeleted,
          version: deleted.version,
        });
        return deleted;
      });
      entityEventEmitter.emit('sketch_changed', updated.storyId, sketchId);
    },
  };
};
