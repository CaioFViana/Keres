const mockUseChoiceChecks = jest.fn();
const mockUseEntityEffects = jest.fn();
const mockUseEntityRelations = jest.fn();

jest.mock('../../../../src/hooks/useChoiceChecks', () => ({
  useChoiceChecks: (...args: unknown[]) => mockUseChoiceChecks(...args),
}));
jest.mock('../../../../src/hooks/useEntityEffects', () => ({
  useEntityEffects: (...args: unknown[]) => mockUseEntityEffects(...args),
}));
jest.mock('../../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useChoiceFormAssociations } from '../../../../src/screens/narrative-elements/choices/useChoiceFormAssociations';

const fakeChecks = { marker: 'checks' };
const fakeEffects = { marker: 'effects' };
const fakeRelations = { marker: 'relations' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseChoiceChecks.mockReturnValue(fakeChecks);
  mockUseEntityEffects.mockReturnValue(fakeEffects);
  mockUseEntityRelations.mockReturnValue(fakeRelations);
});

it('wires checks, effects and relations to the same choice', async () => {
  const view = await renderHook(() => useChoiceFormAssociations('choice-1', 'story-1', true));

  expect(mockUseChoiceChecks).toHaveBeenCalledWith('choice-1', 'story-1', true);
  expect(mockUseEntityEffects).toHaveBeenCalledWith('Choice', 'choice-1', 'story-1', true);
  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Choice',
    entityId: 'choice-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.checks).toBe(fakeChecks);
  expect(view.result.current.effects).toBe(fakeEffects);
  expect(view.result.current.relations).toBe(fakeRelations);
});

it('forwards a linear story as not branching', async () => {
  await renderHook(() => useChoiceFormAssociations(undefined, 'story-1', false));

  expect(mockUseChoiceChecks).toHaveBeenCalledWith(undefined, 'story-1', false);
  expect(mockUseEntityEffects).toHaveBeenCalledWith('Choice', undefined, 'story-1', false);
  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Choice',
    entityId: undefined,
    preserveDraftOnEntityCreation: true,
  });
});
