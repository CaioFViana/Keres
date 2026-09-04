import { and, asc, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StoryArcInsert, StoryArcSelect } from '../../db/schema';
import { chapters, storyArcs } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface StoryArcService {
  getArcsForStory(storyId: string): Promise<StoryArcSelect[]>;
  getById(arcId: string): Promise<StoryArcSelect | undefined>;
  getDefault(storyId: string): Promise<StoryArcSelect | undefined>;
  ensureDefaultArc(currentUserId: string, storyId: string): Promise<StoryArcSelect>;
  createArc(currentUserId: string, data: Create<StoryArcInsert>): Promise<StoryArcSelect>;
  updateArc(
    currentUserId: string,
    arcId: string,
    changes: Partial<
      Pick<
        StoryArcInsert,
        'title' | 'description' | 'sortOrder' | 'color' | 'icon' | 'themeOverride'
      >
    >,
  ): Promise<StoryArcSelect>;
  deleteArc(currentUserId: string, arcId: string): Promise<void>;
}

export const createStoryArcService = (db: AppDrizzleClient): StoryArcService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(storyArcs.storyId, storyId), eq(storyArcs.isDeleted, false));

  const logOperation = async (
    currentUserId: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    arcId: string,
    payload: Record<string, unknown>,
  ) => {
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await recordLocalOperation(db, storyId, userIdToLog, type, 'StoryArc', arcId, payload);
    entityEventEmitter.emit('story_arc_changed', storyId, arcId);
  };

  const service: StoryArcService = {
    async getArcsForStory(storyId) {
      return db
        .select()
        .from(storyArcs)
        .where(liveInStory(storyId))
        .orderBy(asc(storyArcs.sortOrder), asc(storyArcs.createdAt))
        .all();
    },

    async getById(arcId) {
      return db.query.storyArcs.findFirst({ where: eq(storyArcs.id, arcId) });
    },

    async getDefault(storyId) {
      const arcs = await service.getArcsForStory(storyId);
      return arcs.find((arc) => arc.isDefault) ?? arcs[0];
    },

    async ensureDefaultArc(currentUserId, storyId) {
      const existing = await service.getDefault(storyId);
      if (existing) return existing;
      return service.createArc(currentUserId, {
        storyId,
        title: 'Arc',
        description: null,
        sortOrder: 0,
        color: null,
        icon: null,
        themeOverride: null,
        isDefault: true,
      });
    },

    async createArc(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const existing = await service.getArcsForStory(data.storyId);
      const row = prepareNewEntityData<StoryArcInsert>({
        ...data,
        sortOrder: existing.length,
        isDefault: existing.length === 0,
      });
      const result = await db.insert(storyArcs).values(row).returning().get();
      await logOperation(currentUserId, data.storyId, 'create', result.id, { ...result });
      return result;
    },

    async updateArc(currentUserId, arcId, changes) {
      const current = await service.getById(arcId);
      if (!current || current.isDeleted) throw new Error(`StoryArc ${arcId} not found.`);
      await assertStoryIsWritable(db, current.storyId);
      const next = { ...current, ...changes };
      const diff = getChangedFields(current, next);
      if (Object.keys(diff).length === 0) return current;
      const result = await db
        .update(storyArcs)
        .set({ ...diff, updatedAt: new Date(), version: current.version + 1 })
        .where(eq(storyArcs.id, arcId))
        .returning()
        .get();
      await logOperation(currentUserId, current.storyId, 'update', arcId, diff);
      return result;
    },

    async deleteArc(currentUserId, arcId) {
      const current = await service.getById(arcId);
      if (!current || current.isDeleted) return;
      await assertStoryIsWritable(db, current.storyId);
      if (current.isDefault) {
        throw new Error('The default arc cannot be deleted.');
      }
      const fallback = await service.getDefault(current.storyId);
      if (fallback && fallback.id !== arcId) {
        await db
          .update(chapters)
          .set({ arcId: fallback.id, updatedAt: new Date() })
          .where(and(eq(chapters.storyId, current.storyId), eq(chapters.arcId, arcId)));
      }
      await db
        .update(storyArcs)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(storyArcs.id, arcId));
      await logOperation(currentUserId, current.storyId, 'delete', arcId, {
        isDeleted: true,
        deletedAt: new Date(),
      });
    },
  };

  return service;
};
