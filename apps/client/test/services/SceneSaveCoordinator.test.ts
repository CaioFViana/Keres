import type { SceneService } from '../../src/services/storymanagement/SceneService';
import {
  saveSceneWithRelations,
  type SceneFormData,
} from '../../src/services/storymanagement/SceneSaveCoordinator';

const sceneData = { name: 'A chegada' } as SceneFormData;

const createSceneService = (): jest.Mocked<Pick<SceneService, 'getById' | 'createScene' | 'updateScene'>> =>
  ({
    getById: jest.fn(),
    createScene: jest.fn().mockResolvedValue({ id: 'scene-1' }),
    updateScene: jest.fn(),
  }) as jest.Mocked<Pick<SceneService, 'getById' | 'createScene' | 'updateScene'>>;

describe('saveSceneWithRelations', () => {
  it('only completes a new scene after its relations and attributes are persisted', async () => {
    const sceneService = createSceneService();
    const completed: string[] = [];

    const result = await saveSceneWithRelations({
      sceneService,
      userId: 'user-1',
      storyId: 'story-1',
      sceneData,
      notFoundMessage: 'not found',
      onScenePersisted: jest.fn(),
      persistRelations: async (sceneId) => {
        completed.push(`relations:${sceneId}`);
      },
      persistCustomAttributes: async (sceneId) => {
        completed.push(`attributes:${sceneId}`);
      },
    });

    expect(result).toEqual({ sceneId: 'scene-1', created: true });
    expect(completed).toEqual(['relations:scene-1', 'attributes:scene-1']);
  });

  it('rejects before completing when a relation cannot be persisted', async () => {
    const sceneService = createSceneService();
    const persistCustomAttributes = jest.fn();

    await expect(
      saveSceneWithRelations({
        sceneService,
        userId: 'user-1',
        storyId: 'story-1',
        sceneData,
        notFoundMessage: 'not found',
        onScenePersisted: jest.fn(),
        persistRelations: async () => {
          throw new Error('relation failed');
        },
        persistCustomAttributes,
      }),
    ).rejects.toThrow('relation failed');

    expect(persistCustomAttributes).not.toHaveBeenCalled();
  });

  it.each(['relations', 'attributes'] as const)(
    'retries a creation after a %s failure without creating another scene',
    async (failingStep) => {
      const sceneService = createSceneService();
      sceneService.getById.mockResolvedValue({ id: 'scene-1' } as never);
      sceneService.updateScene.mockResolvedValue({ id: 'scene-1' } as never);
      let retainedSceneId: string | undefined;
      let attempt = 0;
      const persistRelations = jest.fn(async () => {
        if (failingStep === 'relations' && attempt === 0) throw new Error('relations failed');
      });
      const persistCustomAttributes = jest.fn(async () => {
        if (failingStep === 'attributes' && attempt === 0) throw new Error('attributes failed');
      });
      const save = () =>
        saveSceneWithRelations({
          sceneService,
          userId: 'user-1',
          storyId: 'story-1',
          currentSceneId: retainedSceneId,
          sceneData,
          notFoundMessage: 'not found',
          onScenePersisted: (sceneId) => {
            retainedSceneId = sceneId;
          },
          persistRelations,
          persistCustomAttributes,
        });

      await expect(save()).rejects.toThrow(`${failingStep} failed`);
      expect(retainedSceneId).toBe('scene-1');
      attempt += 1;
      await expect(save()).resolves.toEqual({ sceneId: 'scene-1', created: false });

      expect(sceneService.createScene).toHaveBeenCalledTimes(1);
      expect(sceneService.updateScene).toHaveBeenCalledTimes(1);
    },
  );
});
