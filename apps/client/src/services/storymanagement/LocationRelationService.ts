import { createULID } from '../../utils/entityUtils';
import { and, eq, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient, LocationRelationSelect } from '../../db';
import { locationRelations } from '../../db';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** Mesmo limite defensivo do handler no servidor - ver LocationRelationSyncHandler.ts (API). */
const MAX_ANCESTOR_WALK = 500;

export interface LocationRelationService {
  getParentRelation(
    storyId: string,
    locationId: string,
  ): Promise<LocationRelationSelect | undefined>;
  getChildRelations(storyId: string, locationId: string): Promise<LocationRelationSelect[]>;
  getConnectionRelations(storyId: string, locationId: string): Promise<LocationRelationSelect[]>;
  /** Ancestrais de `locationId` (não inclui ele mesmo). Não-autoritativo: só reflete o que o
   *  dispositivo já sincronizou, usado para excluir candidatos inválidos no picker de "Parent". */
  getAncestorIds(storyId: string, locationId: string): Promise<Set<string>>;
  /** Descendentes de `locationId` (não inclui ele mesmo), usado para excluir candidatos
   *  inválidos no picker de "Child Location" (não pode virar filho do próprio descendente). */
  getDescendantIds(storyId: string, locationId: string): Promise<Set<string>>;
  /** null para remover o pai atual. Faz a "troca" como duas operações: apaga a aresta antiga
   *  (se houver) e cria a nova. Checagem de ciclo aqui é só para feedback rápido de UI - a
   *  validação real (autoritativa) acontece no servidor, ver LocationRelationSyncHandler. */
  setParent(
    currentUserId: string,
    storyId: string,
    childId: string,
    newParentId: string | null,
  ): Promise<void>;
  addConnection(
    currentUserId: string,
    storyId: string,
    locationAId: string,
    locationBId: string,
  ): Promise<LocationRelationSelect>;
  removeRelation(currentUserId: string, relationId: string): Promise<boolean>;
  getAllRelationsForStory(storyId: string): Promise<LocationRelationSelect[]>;
}

const walkAncestorIds = async (
  db: AppDrizzleClient,
  storyId: string,
  locationId: string,
): Promise<Set<string>> => {
  const ancestors = new Set<string>();
  let currentId: string | undefined = locationId;
  let steps = 0;

  while (currentId && ++steps <= MAX_ANCESTOR_WALK) {
    const parentEdge: { locationAId: string } | undefined =
      await db.query.locationRelations.findFirst({
        where: and(
          eq(locationRelations.storyId, storyId),
          eq(locationRelations.locationBId, currentId),
          eq(locationRelations.relationType, 'contains'),
          eq(locationRelations.isDeleted, false),
        ),
      });
    if (!parentEdge || ancestors.has(parentEdge.locationAId)) break;
    ancestors.add(parentEdge.locationAId);
    currentId = parentEdge.locationAId;
  }

  return ancestors;
};

const getExistingConnection = async (
  db: AppDrizzleClient,
  storyId: string,
  locationAId: string,
  locationBId: string,
  excludeRelationId?: string,
): Promise<LocationRelationSelect | undefined> => {
  const conditions = [
    eq(locationRelations.storyId, storyId),
    eq(locationRelations.relationType, 'connected_to' as const),
    eq(locationRelations.isDeleted, false),
    or(
      and(
        eq(locationRelations.locationAId, locationAId),
        eq(locationRelations.locationBId, locationBId),
      ),
      and(
        eq(locationRelations.locationAId, locationBId),
        eq(locationRelations.locationBId, locationAId),
      ),
    ),
  ];
  if (excludeRelationId) {
    conditions.push(sql`${locationRelations.id} != ${excludeRelationId}`);
  }
  return db.query.locationRelations.findFirst({ where: and(...conditions) });
};

export const createLocationRelationService = (db: AppDrizzleClient): LocationRelationService => {
  const serverService = createServerService(db);

  const softDeleteRelation = async (
    currentUserId: string,
    relation: LocationRelationSelect,
  ): Promise<void> => {
    const [updated] = await db
      .update(locationRelations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${locationRelations.version} + 1`,
      })
      .where(eq(locationRelations.id, relation.id))
      .returning({ id: locationRelations.id, version: locationRelations.version });

    if (!updated) {
      throw new Error(`Failed to delete location relation ${relation.id}.`);
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
      'LocationRelation',
      relation.id,
      {
        id: relation.id,
        isDeleted: true,
        version: updated.version,
      },
    );
  };

  return {
    async getParentRelation(storyId, locationId) {
      return db.query.locationRelations.findFirst({
        where: and(
          eq(locationRelations.storyId, storyId),
          eq(locationRelations.locationBId, locationId),
          eq(locationRelations.relationType, 'contains'),
          eq(locationRelations.isDeleted, false),
        ),
      });
    },

    async getChildRelations(storyId, locationId) {
      return db
        .select()
        .from(locationRelations)
        .where(
          and(
            eq(locationRelations.storyId, storyId),
            eq(locationRelations.locationAId, locationId),
            eq(locationRelations.relationType, 'contains'),
            eq(locationRelations.isDeleted, false),
          ),
        )
        .all();
    },

    async getConnectionRelations(storyId, locationId) {
      return db
        .select()
        .from(locationRelations)
        .where(
          and(
            eq(locationRelations.storyId, storyId),
            eq(locationRelations.relationType, 'connected_to'),
            eq(locationRelations.isDeleted, false),
            or(
              eq(locationRelations.locationAId, locationId),
              eq(locationRelations.locationBId, locationId),
            ),
          ),
        )
        .all();
    },

    async getAncestorIds(storyId, locationId) {
      return walkAncestorIds(db, storyId, locationId);
    },

    async getDescendantIds(storyId, locationId) {
      const descendants = new Set<string>();
      const queue: string[] = [locationId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = await db
          .select({ locationBId: locationRelations.locationBId })
          .from(locationRelations)
          .where(
            and(
              eq(locationRelations.storyId, storyId),
              eq(locationRelations.locationAId, current),
              eq(locationRelations.relationType, 'contains'),
              eq(locationRelations.isDeleted, false),
            ),
          )
          .all();

        for (const child of children) {
          if (!descendants.has(child.locationBId)) {
            descendants.add(child.locationBId);
            queue.push(child.locationBId);
          }
        }
      }

      return descendants;
    },

    async setParent(currentUserId, storyId, childId, newParentId) {
      if (newParentId === childId) {
        throw new Error('Validation Error: a Location cannot be its own parent.');
      }

      const existingParentEdge = await db.query.locationRelations.findFirst({
        where: and(
          eq(locationRelations.storyId, storyId),
          eq(locationRelations.locationBId, childId),
          eq(locationRelations.relationType, 'contains'),
          eq(locationRelations.isDeleted, false),
        ),
      });

      if (newParentId === null) {
        if (existingParentEdge) {
          await softDeleteRelation(currentUserId, existingParentEdge);
          entityEventEmitter.emit('location_relation_changed', storyId, childId);
        }
        return;
      }

      // Checagem de ciclo não-autoritativa (só para feedback rápido de UI, ver docstring da interface).
      const ancestorsOfNewParent = await walkAncestorIds(db, storyId, newParentId);
      if (ancestorsOfNewParent.has(childId)) {
        throw new Error(
          'Validation Error: setting this parent would create a cycle in the Location hierarchy.',
        );
      }

      if (existingParentEdge) {
        await softDeleteRelation(currentUserId, existingParentEdge);
      }

      const newRelationData = {
        id: createULID(),
        storyId,
        locationAId: newParentId,
        locationBId: childId,
        relationType: 'contains' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      const [inserted] = await db.insert(locationRelations).values(newRelationData).returning();
      if (!inserted) {
        throw new Error('Failed to create parent relation.');
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(
        db,
        storyId,
        userIdToLog,
        'create',
        'LocationRelation',
        inserted.id,
        { ...inserted },
      );
      entityEventEmitter.emit('location_relation_changed', storyId, childId);
    },

    async addConnection(currentUserId, storyId, locationAId, locationBId) {
      if (locationAId === locationBId) {
        throw new Error('Validation Error: a Location cannot be connected to itself.');
      }

      const existing = await getExistingConnection(db, storyId, locationAId, locationBId);
      if (existing) {
        throw new Error(`Conflict: a connection between these Locations already exists.`);
      }

      const newRelationData = {
        id: createULID(),
        storyId,
        locationAId,
        locationBId,
        relationType: 'connected_to' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      const [inserted] = await db.insert(locationRelations).values(newRelationData).returning();
      if (!inserted) {
        throw new Error('Failed to create connection.');
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(
        db,
        storyId,
        userIdToLog,
        'create',
        'LocationRelation',
        inserted.id,
        { ...inserted },
      );
      entityEventEmitter.emit('location_relation_changed', storyId, locationAId);

      return inserted;
    },

    async removeRelation(currentUserId, relationId) {
      const relation = await db.query.locationRelations.findFirst({
        where: eq(locationRelations.id, relationId),
      });
      if (!relation || relation.isDeleted) {
        return false;
      }

      await softDeleteRelation(currentUserId, relation);
      entityEventEmitter.emit('location_relation_changed', relation.storyId, relation.locationAId);
      return true;
    },

    async getAllRelationsForStory(storyId) {
      return db
        .select()
        .from(locationRelations)
        .where(and(eq(locationRelations.storyId, storyId), eq(locationRelations.isDeleted, false)))
        .all();
    },
  };
};
