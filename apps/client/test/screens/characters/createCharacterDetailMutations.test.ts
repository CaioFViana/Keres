import { AppAlert } from '@/src/state/ui/AppAlert';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { createCharacterDetailMutations } from '@/src/screens/characters/createCharacterDetailMutations';

jest.mock('@/src/state/ui/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: jest.fn() },
}));
jest.mock('@/src/state/events/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { emit: jest.fn() },
}));

const relation = { id: 'relation-1' } as any;
const characterScene = { id: 'scene-relation-1' } as any;

describe('createCharacterDetailMutations', () => {
  let relationService: any;
  let characterSceneService: any;

  const createMutations = (overrides: Record<string, unknown> = {}) =>
    createCharacterDetailMutations({
      relationService,
      characterSceneService,
      character: { storyId: 'story-1' },
      userId: 'user-1',
      t: ((key: string) => key) as never,
      characterId: 'character-1',
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    relationService = {
      saveCharacterRelation: jest.fn(async (_userId, value) => value),
      deleteCharacterRelation: jest.fn(async () => true),
    };
    characterSceneService = {
      saveCharacterScene: jest.fn(async (_userId, value) => value),
      deleteCharacterScene: jest.fn(async () => true),
    };
  });

  it('reports unavailable dependencies for every mutation', async () => {
    const mutations = createMutations({ userId: null });

    await mutations.handleSaveRelation(relation);
    await mutations.handleDeleteRelation(relation.id);
    await mutations.handleSaveCharacterScene(characterScene);
    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(AppAlert.alert).toHaveBeenCalledTimes(4);
    expect(AppAlert.alert).toHaveBeenLastCalledWith('error', 'service_not_initialized');
    expect(relationService.saveCharacterRelation).not.toHaveBeenCalled();
    expect(characterSceneService.saveCharacterScene).not.toHaveBeenCalled();
    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('reports a missing story the same way', async () => {
    const mutations = createMutations({ character: null });

    await mutations.handleSaveRelation(relation);

    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'service_not_initialized');
    expect(relationService.saveCharacterRelation).not.toHaveBeenCalled();
  });

  it('saves a relation and announces the change so the list reloads', async () => {
    const mutations = createMutations();

    await mutations.handleSaveRelation(relation);

    expect(relationService.saveCharacterRelation).toHaveBeenCalledWith('user-1', relation);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith(
      'character_relation_changed',
      'story-1',
      'character-1',
    );
    expect(AppAlert.alert).toHaveBeenLastCalledWith('success', 'relation_saved_successfully');
  });

  it('announces a relation deletion only when it succeeds', async () => {
    const mutations = createMutations();

    await mutations.handleDeleteRelation(relation.id);
    relationService.deleteCharacterRelation.mockResolvedValueOnce(false);
    await mutations.handleDeleteRelation('missing-relation');

    expect(relationService.deleteCharacterRelation).toHaveBeenCalledWith('user-1', relation.id);
    expect(entityEventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(AppAlert.alert).toHaveBeenLastCalledWith('error', 'failed_to_delete_relation');
  });

  it('reports a failed relation deletion without announcing a change', async () => {
    relationService.deleteCharacterRelation.mockRejectedValue(new Error('offline'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleDeleteRelation(relation.id);

    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_delete_relation');
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete character relation:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('saves and removes character-scene relations', async () => {
    const mutations = createMutations();

    await mutations.handleSaveCharacterScene(characterScene);
    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(characterSceneService.saveCharacterScene).toHaveBeenCalledWith('user-1', characterScene);
    expect(characterSceneService.deleteCharacterScene).toHaveBeenCalledWith(
      'user-1',
      characterScene.id,
    );
    expect(entityEventEmitter.emit).toHaveBeenCalledWith(
      'character_scene_changed',
      'story-1',
      'character-1',
    );
    expect(entityEventEmitter.emit).toHaveBeenCalledTimes(2);
    expect(AppAlert.alert).toHaveBeenLastCalledWith(
      'success',
      'character_scene_deleted_successfully',
    );
  });

  it('announces nothing when a character-scene deletion is declined', async () => {
    characterSceneService.deleteCharacterScene.mockResolvedValue(false);
    const mutations = createMutations();

    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_delete_character_scene');
  });

  it('confirms a saved character-scene relation', async () => {
    const mutations = createMutations();

    await mutations.handleSaveCharacterScene({ ...characterScene, isPresent: true });

    expect(characterSceneService.saveCharacterScene).toHaveBeenCalledWith('user-1', {
      id: 'scene-relation-1',
      isPresent: true,
    });
    expect(AppAlert.alert).toHaveBeenLastCalledWith(
      'success',
      'character_scene_saved_successfully',
    );
  });

  it('reports a character-scene deletion failure without announcing a change', async () => {
    characterSceneService.deleteCharacterScene.mockRejectedValue(new Error('offline'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_delete_character_scene');
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete character scene:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('reports save failures without announcing a change', async () => {
    const failure = new Error('offline');
    relationService.saveCharacterRelation.mockRejectedValue(failure);
    characterSceneService.saveCharacterScene.mockRejectedValue(failure);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleSaveRelation(relation);
    await mutations.handleSaveCharacterScene(characterScene);

    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_save_relation');
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_save_character_scene');
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
