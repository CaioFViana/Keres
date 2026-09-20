import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import NoteRelationManager from '../../src/components/features/notes/NoteManager/NoteRelationManager';

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

// The RN jest preset already renders `Modal` children while visible and null while hidden.
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'multi-select', ...props }),
  };
});

const note = (overrides = {}) => ({
  id: 'note-1',
  storyId: 'story-1',
  title: 'First note',
  body: 'A body worth reading.',
  isFavorite: false,
  extraNotes: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const relation = (overrides = {}) => ({
  id: 'rel-1',
  storyId: 'story-1',
  noteId: 'note-1',
  relationId: 'char-1',
  relationType: 'Character',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const baseProps = () => ({
  noteRelations: [relation()],
  availableNotes: [note(), note({ id: 'note-2', title: 'Second note' })],
  onSave: jest.fn().mockResolvedValue(undefined),
  onDelete: jest.fn().mockResolvedValue(undefined),
  editable: true,
  currentStoryId: 'story-1',
  currentEntityId: 'char-1',
  currentEntityType: 'Character' as const,
});

describe('NoteRelationManager', () => {
  it('counts the relations in its title', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} />);

    expect(screen.getByText('notes_title (1)')).toBeTruthy();
    expect(screen.getByText('First note')).toBeTruthy();
  });

  it('shows the empty state when nothing is linked', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} noteRelations={[]} />);

    expect(screen.getByText('no_notes_assigned')).toBeTruthy();
  });

  it('offers every live note in the picker, with the linked ones selected', async () => {
    const screen = await render(
      <NoteRelationManager
        {...baseProps()}
        availableNotes={[note(), note({ id: 'note-gone', title: 'Gone', isDeleted: true })]}
      />,
    );

    const picker = screen.getByTestId('multi-select');
    expect(picker.props.options).toEqual([
      { label: 'First note', value: 'note-1', color: expect.any(String) },
    ]);
    expect(picker.props.selectedValues).toEqual(['note-1']);
    expect(picker.props.placeholder).toBe('select_note');
  });

  it('hides the picker when the screen is read-only', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} editable={false} />);

    expect(screen.queryByTestId('multi-select')).toBeNull();
  });

  it('saves one relation per newly picked note', async () => {
    const props = baseProps();
    const screen = await render(<NoteRelationManager {...props} />);

    await act(async () => {
      screen.getByTestId('multi-select').props.onSelectionChange(['note-1', 'note-2']);
    });

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 'story-1',
        noteId: 'note-2',
        relationId: 'char-1',
        relationType: 'Character',
        isDeleted: false,
      }),
    );
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('deletes the relations that were unpicked', async () => {
    const props = baseProps();
    const screen = await render(<NoteRelationManager {...props} />);

    await act(async () => {
      screen.getByTestId('multi-select').props.onSelectionChange([]);
    });

    expect(props.onDelete).toHaveBeenCalledWith('rel-1');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('opens the note itself when a row is tapped in read-only mode', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} editable={false} />);

    // The card starts collapsed with its content untouchable; the reader opens it first.
    await fireEvent.press(screen.getByText('notes_title (1)'));
    await fireEvent.press(screen.getByText('First note'));

    expect(screen.getAllByText('First note')).toHaveLength(2);
    expect(screen.getByText('A body worth reading.')).toBeTruthy();
  });

  it('closes the preview from its close button', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} editable={false} />);
    await fireEvent.press(screen.getByText('notes_title (1)'));
    await fireEvent.press(screen.getByText('First note'));
    expect(screen.getByText('A body worth reading.')).toBeTruthy();

    await fireEvent.press(screen.getByText('close'));

    expect(screen.queryByText('A body worth reading.')).toBeNull();
  });

  it('closes the preview from the backdrop', async () => {
    const screen = await render(<NoteRelationManager {...baseProps()} editable={false} />);
    await fireEvent.press(screen.getByText('notes_title (1)'));
    await fireEvent.press(screen.getByText('First note'));
    expect(screen.getByText('A body worth reading.')).toBeTruthy();

    // The dimmed overlay is the only host with that backdrop wash.
    const overlays = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === 'rgba(0,0,0,0.5)',
    );
    expect(overlays).toHaveLength(1);
    await fireEvent.press(overlays[0]);

    expect(screen.queryByText('A body worth reading.')).toBeNull();
  });

  it('falls back to the note id when the linked note is gone', async () => {
    const screen = await render(
      <NoteRelationManager
        {...baseProps()}
        editable={false}
        noteRelations={[relation({ noteId: 'note-missing' })]}
      />,
    );

    expect(screen.getByText('note-missing')).toBeTruthy();
  });

  it('does not open anything for a missing note', async () => {
    const screen = await render(
      <NoteRelationManager
        {...baseProps()}
        editable={false}
        noteRelations={[relation({ noteId: 'note-missing' })]}
      />,
    );

    await fireEvent.press(screen.getByText('notes_title (1)'));
    await fireEvent.press(screen.getByText('note-missing'));

    expect(screen.queryByText('close')).toBeNull();
  });
});
