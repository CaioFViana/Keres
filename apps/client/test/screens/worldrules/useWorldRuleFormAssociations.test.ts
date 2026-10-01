const mockUseEntityRelations = jest.fn();

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useWorldRuleFormAssociations } from '../../../src/screens/worldrules/useWorldRuleFormAssociations';

const mockSetSelectedTagIds = jest.fn();
const relations = {
  selectedTagIds: ['tag-1'],
  setSelectedTagIds: mockSetSelectedTagIds,
  noteRelations: [{ id: 'note-relation-1' }],
  persistTagRelations: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityRelations.mockReturnValue(relations);
});

it('wires world-rule relations and aliases the note half for the form', async () => {
  const view = await renderHook(() =>
    useWorldRuleFormAssociations({ currentWorldRuleId: 'rule-1' }),
  );

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'WorldRule',
    entityId: 'rule-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.worldRuleNoteRelations).toBe(relations.noteRelations);
  expect(view.result.current.selectedTagIds).toEqual(['tag-1']);
});

it('delegates tag selection changes to the relations hook', async () => {
  const view = await renderHook(() =>
    useWorldRuleFormAssociations({ currentWorldRuleId: undefined }),
  );

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-2']);
  });

  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-2']);
});
