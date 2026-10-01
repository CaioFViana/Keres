const mockUseSceneCharacterPresence = jest.fn();
const mockUseEntityEffects = jest.fn();
const mockUseEntityRelations = jest.fn();
const mockFetchCharacterSceneRelations = jest.fn();

jest.mock('../../../../src/hooks/useSceneCharacterPresence', () => ({
  useSceneCharacterPresence: (...args: unknown[]) => mockUseSceneCharacterPresence(...args),
}));
jest.mock('../../../../src/hooks/useEntityEffects', () => ({
  useEntityEffects: (...args: unknown[]) => mockUseEntityEffects(...args),
}));
jest.mock('../../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useSceneFormAssociations } from '../../../../src/screens/narrative-elements/scenes/useSceneFormAssociations';

const fakePresence = {
  marker: 'presence',
  fetchCharacterSceneRelations: mockFetchCharacterSceneRelations,
};
const fakeEffects = { marker: 'effects' };
const fakeRelations = { marker: 'relations' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSceneCharacterPresence.mockReturnValue(fakePresence);
  mockUseEntityEffects.mockReturnValue(fakeEffects);
  mockUseEntityRelations.mockReturnValue(fakeRelations);
  mockFetchCharacterSceneRelations.mockResolvedValue(undefined);
});

it('wires presence, effects and relations to the same scene and loads presence', async () => {
  const view = await renderHook(() => useSceneFormAssociations('scene-1', 'story-1', true));

  expect(mockUseSceneCharacterPresence).toHaveBeenCalledWith('scene-1', 'story-1');
  expect(mockUseEntityEffects).toHaveBeenCalledWith('Scene', 'scene-1', 'story-1', true);
  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Scene',
    entityId: 'scene-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.characterPresence).toBe(fakePresence);
  expect(view.result.current.effects).toBe(fakeEffects);
  expect(view.result.current.relations).toBe(fakeRelations);

  await waitFor(() => expect(mockFetchCharacterSceneRelations).toHaveBeenCalled());
});
