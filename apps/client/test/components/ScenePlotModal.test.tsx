import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ScenePlotModal from '../../src/components/features/plots/PlotSceneManager/ScenePlotModal';
import { PLOT_SCENE_NOTE_MAX_LENGTH } from '@keres/shared/entities/PlotScene';
import type { PlotScene } from '@keres/shared/entities/PlotScene';

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
  useVocabularyEntityCopy: () => ({
    entity: 'Scene',
    select: 'Select a scene',
    required: 'Scene required',
  }),
}));

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, { testID: 'responsive-modal' }, children) : null,
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'scene-select', ...props }),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'plot-note-input', ...props }),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      ReactActual.createElement(Text, { testID: String(children), onPress }, children),
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

const plotScene = (overrides: Partial<PlotScene> = {}): PlotScene => ({
  id: 'rel-1',
  storyId: 'story-1',
  plotId: 'plot-1',
  sceneId: 'scene-a',
  note: 'Where it begins.',
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
  initialRelation: null as PlotScene | null,
  availableScenes: [{ id: 'scene-b', label: 'Bravo' }],
  allScenes: [
    { id: 'scene-a', label: 'Alpha' },
    { id: 'scene-b', label: 'Bravo' },
  ],
});

describe('ScenePlotModal', () => {
  it('renders nothing while hidden', async () => {
    const screen = await render(<ScenePlotModal {...baseProps()} isVisible={false} />);

    expect(screen.queryByTestId('scene-select')).toBeNull();
  });

  it('titles the form for adding versus editing', async () => {
    const adding = await render(<ScenePlotModal {...baseProps()} />);
    expect(adding.getByText('add_scene_to_plot')).toBeTruthy();

    const editing = await render(<ScenePlotModal {...baseProps()} initialRelation={plotScene()} />);
    expect(editing.getByText('edit_plot_scene_relation')).toBeTruthy();
  });

  it('keeps the edited scene selectable, sorted with the available ones', async () => {
    const screen = await render(<ScenePlotModal {...baseProps()} initialRelation={plotScene()} />);

    expect(screen.getByTestId('scene-select').props.options).toEqual([
      { label: 'Alpha', value: 'scene-a' },
      { label: 'Bravo', value: 'scene-b' },
    ]);
    expect(screen.getByTestId('scene-select').props.value).toBe('scene-a');
    expect(screen.getByTestId('plot-note-input').props.value).toBe('Where it begins.');
    expect(screen.getByTestId('plot-note-input').props.maxLength).toBe(PLOT_SCENE_NOTE_MAX_LENGTH);
  });

  it('requires a scene before saving', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} />);

    await act(async () => {
      screen.getByTestId('plot-note-input').props.onChangeText('A note.');
    });
    await fireEvent.press(screen.getByTestId('save_changes'));

    expect(screen.getByText('Scene required')).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('requires a note before saving', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} />);

    await act(async () => {
      screen.getByTestId('scene-select').props.onValueChange('scene-b');
    });
    await fireEvent.press(screen.getByTestId('save_changes'));

    expect(screen.getByText('plot_scene_note_required')).toBeTruthy();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('saves the trimmed note with the chosen scene', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} />);

    await act(async () => {
      screen.getByTestId('scene-select').props.onValueChange('scene-b');
      screen.getByTestId('plot-note-input').props.onChangeText('  The turn.  ');
    });
    await fireEvent.press(screen.getByTestId('save_changes'));

    expect(props.onSave).toHaveBeenCalledWith('scene-b', 'The turn.', undefined);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('hands the edited relation id back on save', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} initialRelation={plotScene()} />);

    await fireEvent.press(screen.getByTestId('save_changes'));

    expect(props.onSave).toHaveBeenCalledWith('scene-a', 'Where it begins.', 'rel-1');
  });

  it('flattens newlines typed into the single-line note', async () => {
    const screen = await render(<ScenePlotModal {...baseProps()} />);

    await act(async () => {
      screen.getByTestId('plot-note-input').props.onChangeText('one\ntwo\nnearestthree');
    });

    expect(screen.getByTestId('plot-note-input').props.value).toBe('one two nearestthree');
  });

  it('counts the note against its limit', async () => {
    const screen = await render(<ScenePlotModal {...baseProps()} initialRelation={plotScene()} />);

    expect(screen.getByText(`16/${PLOT_SCENE_NOTE_MAX_LENGTH}`)).toBeTruthy();
  });

  it('resets its draft when another relation is opened', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} initialRelation={plotScene()} />);

    await screen.rerender(<ScenePlotModal {...props} initialRelation={null} />);

    expect(screen.getByTestId('scene-select').props.value).toBeNull();
    expect(screen.getByTestId('plot-note-input').props.value).toBe('');
  });

  it('closes without saving', async () => {
    const props = baseProps();
    const screen = await render(<ScenePlotModal {...props} />);

    await fireEvent.press(screen.getByTestId('cancel'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
