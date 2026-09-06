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
        persistRelations: async () => {
          throw new Error('relation failed');
        },
        persistCustomAttributes,
      }),
    ).rejects.toThrow('relation failed');

    expect(persistCustomAttributes).not.toHaveBeenCalled();
  });
});
