import type { Scene } from '@keres/shared';
import type { SceneService } from './SceneService';
import { saveEntityWithSecondaryData } from './EntityFormSaveCoordinator';

// `body` is deliberately excluded: the manuscript is owned by the scene Editor, and a form save
// must never touch (let alone null out) prose it cannot see.
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
  | 'body'
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
  persistSecondaryDraft,
  clearSecondaryDraft,
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
  persistSecondaryDraft?: (sceneId: string) => Promise<void>;
  clearSecondaryDraft?: (sceneId: string) => Promise<void>;
}): Promise<{ sceneId: string; created: boolean }> {
  const result = await saveEntityWithSecondaryData({
    currentEntityId: currentSceneId,
    createEntity: () => sceneService.createScene(userId, { ...sceneData, storyId }),
    updateEntity: async (sceneId) => {
      const originalScene = await sceneService.getById(sceneId);
      if (!originalScene) throw new Error(notFoundMessage);
      return sceneService.updateScene(userId, sceneId, sceneData);
    },
    onEntityPersisted: onScenePersisted,
    persistSecondaryDraft,
    clearSecondaryDraft,
    persistSecondaryData: async (sceneId) => {
      await persistRelations(sceneId);
      await persistCustomAttributes(sceneId);
    },
  });

  return { sceneId: result.entityId, created: result.created };
}
