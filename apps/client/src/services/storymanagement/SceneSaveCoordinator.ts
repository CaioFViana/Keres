import type { Scene } from '@keres/shared';
import type { SceneService } from './SceneService';

export type SceneFormData = Omit<
  Scene,
  | 'id'
  | 'storyId'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
  | 'isDeleted'
  | 'deletedAt'
  | 'index'
>;

type SceneRelationsPersistence = (sceneId: string) => Promise<void>;

export async function saveSceneWithRelations({
  sceneService,
  userId,
  storyId,
  currentSceneId,
  sceneData,
  notFoundMessage,
  persistRelations,
  persistCustomAttributes,
}: {
  sceneService: Pick<SceneService, 'getById' | 'createScene' | 'updateScene'>;
  userId: string;
  storyId: string;
  currentSceneId?: string;
  sceneData: SceneFormData;
  notFoundMessage: string;
  persistRelations: SceneRelationsPersistence;
  persistCustomAttributes: SceneRelationsPersistence;
}): Promise<{ sceneId: string; created: boolean }> {
  const created = !currentSceneId;
  let sceneId: string;

  if (currentSceneId) {
    const originalScene = await sceneService.getById(currentSceneId);
    if (!originalScene) {
      throw new Error(notFoundMessage);
    }
    sceneId = (await sceneService.updateScene(userId, currentSceneId, sceneData)).id;
  } else {
    sceneId = (await sceneService.createScene(userId, { ...sceneData, storyId })).id;
  }

  await persistRelations(sceneId);
  await persistCustomAttributes(sceneId);

  return { sceneId, created };
}
