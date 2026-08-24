import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  LocationRelation,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, or } from 'drizzle-orm';
import type { AppDrizzleClient, LocationRelationSelect } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/** Para 'connected_to' (par não-ordenado): encontra uma relação ativa entre as duas Locations,
 *  em qualquer ordem de armazenamento. Para 'contains' (pai único), use `getExistingParentEdge`. */
const getExistingConnection = async (
  db: AppDrizzleClient,
  storyId: string,
  locationAId: string,
  locationBId: string,
  excludeRelationId?: string,
): Promise<LocationRelationSelect | undefined> => {
  const candidate = await db.query.locationRelations.findFirst({
    where: and(
      eq(schema.locationRelations.storyId, storyId),
      eq(schema.locationRelations.relationType, 'connected_to'),
      eq(schema.locationRelations.isDeleted, false),
      or(
        and(
          eq(schema.locationRelations.locationAId, locationAId),
          eq(schema.locationRelations.locationBId, locationBId),
        ),
        and(
          eq(schema.locationRelations.locationAId, locationBId),
          eq(schema.locationRelations.locationBId, locationAId),
        ),
      ),
    ),
  });
  if (candidate && candidate.id !== excludeRelationId) {
    return candidate;
  }
  return undefined;
};

/** Para 'contains': o filho (locationBId) só pode ter um pai vivo por vez. */
const getExistingParentEdge = async (
  db: AppDrizzleClient,
  storyId: string,
  childId: string,
  excludeRelationId?: string,
): Promise<LocationRelationSelect | undefined> => {
  const candidate = await db.query.locationRelations.findFirst({
    where: and(
      eq(schema.locationRelations.storyId, storyId),
      eq(schema.locationRelations.locationBId, childId),
      eq(schema.locationRelations.relationType, 'contains'),
      eq(schema.locationRelations.isDeleted, false),
    ),
  });
  if (candidate && candidate.id !== excludeRelationId) {
    return candidate;
  }
  return undefined;
};

export class LocationRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'LocationRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('LocationRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  /** Resolve conflito de duplicidade (par 'connected_to' ou pai único 'contains'): quem tem o
   *  `updatedAt` mais novo vence, o outro é soft-deletado. Retorna `true` se a operação
   *  recebida deve ser descartada (perdeu para uma linha local mais nova). */
  private async resolveDuplicate(
    existing: LocationRelationSelect,
    incomingUpdatedAt: Date,
  ): Promise<boolean> {
    if (incomingUpdatedAt > existing.updatedAt) {
      await this.db
        .update(schema.locationRelations)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(eq(schema.locationRelations.id, existing.id));
      return false;
    }
    return true;
  }

  private async findConflict(
    storyId: string,
    relationType: string,
    locationAId: string,
    locationBId: string,
    excludeRelationId?: string,
  ): Promise<LocationRelationSelect | undefined> {
    if (relationType === 'contains') {
      return getExistingParentEdge(this.db, storyId, locationBId, excludeRelationId);
    }
    return getExistingConnection(this.db, storyId, locationAId, locationBId, excludeRelationId);
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const relationData = update.data as LocationRelation;

    const conflict = await this.findConflict(
      storyId,
      relationData.relationType,
      relationData.locationAId,
      relationData.locationBId,
    );
    if (conflict) {
      const incomingUpdatedAt = relationData.updatedAt
        ? new Date(relationData.updatedAt)
        : new Date();
      const shouldDiscard = await this.resolveDuplicate(conflict, incomingUpdatedAt);
      if (shouldDiscard) {
        console.log(
          `Sync conflict (create): Existing LocationRelation ${conflict.id} wins over incoming ${update.id}. Discarding.`,
        );
        return;
      }
    }

    await this.db.insert(schema.locationRelations).values({
      ...relationData,
      id: update.id,
      storyId,
      createdAt: new Date(relationData.createdAt),
      updatedAt: new Date(relationData.updatedAt),
      deletedAt: relationData.deletedAt ? new Date(relationData.deletedAt) : null,
    });
    console.log(`Applied create for LocationRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const localRelation = await this.db.query.locationRelations.findFirst({
      where: eq(schema.locationRelations.id, update.id),
    });

    if (!localRelation) {
      console.warn(`LocationRelation ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<LocationRelation>;
    const effectiveRelationType = changes.relationType || localRelation.relationType;
    const effectiveLocationAId = changes.locationAId || localRelation.locationAId;
    const effectiveLocationBId = changes.locationBId || localRelation.locationBId;

    const conflict = await this.findConflict(
      storyId,
      effectiveRelationType,
      effectiveLocationAId,
      effectiveLocationBId,
      update.id,
    );
    if (conflict) {
      const incomingUpdatedAt = changes.updatedAt ? new Date(changes.updatedAt) : new Date();
      const shouldDiscard = await this.resolveDuplicate(conflict, incomingUpdatedAt);
      if (shouldDiscard) {
        console.warn(
          `Sync conflict (update): Existing LocationRelation ${conflict.id} wins over incoming ${update.id}. Discarding.`,
        );
        return;
      }
    }

    await this.db
      .update(schema.locationRelations)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.locationRelations.id, update.id));
    console.log(`Applied update for LocationRelation ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.locationRelations)
      .set({
        storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.locationRelations.id, update.id));
    console.log(`Applied delete for LocationRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<LocationRelation | undefined> {
    const relation = await this.db.query.locationRelations.findFirst({
      where: eq(schema.locationRelations.id, id),
    });
    return relation as LocationRelation | undefined;
  }
}
