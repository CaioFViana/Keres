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
  onScenePersisted,
  persistRelations,
  persistCustomAttributes,
}: {
  sceneService: Pick<SceneService, 'getById' | 'createScene' | 'updateScene'>;
  userId: string;
  storyId: string;
  currentSceneId?: string;
  sceneData: SceneFormData;
  notFoundMessage: string;
  onScenePersisted: (sceneId: string) => void;
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

  // Retain the persisted identity before secondary writes. If one of them fails, the caller can
  // retry as an update of this row instead of creating a duplicate scene.
  onScenePersisted(sceneId);
  await persistRelations(sceneId);
  await persistCustomAttributes(sceneId);

  return { sceneId, created };
}
