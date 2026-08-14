import { SeeAlsoEntityType } from '@keres/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import { AppDrizzleClient, SeeAlsoRelationSelect, seeAlsoRelations } from '../../db';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface SeeAlsoEntityRef {
  entityType: SeeAlsoEntityType;
  entityId: string;
}

/** Ordenação canônica (A/B), mesma usada pelo servidor - ver SeeAlsoRelationSyncHandler.ts (API). */
function sortEntityRefs(
  a: SeeAlsoEntityRef,
  b: SeeAlsoEntityRef,
): [SeeAlsoEntityRef, SeeAlsoEntityRef] {
  return `${a.entityType}:${a.entityId}` <= `${b.entityType}:${b.entityId}` ? [a, b] : [b, a];
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
  /** Reconcilia o conjunto atual de vínculos de `entity` para exatamente `targets` (diff add/remove). */
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
      if (a.entityType === b.entityType && a.entityId === b.entityId) {
        throw new Error('Validation Error: an entity cannot be See-Also-linked to itself.');
      }

      const [entityA, entityB] = sortEntityRefs(a, b);
      const existing = await findExistingPair(storyId, entityA, entityB);
      if (existing) {
        return existing;
      }

      const now = new Date();
      const inserted = {
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
      };
      await db.insert(seeAlsoRelations).values(inserted).run();

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(
        db,
        storyId,
        userIdToLog,
        'create',
        'SeeAlsoRelation',
        inserted.id,
        inserted,
      );

      // Ambos os lados podem estar com a tela de detalhe montada - avisa os dois.
      entityEventEmitter.emit('see_also_relation_changed', storyId, entityA.entityId);
      entityEventEmitter.emit('see_also_relation_changed', storyId, entityB.entityId);

      return inserted;
    },

    async removeSeeAlsoLink(currentUserId, relationId) {
      const relation = await db.query.seeAlsoRelations.findFirst({
        where: eq(seeAlsoRelations.id, relationId),
      });
      if (!relation || relation.isDeleted) {
        return false;
      }

      const [removed] = await db
        .update(seeAlsoRelations)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${seeAlsoRelations.version} + 1`,
        })
        .where(eq(seeAlsoRelations.id, relationId))
        .returning({ id: seeAlsoRelations.id, version: seeAlsoRelations.version });

      if (!removed) {
        throw new Error(`Failed to delete SeeAlsoRelation ${relationId}.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        relation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        relation.storyId,
        userIdToLog,
        'delete',
        'SeeAlsoRelation',
        relationId,
        {
          id: relationId,
          isDeleted: true,
          version: removed.version,
        },
      );

      entityEventEmitter.emit('see_also_relation_changed', relation.storyId, relation.entityAId);
      entityEventEmitter.emit('see_also_relation_changed', relation.storyId, relation.entityBId);
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

      for (const target of targets) {
        const key = `${target.entityType}:${target.entityId}`;
        if (!currentByKey.has(key)) {
          await this.addSeeAlsoLink(currentUserId, storyId, { entityType, entityId }, target);
        }
      }

      for (const [key, relation] of currentByKey) {
        if (!desiredKeys.has(key)) {
          await this.removeSeeAlsoLink(currentUserId, relation.id);
        }
      }
    },
  };
};
