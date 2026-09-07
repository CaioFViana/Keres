export interface PersistedEntity {
  id: string;
}

interface SaveEntityWithSecondaryDataOptions<TEntity extends PersistedEntity> {
  currentEntityId?: string;
  createEntity(): Promise<TEntity>;
  updateEntity(entityId: string): Promise<unknown>;
  onEntityPersisted(entityId: string): void;
  persistSecondaryData(entityId: string): Promise<void>;
}

/**
 * Retains identity immediately after the base row exists, then completes every dependent write.
 * Callers must publish success and navigate only after this promise resolves.
 */
export async function saveEntityWithSecondaryData<TEntity extends PersistedEntity>({
  currentEntityId,
  createEntity,
  updateEntity,
  onEntityPersisted,
  persistSecondaryData,
}: SaveEntityWithSecondaryDataOptions<TEntity>): Promise<{
  entityId: string;
  created: boolean;
}> {
  const created = !currentEntityId;
  let entityId = currentEntityId;
  if (entityId) {
    await updateEntity(entityId);
  } else {
    entityId = (await createEntity()).id;
  }
  onEntityPersisted(entityId);
  await persistSecondaryData(entityId);
  return { entityId, created };
}
