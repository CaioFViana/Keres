import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import GenericRelationDisplay from '../../src/components/features/relations/RelationManager/GenericRelationDisplay';
import RelationAttributeLine from '../../src/components/features/relations/RelationManager/RelationAttributeLine';
import RelationManager from '../../src/components/features/relations/RelationManager/RelationManager';
import RelationRow from '../../src/components/features/relations/RelationManager/RelationRow';
import { relationSectionStyleDefs } from '../../src/components/features/relations/RelationManager/relationSectionStyles';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#ccc',
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
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(RNText, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(RNView, { testID: 'multi-select', ...props }),
  };
});

const colors = {
  background: '#fff',
  border: '#ddd',
  card: '#ccc',
  error: '#f00',
  onPrimary: '#fff',
  primary: '#00f',
  surface: '#eee',
  text: '#111',
  textSecondary: '#555',
} as any;

describe('relationSectionStyleDefs', () => {
  it('shares one look across every relation section', () => {
    const styles = relationSectionStyleDefs(colors);

    expect(styles.relationItem).toMatchObject({
      flexDirection: 'row',
      backgroundColor: '#eee',
      borderRadius: 8,
      marginBottom: 12,
    });
    expect(styles.attributeLabel).toMatchObject({ fontWeight: '700', color: '#111' });
    expect(styles.attributeValue).toMatchObject({ color: '#555' });
    expect(styles.collapsibleHeader).toMatchObject({ backgroundColor: '#ccc' });
  });
});

describe('RelationAttributeLine', () => {
  it('reads the label as a label and the value as a value', async () => {
    const screen = await render(<RelationAttributeLine label="Scene" value="Throne Room" />);

    expect(screen.getByText('Scene:')).toBeTruthy();
    expect(screen.getByText('Throne Room')).toBeTruthy();
  });
});

describe('RelationRow', () => {
  it('shows its content without any action by default', async () => {
    const screen = await render(
      <RelationRow>
        <Text>Content</Text>
      </RelationRow>,
    );

    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.queryByTestId('icon-chevron-forward')).toBeNull();
    expect(screen.queryByTestId('icon-trash-outline')).toBeNull();
  });

  it('taps through to its content and shows the chevron when pressable', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <RelationRow onPress={onPress}>
        <Text>Content</Text>
      </RelationRow>,
    );

    expect(screen.getByTestId('icon-chevron-forward')).toBeTruthy();
    await fireEvent.press(screen.getByText('Content'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the extra actions and the remove button', async () => {
    const onRemove = jest.fn();
    const screen = await render(
      <RelationRow extraActions={<Text>extra</Text>} onRemove={onRemove}>
        <Text>Content</Text>
      </RelationRow>,
    );

    expect(screen.getByText('extra')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('icon-trash-outline').parent!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('GenericRelationDisplay', () => {
  type Item = { id: string; name: string };
  const items: Item[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ];
  const baseProps = () => ({
    relations: [
      { id: 'r-a', isDeleted: false },
      { id: 'r-gone', isDeleted: true },
    ],
    getRelatedItem: (itemId: string) => items.find((item) => item.id === itemId),
    getRelationItemId: (relation: { id: string }) => (relation.id === 'r-a' ? 'a' : 'missing'),
    getItemDisplayName: (item: Item) => item.name,
    noItemsMessage: 'nothing_here',
    title: 'Related',
  });

  it('lists the live relations by display name', async () => {
    const screen = await render(<GenericRelationDisplay {...baseProps()} />);

    expect(screen.getByText('Related')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('nothing_here')).toBeNull();
  });

  it('translates the empty message', async () => {
    const screen = await render(<GenericRelationDisplay {...baseProps()} relations={[]} />);

    expect(screen.getByText('nothing_here')).toBeTruthy();
  });

  it('skips the relations whose item is gone', async () => {
    const screen = await render(
      <GenericRelationDisplay {...baseProps()} relations={[{ id: 'r-x', isDeleted: false }]} />,
    );

    expect(screen.getByText('nothing_here')).toBeTruthy();
  });

  it('lets the extra content take the row over', async () => {
    const screen = await render(
      <GenericRelationDisplay
        {...baseProps()}
        renderItemExtraContent={(_relation, item) => <Text>Extra {item.name}</Text>}
      />,
    );

    expect(screen.getByText('Extra Alpha')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('navigates from the row only when a press handler is given', async () => {
    const onItemPress = jest.fn();
    const pressable = await render(
      <GenericRelationDisplay {...baseProps()} onItemPress={onItemPress} />,
    );
    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(pressable.getByText('Related'));
    await fireEvent.press(pressable.getByText('Alpha'));
    expect(onItemPress).toHaveBeenCalledWith({ id: 'a', name: 'Alpha' });

    // Without a press handler the rows are plain views: no chevron anywhere.
    const plain = await render(<GenericRelationDisplay {...baseProps()} />);
    expect(plain.queryByTestId('icon-chevron-forward')).toBeNull();
  });
});

describe('RelationManager', () => {
  type Item = { id: string; isDeleted: boolean; name: string };
  type Rel = {
    id: string;
    storyId: string;
    itemId: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    isDeleted: boolean;
    deletedAt: Date | null;
  };
  const rel = (overrides: Partial<Rel> = {}): Rel => ({
    id: 'r-a',
    storyId: 'story-1',
    itemId: 'a',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  });
  const baseProps = () => ({
    relations: [rel()],
    availableItems: [
      { id: 'a', isDeleted: false, name: 'Alpha' },
      { id: 'b', isDeleted: false, name: 'Beta' },
      { id: 'c', isDeleted: true, name: 'Gone' },
    ] as Item[],
    onSave: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
    editable: true,
    currentStoryId: 'story-1',
    currentEntityId: 'entity-1',
    createRelationObject: (selectedItemId: string, storyId: string, currentEntityId: string) =>
      rel({
        id: `new-${selectedItemId}`,
        storyId,
        itemId: selectedItemId,
        currentEntityId,
      } as Partial<Rel>),
    getRelationItemId: (relation: Rel) => relation.itemId,
    getItemDisplayName: (item: Item) => item.name,
    getItemSearchValue: (item: Item) => item.name,
    filterAvailableItems: () => true,
    selectItemPlaceholder: 'Pick some',
    noItemsAssignedMessage: 'none_assigned',
    itemAlreadyAddedMessage: 'already',
    selectItemToAddMessage: 'pick_to_add',
    deleteConfirmationTitle: 'sure?',
    deleteConfirmationMessage: 'really?',
    title: 'Relations',
  });

  it('offers the live items with the linked ones selected', async () => {
    const screen = await render(<RelationManager {...baseProps()} />);

    expect(screen.getByTestId('multi-select').props.options).toEqual([
      { label: 'Alpha', value: 'a', color: undefined },
      { label: 'Beta', value: 'b', color: undefined },
    ]);
    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['a']);
  });

  it('keeps already-linked items offered even when the filter would hide them', async () => {
    const screen = await render(
      <RelationManager {...baseProps()} filterAvailableItems={(item) => item.id !== 'a'} />,
    );

    // Alpha stays because it is already linked; Beta stays because it passes the filter.
    expect(screen.getByTestId('multi-select').props.options).toEqual([
      { label: 'Alpha', value: 'a', color: undefined },
      { label: 'Beta', value: 'b', color: undefined },
    ]);
  });

  it('saves the added links and deletes the removed ones', async () => {
    const props = baseProps();
    const screen = await render(<RelationManager {...props} />);

    await act(async () => {
      screen.getByTestId('multi-select').props.onSelectionChange(['b']);
    });

    expect(props.onDelete).toHaveBeenCalledWith('r-a');
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'b' }));
  });

  it('hides the picker when read-only', async () => {
    const screen = await render(<RelationManager {...baseProps()} editable={false} />);

    expect(screen.queryByTestId('multi-select')).toBeNull();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });

  it('translates the empty message', async () => {
    const screen = await render(<RelationManager {...baseProps()} relations={[]} />);

    expect(screen.getByText('none_assigned')).toBeTruthy();
  });

  it('skips the links whose item is gone', async () => {
    const screen = await render(
      <RelationManager {...baseProps()} relations={[rel({ itemId: 'missing' })]} />,
    );

    expect(screen.getByText('none_assigned')).toBeTruthy();
  });

  it('presses through to the item only when read-only', async () => {
    const onItemPress = jest.fn();
    const readOnly = await render(
      <RelationManager {...baseProps()} editable={false} onItemPress={onItemPress} />,
    );
    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(readOnly.getByText('Relations'));
    await fireEvent.press(readOnly.getByText('Alpha'));
    expect(onItemPress).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', name: 'Alpha' }));

    // While editing the rows stay plain: no chevron anywhere.
    const editing = await render(<RelationManager {...baseProps()} onItemPress={onItemPress} />);
    expect(editing.queryByTestId('icon-chevron-forward')).toBeNull();
  });

  it('renders the extra content the caller supplies per link', async () => {
    const screen = await render(
      <RelationManager
        {...baseProps()}
        renderRelationItemExtraContent={() => <Text>Details here</Text>}
      />,
    );

    expect(screen.getByText('Details here')).toBeTruthy();
  });
});
