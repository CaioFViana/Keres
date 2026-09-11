const mockDb = {};
const mockT = (key: string) => key;
const mockService = {
  getRelationsForScene: jest.fn(),
  saveCharacterScene: jest.fn(),
  deleteCharacterScene: jest.fn(),
};
const mockAlert = jest.fn();
const mockSettings = { userId: 'user-1' };

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(() => mockSettings),
}));
jest.mock('../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: jest.fn(() => mockService),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSceneCharacterPresence } from '../../src/hooks/useSceneCharacterPresence';

const relation = { id: 'relation-1', characterId: 'character-1', sceneId: 'scene-1' } as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.userId = 'user-1';
  mockService.getRelationsForScene.mockResolvedValue([relation]);
  mockService.saveCharacterScene.mockResolvedValue(relation);
  mockService.deleteCharacterScene.mockResolvedValue(true);
});

describe('useSceneCharacterPresence', () => {
  it('loads, saves, updates and deletes relations for an existing scene', async () => {
    const view = await renderHook(() => useSceneCharacterPresence('scene-1', 'story-1'));
    await act(async () => view.result.current.fetchCharacterSceneRelations());
    expect(view.result.current.characterSceneRelations).toEqual([relation]);

    await act(async () => view.result.current.handleSaveCharacterSceneRelation(relation));
    expect(mockService.saveCharacterScene).toHaveBeenCalledWith('user-1', relation);
    await act(async () => view.result.current.handleDeleteCharacterSceneRelation('relation-1'));
    expect(mockService.deleteCharacterScene).toHaveBeenCalledWith('user-1', 'relation-1');
    expect(view.result.current.characterSceneRelations).toEqual([]);
  });

  it('queues draft-scene relations, persists them after creation, and clears the queue', async () => {
    const view = await renderHook(() => useSceneCharacterPresence(undefined, 'story-1'));
    await act(async () => view.result.current.handleSaveCharacterSceneRelation(relation));
    await act(async () =>
      view.result.current.handleSaveCharacterSceneRelation({
        ...relation,
        characterId: 'character-2',
      }),
    );
    expect(view.result.current.pendingCharacterSceneRelations).toEqual([
      expect.objectContaining({ characterId: 'character-2' }),
    ]);
    await act(async () => view.result.current.persistPendingCharacterSceneRelations('new-scene'));
    expect(mockService.saveCharacterScene).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ sceneId: 'new-scene' }),
    );
    await waitFor(() => expect(view.result.current.pendingCharacterSceneRelations).toEqual([]));
  });

  it('handles unavailable services and failed persistence with user feedback', async () => {
    mockSettings.userId = null as never;
    const unavailable = await renderHook(() => useSceneCharacterPresence('scene-1', 'story-1'));
    await act(async () => unavailable.result.current.handleSaveCharacterSceneRelation(relation));
    expect(mockAlert).toHaveBeenCalledWith('error', 'service_not_initialized');

    mockSettings.userId = 'user-1';
    mockService.saveCharacterScene.mockRejectedValueOnce(new Error('offline'));
    const failing = await renderHook(() => useSceneCharacterPresence('scene-1', 'story-1'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => failing.result.current.handleSaveCharacterSceneRelation(relation));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_character_scene');
  });
});
