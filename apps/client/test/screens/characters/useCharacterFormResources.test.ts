const mockDb = {};
const mockCreateCharacterService: jest.Mock = jest.fn(() => ({ id: 'character-service' }));
const mockCreateCharacterRelationService: jest.Mock = jest.fn(() => ({
  id: 'character-relation-service',
}));

jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  createCharacterService: (...args: unknown[]) => mockCreateCharacterService(...args),
}));
jest.mock('../../../src/services/storymanagement/CharacterRelationService', () => ({
  createCharacterRelationService: (...args: unknown[]) =>
    mockCreateCharacterRelationService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useCharacterFormResources } from '../../../src/screens/characters/useCharacterFormResources';

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates the character services once for the form database', async () => {
  const view = await renderHook(() => useCharacterFormResources());

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateCharacterService).toHaveBeenCalledTimes(1);
  expect(mockCreateCharacterService).toHaveBeenCalledWith(mockDb);
  expect(mockCreateCharacterRelationService).toHaveBeenCalledTimes(1);
  expect(mockCreateCharacterRelationService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.characterServiceRef.current).toEqual({ id: 'character-service' });
  expect(view.result.current.characterRelationServiceRef.current).toEqual({
    id: 'character-relation-service',
  });
});
