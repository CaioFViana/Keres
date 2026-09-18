import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import CharacterRelationManager from '../../src/components/features/relations/CharacterRelationManager/CharacterRelationManager';
import CharacterRelationRows from '../../src/components/features/relations/CharacterRelationRows';
import type { Character } from '@keres/shared/entities/Character';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const mockModalProps = { current: null as Record<string, any> | null };
jest.mock(
  '../../src/components/features/relations/CharacterRelationManager/CharacterRelationModal',
  () => {
    const ReactActual = require('react');
    const { View } = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: (props: Record<string, unknown>) => {
        mockModalProps.current = props as Record<string, any>;
        return ReactActual.createElement(View, { testID: 'character-relation-modal' });
      },
    };
  },
);

const character = (overrides: Partial<Character> = {}): Character =>
  ({
    id: 'char-1',
    storyId: 'story-1',
    name: 'Alice',
    ...overrides,
  }) as Character;

const relation = (overrides: Partial<CharacterRelation> = {}): CharacterRelation => ({
  id: 'rel-1',
  storyId: 'story-1',
  character1Id: 'char-1',
  character2Id: 'char-2',
  relationType: 'Siblings',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  version: 3,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockModalProps.current = null;
});

describe('CharacterRelationRows', () => {
  const rowsProps = () => ({
    characterId: 'char-1',
    relations: [
      relation(),
      relation({ id: 'other', character1Id: 'char-9', character2Id: 'char-8' }),
    ],
    characters: [character(), character({ id: 'char-2', name: 'Bob' })] as Character[],
    expanded: false,
    onExpandedChange: jest.fn(),
  });

  it('renders nothing when the character has no relations', async () => {
    const screen = await render(
      <CharacterRelationRows {...rowsProps()} characterId="char-unknown" />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it('counts only its own relations and toggles open', async () => {
    const props = rowsProps();
    const screen = await render(<CharacterRelationRows {...props} />);

    expect(screen.getByText('character_relations_title (1)')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeNull();

    await fireEvent.press(screen.getByText('character_relations_title (1)').parent!);
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('names the other side of each relation once expanded', async () => {
    const screen = await render(<CharacterRelationRows {...rowsProps()} expanded />);

    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Siblings')).toBeTruthy();
  });

  it('falls back to the id when the other character is gone', async () => {
    const screen = await render(
      <CharacterRelationRows
        {...rowsProps()}
        expanded
        characters={[character()]}
        relations={[relation({ character2Id: 'char-gone' })]}
      />,
    );

    expect(screen.getByText('char-gone')).toBeTruthy();
  });

  it('opens the other character from its row', async () => {
    const screen = await render(<CharacterRelationRows {...rowsProps()} expanded />);

    await fireEvent.press(screen.getByTestId('icon-chevron-forward').parent!);

    expect(mockNavigate).toHaveBeenCalledWith('Character', 'char-2');
  });
});

describe('CharacterRelationManager', () => {
  const managerProps = () => ({
    characterRelations: [relation()],
    characters: [character(), character({ id: 'char-2', name: 'Bob' })],
    onSave: jest.fn(),
    onDelete: jest.fn(),
    editable: true,
    currentStoryId: 'story-1',
    currentCharacterId: 'char-1',
  });

  it('lists the relations of the current character', async () => {
    const screen = await render(<CharacterRelationManager {...managerProps()} />);

    expect(screen.getByText('character_relations_title')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Siblings')).toBeTruthy();
  });

  it('shows the empty state when there is nothing to list', async () => {
    const screen = await render(
      <CharacterRelationManager {...managerProps()} characterRelations={[]} />,
    );

    expect(screen.getByText('no_character_relations_found')).toBeTruthy();
  });

  it('names unknown characters instead of crashing', async () => {
    const screen = await render(
      <CharacterRelationManager
        {...managerProps()}
        characters={[character()]}
        characterRelations={[relation({ character2Id: 'char-gone' })]}
      />,
    );

    expect(screen.getByText('Unknown Character (char-gone)')).toBeTruthy();
  });

  it('opens the modal to add, excluding the related characters from the picker', async () => {
    const screen = await render(<CharacterRelationManager {...managerProps()} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('character_relations_title'));

    await fireEvent.press(screen.getByText('add_character_relation').parent!);

    expect(mockModalProps.current?.isVisible).toBe(true);
    expect(mockModalProps.current?.initialRelation).toBeNull();
    expect(mockModalProps.current?.relatedCharacterIds).toEqual(['char-2']);
    expect(mockModalProps.current?.currentCharacterId).toBe('char-1');
  });

  it('opens the modal to edit from the row', async () => {
    const screen = await render(<CharacterRelationManager {...managerProps()} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('character_relations_title'));

    await fireEvent.press(screen.getByTestId('icon-create-outline').parent!);

    expect(mockModalProps.current?.isVisible).toBe(true);
    expect(mockModalProps.current?.initialRelation).toMatchObject({ id: 'rel-1' });
  });

  it('deletes only after the confirmation', async () => {
    const props = managerProps();
    const screen = await render(<CharacterRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('character_relations_title'));

    await fireEvent.press(screen.getByTestId('icon-trash-outline').parent!);
    expect(mockAlert).toHaveBeenCalledWith(
      'delete_character_relation_title',
      'delete_character_relation_message',
      expect.any(Array),
      { cancelable: true },
    );
    expect(props.onDelete).not.toHaveBeenCalled();

    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onDelete).toHaveBeenCalledWith('rel-1');
  });

  it('stores new pairs with their ids ordered, so A-B and B-A never duplicate', async () => {
    const props = managerProps();
    const screen = await render(<CharacterRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('character_relations_title'));
    await fireEvent.press(screen.getByText('add_character_relation').parent!);

    await act(async () => {
      mockModalProps.current?.onSave('char-0', 'Rivals');
    });

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 'story-1',
        character1Id: 'char-0',
        character2Id: 'char-1',
        relationType: 'Rivals',
        version: 1,
        isDeleted: false,
      }),
    );
    expect(props.onSave.mock.calls[0][0].id).toEqual(expect.any(String));
    expect(mockModalProps.current?.isVisible).toBe(false);
  });

  it('keeps the version of the relation being edited', async () => {
    const props = managerProps();
    const screen = await render(<CharacterRelationManager {...props} />);
    // The section starts collapsed, which disables its controls; expand it first.
    await fireEvent.press(screen.getByText('character_relations_title'));
    await fireEvent.press(screen.getByTestId('icon-create-outline').parent!);

    await act(async () => {
      mockModalProps.current?.onSave('char-2', 'Cousins', 'rel-1');
    });

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rel-1',
        relationType: 'Cousins',
        version: 3,
        createdAt: new Date('2024-01-01'),
      }),
    );
  });

  it('opens the related character when read-only, without authoring controls', async () => {
    const screen = await render(<CharacterRelationManager {...managerProps()} editable={false} />);

    expect(screen.queryByText('add_character_relation')).toBeNull();
    expect(screen.queryByTestId('icon-create-outline')).toBeNull();

    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(screen.getByText('character_relations_title'));
    await fireEvent.press(screen.getByText('Bob').parent!.parent!);
    expect(mockNavigate).toHaveBeenCalledWith('Character', 'char-2');
  });
});
