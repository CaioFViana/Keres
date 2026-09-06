jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: jest.fn() },
}));
jest.mock('../../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { emit: jest.fn() },
}));

import { AppAlert } from '../../../src/utils/AppAlert';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';
import { createCharacterDetailMutations } from '../../../src/screens/characters/createCharacterDetailMutations';

const relation = { id: 'relation-1' } as any;
const characterScene = { id: 'scene-relation-1' } as any;

describe('createCharacterDetailMutations', () => {
  let relations: any[];
  let characterScenes: any[];
  let setCharacterRelations: jest.Mock;
  let setCharacterSceneRelations: jest.Mock;
  let relationService: any;
  let characterSceneService: any;

  const createMutations = (overrides: Record<string, unknown> = {}) =>
    createCharacterDetailMutations({
      characterRelationServiceRef: { current: relationService },
      characterSceneServiceRef: { current: characterSceneService },
      character: { storyId: 'story-1' },
      userId: 'user-1',
      t: (key: string) => key,
      characterId: 'character-1',
      setCharacterRelations,
      setCharacterSceneRelations,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    relations = [];
    characterScenes = [];
    setCharacterRelations = jest.fn((updater) => {
      relations = updater(relations);
    });
    setCharacterSceneRelations = jest.fn((updater) => {
      characterScenes = updater(characterScenes);
    });
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
    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('adds and replaces character relations after saving', async () => {
    const mutations = createMutations();

    await mutations.handleSaveRelation(relation);
    await mutations.handleSaveRelation({ ...relation, strength: 3 });

    expect(relationService.saveCharacterRelation).toHaveBeenCalledWith('user-1', relation);
    expect(relations).toEqual([{ id: 'relation-1', strength: 3 }]);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith(
      'character_relation_changed',
      'story-1',
      'character-1',
    );
    expect(AppAlert.alert).toHaveBeenLastCalledWith('success', 'relation_saved_successfully');
  });

  it('removes a relation only when deletion succeeds', async () => {
    relations = [relation];
    const mutations = createMutations();

    await mutations.handleDeleteRelation(relation.id);
    relationService.deleteCharacterRelation.mockResolvedValueOnce(false);
    await mutations.handleDeleteRelation('missing-relation');

    expect(relations).toEqual([]);
    expect(entityEventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(AppAlert.alert).toHaveBeenLastCalledWith('error', 'failed_to_delete_relation');
  });

  it('keeps relations unchanged and reports a failed relation deletion', async () => {
    relations = [relation];
    relationService.deleteCharacterRelation.mockRejectedValue(new Error('offline'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleDeleteRelation(relation.id);

    expect(relations).toEqual([relation]);
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
    expect(characterScenes).toEqual([]);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith(
      'character_scene_changed',
      'story-1',
      'character-1',
    );
    expect(AppAlert.alert).toHaveBeenLastCalledWith(
      'success',
      'character_scene_deleted_successfully',
    );
  });

  it('keeps character-scene state when deletion is declined', async () => {
    characterScenes = [characterScene];
    characterSceneService.deleteCharacterScene.mockResolvedValue(false);
    const mutations = createMutations();

    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(characterScenes).toEqual([characterScene]);
    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_delete_character_scene');
  });

  it('replaces an existing character-scene relation after saving', async () => {
    characterScenes = [characterScene];
    const mutations = createMutations();

    await mutations.handleSaveCharacterScene({ ...characterScene, isPresent: true });

    expect(characterScenes).toEqual([{ id: 'scene-relation-1', isPresent: true }]);
    expect(entityEventEmitter.emit).toHaveBeenCalledWith(
      'character_scene_changed',
      'story-1',
      'character-1',
    );
    expect(AppAlert.alert).toHaveBeenLastCalledWith(
      'success',
      'character_scene_saved_successfully',
    );
  });

  it('reports a character-scene deletion failure without changing state', async () => {
    characterScenes = [characterScene];
    characterSceneService.deleteCharacterScene.mockRejectedValue(new Error('offline'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleDeleteCharacterScene(characterScene.id);

    expect(characterScenes).toEqual([characterScene]);
    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_delete_character_scene');
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete character scene:',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('reports service failures without changing local relation state', async () => {
    const failure = new Error('offline');
    relationService.saveCharacterRelation.mockRejectedValue(failure);
    characterSceneService.saveCharacterScene.mockRejectedValue(failure);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = createMutations();

    await mutations.handleSaveRelation(relation);
    await mutations.handleSaveCharacterScene(characterScene);

    expect(relations).toEqual([]);
    expect(characterScenes).toEqual([]);
    expect(entityEventEmitter.emit).not.toHaveBeenCalled();
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_save_relation');
    expect(AppAlert.alert).toHaveBeenCalledWith('error', 'failed_to_save_character_scene');
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
