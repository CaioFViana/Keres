import { FavoriteEntityType } from '@keres/shared';
import { AppDrizzleClient } from '../../db';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { createFavoriteService } from './FavoriteService';

export async function normalizeFavoriteUpdate<T extends { isFavorite?: boolean }>(
  db: AppDrizzleClient,
  storyId: string,
  entityId: string,
  entityType: FavoriteEntityType,
  localUserId: string,
  changes: T,
): Promise<T> {
  if (changes.isFavorite === undefined) return changes;
  const service = createFavoriteService(db);
  if ((await service.getBehavior(storyId)) === 'global') return changes;
  await service.setFavorite(storyId, entityId, entityType, localUserId, changes.isFavorite);
  const normalized = { ...changes };
  delete normalized.isFavorite;
  return normalized;
}

export async function normalizeFavoriteCreate<T extends { isFavorite?: boolean }>(
  db: AppDrizzleClient,
  storyId: string,
  entityType: FavoriteEntityType,
  data: T,
): Promise<{ data: T; individualFavorite: boolean | undefined }> {
  const service = createFavoriteService(db);
  if ((await service.getBehavior(storyId)) === 'global') {
    return { data, individualFavorite: undefined };
  }
  return {
    data: { ...data, isFavorite: false },
    individualFavorite: data.isFavorite ?? false,
  };
}

export async function persistInitialFavorite(
  db: AppDrizzleClient,
  storyId: string,
  entityId: string,
  entityType: FavoriteEntityType,
  localUserId: string,
  individualFavorite: boolean | undefined,
): Promise<void> {
  if (individualFavorite) {
    await createFavoriteService(db).setFavorite(storyId, entityId, entityType, localUserId, true);
  }
}

export async function decorateFavorite<
  T extends { id: string; storyId: string; isFavorite: boolean },
>(
  db: AppDrizzleClient,
  entityType: FavoriteEntityType,
  entity: T | undefined,
): Promise<T | undefined> {
  const localUserId = useUserSettingsStore.getState().userId;
  if (!entity || !localUserId) return entity;
  const [decorated] = await createFavoriteService(db).decorateEntities(
    entity.storyId,
    entityType,
    localUserId,
    [entity],
  );
  return decorated;
}
