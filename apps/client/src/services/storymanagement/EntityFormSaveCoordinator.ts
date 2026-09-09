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
 *
 * Partial-write policy (intentional, not a transaction):
 * - The base entity may exist while secondary data (tags, notes, relations, attributes) is still
 *   incomplete. Identity is retained via `onEntityPersisted` so a retry updates instead of duplicating.
 * - In-session recovery: pending secondary queues remain in memory; a later save finishes only what
 *   is left. Callers must keep draft preservation enabled for creation forms.
 * - Cross-session recovery: in-memory drafts are lost if the app exits. The base row stays in the
 *   local database; reopening the entity hydrates persisted fields and the user can complete the rest.
 * - Do not show success, emit completion events, or navigate away until `persistSecondaryData` resolves.
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
