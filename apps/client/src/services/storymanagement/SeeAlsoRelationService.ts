import type { SeeAlsoEntityType } from '@keres/shared';
import { isSameEntity, SELF_LINK_ERROR, sortEntityPair } from '@keres/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient, SeeAlsoRelationSelect } from '../../db';
import { seeAlsoRelations } from '../../db';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface SeeAlsoEntityRef {
  entityType: SeeAlsoEntityType;
  entityId: string;
}

/** Canonical ordering (A/B), the same one the server uses - see SeeAlsoRelationSyncHandler.ts (API). */
/**
 * The pair's canonical ordering, delegated to `@keres/shared`: it is the same one the server uses on
 * receiving the synchronization. Here it only translates this layer's field names.
 */
function sortEntityRefs(
  a: SeeAlsoEntityRef,
  b: SeeAlsoEntityRef,
): [SeeAlsoEntityRef, SeeAlsoEntityRef] {
  const [first] = sortEntityPair(
    { type: a.entityType, id: a.entityId },
    { type: b.entityType, id: b.entityId },
  );
  return first.id === a.entityId && first.type === a.entityType ? [a, b] : [b, a];
}

export interface SeeAlsoRelationService {
  getRelationsForEntity(
    storyId: string,
    entityType: SeeAlsoEntityType,
    entityId: string,
  ): Promise<SeeAlsoRelationSelect[]>;
  addSeeAlsoLink(
    currentUserId: string,
    storyId: string,
    a: SeeAlsoEntityRef,
    b: SeeAlsoEntityRef,
  ): Promise<SeeAlsoRelationSelect>;
  removeSeeAlsoLink(currentUserId: string, relationId: string): Promise<boolean>;
  /** Reconciles `entity`'s current set of links to exactly `targets` (an add/remove diff). */
  setSeeAlsoTargets(
    currentUserId: string,
    storyId: string,
    entityType: SeeAlsoEntityType,
    entityId: string,
    targets: SeeAlsoEntityRef[],
  ): Promise<void>;
}

export const createSeeAlsoRelationService = (db: AppDrizzleClient): SeeAlsoRelationService => {
  const serverService = createServerService(db);

  const findExistingPair = async (
    storyId: string,
    a: SeeAlsoEntityRef,
    b: SeeAlsoEntityRef,
    excludeId?: string,
  ): Promise<SeeAlsoRelationSelect | undefined> => {
    const candidate = await db.query.seeAlsoRelations.findFirst({
      where: and(
        eq(seeAlsoRelations.storyId, storyId),
        eq(seeAlsoRelations.isDeleted, false),
        or(
          and(
            eq(seeAlsoRelations.entityAType, a.entityType),
            eq(seeAlsoRelations.entityAId, a.entityId),
            eq(seeAlsoRelations.entityBType, b.entityType),
            eq(seeAlsoRelations.entityBId, b.entityId),
          ),
          and(
            eq(seeAlsoRelations.entityAType, b.entityType),
            eq(seeAlsoRelations.entityAId, b.entityId),
            eq(seeAlsoRelations.entityBType, a.entityType),
            eq(seeAlsoRelations.entityBId, a.entityId),
          ),
        ),
      ),
    });
    if (candidate && candidate.id !== excludeId) {
      return candidate;
    }
    return undefined;
  };

  /** The row a new link would insert, or the live link the pair already has. */
  const planLink = async (
    storyId: string,
    a: SeeAlsoEntityRef,
    b: SeeAlsoEntityRef,
  ): Promise<{ existing: SeeAlsoRelationSelect } | { row: SeeAlsoRelationSelect }> => {
    if (
      isSameEntity({ type: a.entityType, id: a.entityId }, { type: b.entityType, id: b.entityId })
    ) {
      throw new Error(SELF_LINK_ERROR);
    }

    const [entityA, entityB] = sortEntityRefs(a, b);
    const existing = await findExistingPair(storyId, entityA, entityB);
    if (existing) {
      return { existing };
    }

    const now = new Date();
    return {
      row: {
        id: createULID(),
        storyId,
        entityAType: entityA.entityType,
        entityAId: entityA.entityId,
        entityBType: entityB.entityType,
        entityBId: entityB.entityId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      },
    };
  };

  /** Inside a unit. */
  const insertLink = (row: SeeAlsoRelationSelect, userIdToLog: string) => {
    db.insert(seeAlsoRelations).values(row).run();
    recordLocalOperationSync(
      db,
      row.storyId,
      userIdToLog,
      'create',
      'SeeAlsoRelation',
      row.id,
      row,
    );
  };

  /** Inside a unit. */
  const removeLink = (relation: SeeAlsoRelationSelect, userIdToLog: string) => {
    const removed = db
      .update(seeAlsoRelations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${seeAlsoRelations.version} + 1`,
      })
      .where(eq(seeAlsoRelations.id, relation.id))
      .returning({ id: seeAlsoRelations.id, version: seeAlsoRelations.version })
      .get();

    if (!removed) {
      throw new Error(`Failed to delete SeeAlsoRelation ${relation.id}.`);
    }
    recordLocalOperationSync(
      db,
      relation.storyId,
      userIdToLog,
      'delete',
      'SeeAlsoRelation',
      relation.id,
      {
        id: relation.id,
        isDeleted: true,
        version: removed.version,
      },
    );
  };

  // Both sides may have their detail screen mounted - notify both.
  const emitLinkChanged = (link: SeeAlsoRelationSelect) => {
    entityEventEmitter.emit('see_also_relation_changed', link.storyId, link.entityAId);
    entityEventEmitter.emit('see_also_relation_changed', link.storyId, link.entityBId);
  };

  return {
    async getRelationsForEntity(storyId, entityType, entityId) {
      return db
        .select()
        .from(seeAlsoRelations)
        .where(
          and(
            eq(seeAlsoRelations.storyId, storyId),
            eq(seeAlsoRelations.isDeleted, false),
            or(
              and(
                eq(seeAlsoRelations.entityAType, entityType),
                eq(seeAlsoRelations.entityAId, entityId),
              ),
              and(
                eq(seeAlsoRelations.entityBType, entityType),
                eq(seeAlsoRelations.entityBId, entityId),
              ),
            ),
          ),
        )
        .all();
    },

    async addSeeAlsoLink(currentUserId, storyId, a, b) {
      await assertStoryIsWritable(db, storyId);
      const planned = await planLink(storyId, a, b);
      if ('existing' in planned) {
        return planned.existing;
      }
      const inserted = planned.row;

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await runLocalWrite(db, storyId, () => insertLink(inserted, userIdToLog));
      emitLinkChanged(inserted);

      return inserted;
    },

    async removeSeeAlsoLink(currentUserId, relationId) {
      const relation = await db.query.seeAlsoRelations.findFirst({
        where: eq(seeAlsoRelations.id, relationId),
      });
      if (!relation || relation.isDeleted) {
        return false;
      }
      await assertStoryIsWritable(db, relation.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        relation.storyId,
        currentUserId,
      );
      await runLocalWrite(db, relation.storyId, () => removeLink(relation, userIdToLog));
      emitLinkChanged(relation);
      return true;
    },

    async setSeeAlsoTargets(currentUserId, storyId, entityType, entityId, targets) {
      const current = await this.getRelationsForEntity(storyId, entityType, entityId);
      const currentByKey = new Map(
        current.map((relation) => {
          const other: SeeAlsoEntityRef =
            relation.entityAType === entityType && relation.entityAId === entityId
              ? {
                  entityType: relation.entityBType as SeeAlsoEntityType,
                  entityId: relation.entityBId,
                }
              : {
                  entityType: relation.entityAType as SeeAlsoEntityType,
                  entityId: relation.entityAId,
                };
          return [`${other.entityType}:${other.entityId}`, relation];
        }),
      );

      const desiredKeys = new Set(
        targets.map((target) => `${target.entityType}:${target.entityId}`),
      );
      const addKeys = new Set<string>();
      const toAdd = targets.filter((target) => {
        const key = `${target.entityType}:${target.entityId}`;
        if (currentByKey.has(key) || addKeys.has(key)) return false;
        addKeys.add(key);
        return true;
      });
      const toRemove = [...currentByKey]
        .filter(([key]) => !desiredKeys.has(key))
        .map(([, relation]) => relation);
      if (toAdd.length === 0 && toRemove.length === 0) {
        return;
      }

      await assertStoryIsWritable(db, storyId);
      const rows: SeeAlsoRelationSelect[] = [];
      for (const target of toAdd) {
        const planned = await planLink(storyId, { entityType, entityId }, target);
        if ('row' in planned) rows.push(planned.row);
      }
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      // One save of the list is one change: every add and removal lands (and syncs) together.
      await runLocalWrite(db, storyId, () => {
        for (const row of rows) insertLink(row, userIdToLog);
        for (const relation of toRemove) removeLink(relation, userIdToLog);
      });
      for (const link of [...rows, ...toRemove]) emitLinkChanged(link);
    },
  };
};
