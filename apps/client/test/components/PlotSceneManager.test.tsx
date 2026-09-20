import { act, fireEvent, render } from '@testing-library/react-native';
import PlotSceneManager from '../../src/components/features/plots/PlotSceneManager/PlotSceneManager';
import type { SceneSelect } from '../../src/db/schema';
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

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => ({ notFound: 'scene-not-found' }),
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const mockModalProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/plots/PlotSceneManager/ScenePlotModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockModalProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'scene-plot-modal' });
    },
  };
});

const scene = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
  ({
    id: 'scene-1',
    storyId: 'story-1',
    name: 'First scene',
    chapterId: 'ch-1',
    index: 0,
    isDeleted: false,
    ...overrides,
  }) as SceneSelect;

const plotScene = (overrides: Partial<PlotScene> = {}): PlotScene => ({
  id: 'rel-1',
  storyId: 'story-1',
  plotId: 'plot-1',
  sceneId: 'scene-1',
  note: 'Where it begins.',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  version: 2,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const baseProps = () => ({
  relations: [plotScene()],
  scenes: [scene(), scene({ id: 'scene-2', name: 'Second scene' })],
  chapterNameOf: (chapterId: string | null | undefined) =>
    chapterId === 'ch-1' ? 'Chapter One' : undefined,
  onSave: jest.fn(),
  onDelete: jest.fn(),
  editable: true,
  currentStoryId: 'story-1',
  currentPlotId: 'plot-1',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockModalProps.current = null;
});

describe('PlotSceneManager', () => {
  it('lists each scene with its chapter and its plot note', async () => {
    const screen = await render(<PlotSceneManager {...baseProps()} />);

    expect(screen.getByText('plot_scenes')).toBeTruthy();
    expect(screen.getByText('First scene')).toBeTruthy();
    expect(screen.getByText('Chapter One')).toBeTruthy();
    expect(screen.getByText('Where it begins.')).toBeTruthy();
  });

  it('shows the empty state when the plot has no scenes', async () => {
    const screen = await render(<PlotSceneManager {...baseProps()} relations={[]} />);

    expect(screen.getByText('no_plot_scenes')).toBeTruthy();
  });

  it('skips deleted relations and names missing scenes as not found', async () => {
    const screen = await render(
      <PlotSceneManager
        {...baseProps()}
        relations={[
          plotScene({ id: 'gone', isDeleted: true }),
          plotScene({ id: 'r2', sceneId: 'nope' }),
        ]}
      />,
    );

    expect(screen.queryByText('First scene')).toBeNull();
    expect(screen.getByText('scene-not-found')).toBeTruthy();
  });

  it('hides the authoring controls when read-only', async () => {
    const screen = await render(<PlotSceneManager {...baseProps()} editable={false} />);

    expect(screen.queryByText('add_scene_to_plot')).toBeNull();
    expect(screen.queryByTestId('icon-create-outline')).toBeNull();
    expect(screen.queryByTestId('icon-trash-outline')).toBeNull();
  });

  it('opens the modal with the scenes not yet in the plot', async () => {
    const screen = await render(<PlotSceneManager {...baseProps()} />);
    await fireEvent.press(screen.getByText('add_scene_to_plot').parent!);

    expect(mockModalProps.current?.isVisible).toBe(true);
    expect(mockModalProps.current?.initialRelation).toBeNull();
    expect(mockModalProps.current?.availableScenes).toEqual([
      { id: 'scene-2', label: 'Second scene · Chapter One' },
    ]);
    expect(mockModalProps.current?.allScenes).toHaveLength(2);
  });

  it('refuses to add when every scene is already in the plot', async () => {
    const screen = await render(
      <PlotSceneManager
        {...baseProps()}
        relations={[plotScene(), plotScene({ id: 'r2', sceneId: 'scene-2' })]}
      />,
    );
    await fireEvent.press(screen.getByText('add_scene_to_plot').parent!);

    expect(mockAlert).toHaveBeenCalledWith('error', 'no_scenes_to_assign_to_plot');
    expect(mockModalProps.current?.isVisible).toBe(false);
  });

  it('edits a relation through the modal', async () => {
    const screen = await render(<PlotSceneManager {...baseProps()} />);
    await fireEvent.press(screen.getByTestId('icon-create-outline').parent!);

    expect(mockModalProps.current?.isVisible).toBe(true);
    expect(mockModalProps.current?.initialRelation).toMatchObject({ id: 'rel-1' });
  });

  it('deletes only after the confirmation', async () => {
    const props = baseProps();
    const screen = await render(<PlotSceneManager {...props} />);
    await fireEvent.press(screen.getByTestId('icon-trash-outline').parent!);

    expect(mockAlert).toHaveBeenCalledWith(
      'delete_plot_scene_relation_title',
      'delete_plot_scene_relation_message',
      expect.any(Array),
      { cancelable: true },
    );
    expect(props.onDelete).not.toHaveBeenCalled();

    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onDelete).toHaveBeenCalledWith('rel-1');
  });

  it('saves a new relation and closes the modal', async () => {
    const props = baseProps();
    const screen = await render(<PlotSceneManager {...props} />);
    await fireEvent.press(screen.getByText('add_scene_to_plot').parent!);

    await act(async () => {
      mockModalProps.current?.onSave('scene-2', 'The turn.');
    });

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: 'story-1',
        plotId: 'plot-1',
        sceneId: 'scene-2',
        note: 'The turn.',
        version: 1,
        isDeleted: false,
      }),
    );
    expect(mockModalProps.current?.isVisible).toBe(false);
  });

  it('keeps the identity of the relation being edited', async () => {
    const props = baseProps();
    const screen = await render(<PlotSceneManager {...props} />);
    await fireEvent.press(screen.getByTestId('icon-create-outline').parent!);

    await act(async () => {
      mockModalProps.current?.onSave('scene-1', 'Reworded.', 'rel-1');
    });

    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rel-1',
        note: 'Reworded.',
        version: 2,
        createdAt: new Date('2024-01-01'),
      }),
    );
  });
});
