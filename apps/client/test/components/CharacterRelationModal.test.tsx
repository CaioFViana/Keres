import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import CharacterRelationModal from '../../src/components/features/relations/CharacterRelationManager/CharacterRelationModal';
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

jest.mock('../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => ({ select: 'Select a character' }),
}));

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, null, children) : null,
  };
});

jest.mock('../../src/components/common/inputs/SuggestionTextInput/SuggestionTextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'relation-type-input', ...props }),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      ReactActual.createElement(Text, { testID: `button-${String(children)}`, onPress }, children),
  };
});

jest.mock('../../src/components/common/controls/FormActions/FormActions', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

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
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const baseProps = () => ({
  isVisible: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  initialRelation: null as CharacterRelation | null,
  characters: [
    character(),
    character({ id: 'char-2', name: 'Bob' }),
    character({ id: 'char-3', name: 'Zoe' }),
  ],
  currentStoryId: 'story-1',
  currentCharacterId: 'char-1',
  relatedCharacterIds: [] as string[],
});

describe('CharacterRelationModal', () => {
  it('renders nothing while hidden', async () => {
    const screen = await render(<CharacterRelationModal {...baseProps()} isVisible={false} />);

    expect(screen.queryByTestId('relation-type-input')).toBeNull();
  });

  it('titles the form for adding versus editing', async () => {
    const adding = await render(<CharacterRelationModal {...baseProps()} />);
    expect(adding.getByText('add_character_relation_title')).toBeTruthy();

    const editing = await render(
      <CharacterRelationModal {...baseProps()} initialRelation={relation()} />,
    );
    expect(editing.getByText('edit_character_relation')).toBeTruthy();
  });

  it('lists the characters that can still be related, sorted by name', async () => {
    const screen = await render(
      <CharacterRelationModal {...baseProps()} relatedCharacterIds={['char-3']} />,
    );

    // Opens the character picker.
    await fireEvent.press(screen.getByText('Select a character').parent!);

    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.queryByText('Zoe')).toBeNull();
  });

  it('says so when nobody else can be related', async () => {
    const screen = await render(
      <CharacterRelationModal {...baseProps()} characters={[character()]} />,
    );

    await fireEvent.press(screen.getByText('Select a character').parent!);

    expect(screen.getByText('no_characters_found')).toBeTruthy();
  });

  it('closes the picker without choosing', async () => {
    const screen = await render(<CharacterRelationModal {...baseProps()} />);
    await fireEvent.press(screen.getByText('Select a character').parent!);
    expect(screen.getByText('Bob')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('button-close'));

    expect(screen.queryByText('Bob')).toBeNull();
  });

  it('requires a character and a type before saving', async () => {
    const props = baseProps();
    const screen = await render(<CharacterRelationModal {...props} />);

    await fireEvent.press(screen.getByTestId('button-save_changes'));

    expect(screen.getByText('related_character_required')).toBeTruthy();
    expect(screen.getByText('relation_type_required')).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('saves the chosen pair and closes', async () => {
    const props = baseProps();
    const screen = await render(<CharacterRelationModal {...props} />);

    await fireEvent.press(screen.getByText('Select a character').parent!);
    await fireEvent.press(screen.getByText('Bob').parent!);
    expect(screen.getByTestId('relation-type-input')).toBeTruthy();
    await act(async () => {
      screen.getByTestId('relation-type-input').props.onChangeText('Siblings');
    });
    await fireEvent.press(screen.getByTestId('button-save_changes'));

    expect(props.onSave).toHaveBeenCalledWith('char-2', 'Siblings', undefined);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('edits the type with the character locked in', async () => {
    const props = baseProps();
    const screen = await render(<CharacterRelationModal {...props} initialRelation={relation()} />);

    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByTestId('relation-type-input').props.value).toBe('Siblings');

    await act(async () => {
      screen.getByTestId('relation-type-input').props.onChangeText('Cousins');
    });
    await fireEvent.press(screen.getByTestId('button-save_changes'));

    expect(props.onSave).toHaveBeenCalledWith('char-2', 'Cousins', 'rel-1');
  });

  it('starts over when it is opened for a new relation', async () => {
    const props = baseProps();
    const screen = await render(<CharacterRelationModal {...props} initialRelation={relation()} />);

    await screen.rerender(<CharacterRelationModal {...props} initialRelation={null} />);

    expect(screen.getByText('Select a character')).toBeTruthy();
    expect(screen.getByTestId('relation-type-input').props.value).toBe('');
  });

  it('cancels without saving', async () => {
    const props = baseProps();
    const screen = await render(<CharacterRelationModal {...props} />);

    await fireEvent.press(screen.getByTestId('button-cancel'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
