import type { PlotScene } from '@keres/shared/entities/PlotScene';
import { PLOT_SCENE_NOTE_MAX_LENGTH } from '@keres/shared/entities/PlotScene';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, PlotSceneInsert } from '../../db';
import { plotScenes } from '../../db';
import * as schema from '../../db/schema';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type SavePlotScene = Pick<PlotScene, 'storyId' | 'plotId' | 'sceneId' | 'note'> & {
  id?: string;
};

const assertRelationIsValid = async (db: AppDrizzleClient, relation: SavePlotScene) => {
  const [story, plot, scene] = await Promise.all([
    db.query.stories.findFirst({ where: eq(schema.stories.id, relation.storyId) }),
    db.query.plots.findFirst({
      where: and(
        eq(schema.plots.id, relation.plotId),
        eq(schema.plots.storyId, relation.storyId),
        eq(schema.plots.isDeleted, false),
      ),
    }),
    db.query.scenes.findFirst({
      where: and(
        eq(schema.scenes.id, relation.sceneId),
        eq(schema.scenes.storyId, relation.storyId),
        eq(schema.scenes.isDeleted, false),
      ),
    }),
  ]);
  if (!story || story.isDeleted) throw new Error('Story not found.');
  if (!plot || !scene) throw new Error('Plot and scene must belong to the active story.');
};

/**
 * The note is the relation's content, so it is validated here and not only in the form: import, sync
 * and example cloning arrive through the same path and never go through the screen.
 */
const normalizeNote = (note: string) => {
  const normalized = note.trim();
  if (!normalized) throw new Error('Plot-scene note cannot be empty.');
  if (/[\r\n]/.test(normalized)) throw new Error('Plot-scene note must be a single line.');
  if (normalized.length > PLOT_SCENE_NOTE_MAX_LENGTH)
    throw new Error(`Plot-scene note must be ${PLOT_SCENE_NOTE_MAX_LENGTH} characters or fewer.`);
  return normalized;
};

export const createPlotSceneService = (db: AppDrizzleClient) => {
  const serverService = createServerService(db);
  return {
    async getByPlotId(storyId: string, plotId: string): Promise<PlotScene[]> {
      return db.query.plotScenes.findMany({
        where: and(
          eq(plotScenes.storyId, storyId),
          eq(plotScenes.plotId, plotId),
          eq(plotScenes.isDeleted, false),
        ),
      });
    },
    async getBySceneId(storyId: string, sceneId: string): Promise<PlotScene[]> {
      return db.query.plotScenes.findMany({
        where: and(
          eq(plotScenes.storyId, storyId),
          eq(plotScenes.sceneId, sceneId),
          eq(plotScenes.isDeleted, false),
        ),
      });
    },
    async getAllByStoryId(storyId: string): Promise<PlotScene[]> {
      return db.query.plotScenes.findMany({
        where: and(eq(plotScenes.storyId, storyId), eq(plotScenes.isDeleted, false)),
      });
    },
    async save(userId: string, relation: SavePlotScene): Promise<PlotScene> {
      await assertStoryIsWritable(db, relation.storyId);
      await assertRelationIsValid(db, relation);
      const note = normalizeNote(relation.note);
      // The app's relation managers already create the row with a ULID of their own, as they do with
      // character relations - what decides between creating and updating is the row existing, not the object
      // having an `id`.
      const original = relation.id
        ? await db.query.plotScenes.findFirst({ where: eq(plotScenes.id, relation.id) })
        : undefined;
      const duplicate = await db.query.plotScenes.findFirst({
        where: and(
          eq(plotScenes.storyId, relation.storyId),
          eq(plotScenes.plotId, relation.plotId),
          eq(plotScenes.sceneId, relation.sceneId),
          eq(plotScenes.isDeleted, false),
        ),
      });
      if (duplicate && duplicate.id !== relation.id)
        throw new Error('This scene is already part of this plot.');
      if (original) {
        if (original.isDeleted) throw new Error('Plot-scene relation not found.');
        const changes = getChangedFields(original, { ...original, ...relation, note });
        delete changes.updatedAt;
        delete changes.version;
        if (Object.keys(changes).length === 0) return original;
        const [updated] = await db
          .update(plotScenes)
          .set({
            plotId: relation.plotId,
            sceneId: relation.sceneId,
            note,
            updatedAt: new Date(),
            version: sql`${plotScenes.version} + 1`,
          })
          .where(eq(plotScenes.id, original.id))
          .returning();
        if (!updated) throw new Error('Unable to update plot-scene relation.');
        const logUserId = await getUserIdForOperation(db, serverService, updated.storyId, userId);
        await recordLocalOperation(
          db,
          updated.storyId,
          logUserId,
          'update',
          'PlotScene',
          updated.id,
          getChangedFields(original, updated),
        );
        entityEventEmitter.emit('plot_scene_changed', updated.storyId, updated.id);
        return updated;
      }
      const now = new Date();
      const insert: PlotSceneInsert = {
        ...relation,
        id: relation.id ?? createULID(),
        note,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      const [created] = await db.insert(plotScenes).values(insert).returning();
      if (!created) throw new Error('Unable to create plot-scene relation.');
      const logUserId = await getUserIdForOperation(db, serverService, created.storyId, userId);
      await recordLocalOperation(
        db,
        created.storyId,
        logUserId,
        'create',
        'PlotScene',
        created.id,
        created,
      );
      entityEventEmitter.emit('plot_scene_changed', created.storyId, created.id);
      return created;
    },
    async delete(userId: string, id: string): Promise<void> {
      const original = await db.query.plotScenes.findFirst({ where: eq(plotScenes.id, id) });
      if (!original || original.isDeleted) return;
      await assertStoryIsWritable(db, original.storyId);
      const [deleted] = await db
        .update(plotScenes)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${plotScenes.version} + 1`,
        })
        .where(eq(plotScenes.id, id))
        .returning();
      if (!deleted) return;
      const logUserId = await getUserIdForOperation(db, serverService, deleted.storyId, userId);
      await recordLocalOperation(db, deleted.storyId, logUserId, 'delete', 'PlotScene', id, {
        id,
        isDeleted: true,
        version: deleted.version,
      });
      entityEventEmitter.emit('plot_scene_changed', deleted.storyId, id);
    },
  };
};
