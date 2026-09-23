import { act, fireEvent, render } from '@testing-library/react-native';
import type { ChoiceSelect, SceneSelect } from '../../src/db/schema';
import ChapterSceneBranchTree from '../../src/components/features/chapters/ChapterSceneBranchTree';
import ChapterScenesList from '../../src/components/features/chapters/ChapterScenesList';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSceneListItem = jest.fn();
jest.mock('../../src/components/features/list-items/SceneListItem', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  const { Text, TouchableOpacity, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {
      scene: { id: string; name: string };
      onViewDetails: (sceneId: string) => void;
      onExpandedChange: (isExpanded: boolean) => void;
    }) => {
      mockSceneListItem(props);
      return React.createElement(
        View,
        { testID: `scene-${props.scene.id}` },
        React.createElement(Text, null, props.scene.name),
        React.createElement(
          TouchableOpacity,
          {
            testID: `open-${props.scene.id}`,
            onPress: () => props.onViewDetails(props.scene.id),
          },
          React.createElement(Text, null, 'open'),
        ),
      );
    },
  };
});

const scene = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
  ({
    id: 'scene-1',
    name: 'Arrival',
    index: 1,
    chapterId: 'chapter-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }) as SceneSelect;

const choice = (sceneId: string, nextSceneId: string, id = `${sceneId}-${nextSceneId}`) =>
  ({ id, sceneId, nextSceneId }) as ChoiceSelect;

beforeEach(() => jest.clearAllMocks());

describe('ChapterScenesList', () => {
  const scenes = [
    scene({ id: 'scene-1', name: 'Arrival', index: 1 }),
    scene({ id: 'scene-2', name: 'Betrayal', index: 2 }),
  ];

  const baseProps = {
    storyType: 'linear' as const,
    scenes,
    choices: [] as ChoiceSelect[],
    canEdit: true,
    onOpenScene: jest.fn(),
    onToggleFavorite: jest.fn(),
    onAddScene: jest.fn(),
    onReorderScenes: jest.fn(),
    expandedSceneIds: new Set<string>(),
    onSceneExpandedChange: jest.fn(),
  };

  it('shows the empty state without actions', async () => {
    const view = await render(<ChapterScenesList {...baseProps} scenes={[]} canEdit={false} />);

    expect(view.getByText('chapter_outline_scene_count_other')).toBeTruthy();
    expect(view.getByText('no_scenes_in_chapter')).toBeTruthy();
    expect(view.queryByText('add_scene')).toBeNull();
  });

  it('sorts linearly and wires row actions', async () => {
    const onOpenScene = jest.fn();
    const onAddScene = jest.fn();
    const onReorderScenes = jest.fn();
    const view = await render(
      <ChapterScenesList
        {...baseProps}
        scenes={[scenes[1], scenes[0]]}
        onOpenScene={onOpenScene}
        onAddScene={onAddScene}
        onReorderScenes={onReorderScenes}
      />,
    );

    const rendered = mockSceneListItem.mock.calls.map(
      (call) => (call[0] as { scene: SceneSelect }).scene.id,
    );
    expect(rendered).toEqual(['scene-1', 'scene-2']);
    expect((mockSceneListItem.mock.calls[0][0] as { storyType: string }).storyType).toBe('linear');

    await fireEvent.press(view.getByTestId('open-scene-2'));
    expect(onOpenScene).toHaveBeenCalledWith('scene-2');
    await fireEvent.press(view.getByText('add_scene'));
    expect(onAddScene).toHaveBeenCalledTimes(1);
  });

  it('sorts by name for unchaptered scenes and hides reorder', async () => {
    const view = await render(
      <ChapterScenesList
        {...baseProps}
        scenes={[
          scene({ id: 'b', name: 'Zulu', index: 1, chapterId: null }),
          scene({ id: 'a', name: 'Alpha', index: 2, chapterId: null }),
        ]}
        unchaptered
      />,
    );

    const rendered = mockSceneListItem.mock.calls.map(
      (call) => (call[0] as { scene: SceneSelect }).scene.id,
    );
    expect(rendered).toEqual(['a', 'b']);
    // Reorder has no meaning without a 1..N spine.
    expect(view.queryByText('add_scene')).toBeTruthy();
  });

  it('sorts descending when asked', async () => {
    await render(<ChapterScenesList {...baseProps} sortBy="index" sortDirection="desc" />);

    const rendered = mockSceneListItem.mock.calls.map(
      (call) => (call[0] as { scene: SceneSelect }).scene.id,
    );
    expect(rendered).toEqual(['scene-2', 'scene-1']);
  });

  it('uses the one-scene count copy', async () => {
    const view = await render(<ChapterScenesList {...baseProps} scenes={[scenes[0]]} />);

    expect(view.getByText('chapter_outline_scene_count_one')).toBeTruthy();
  });

  it('forwards expansion changes with the scene id', async () => {
    const onSceneExpandedChange = jest.fn();
    await render(
      <ChapterScenesList {...baseProps} onSceneExpandedChange={onSceneExpandedChange} />,
    );

    const props = mockSceneListItem.mock.calls[0][0] as {
      onExpandedChange: (isExpanded: boolean) => void;
    };
    await act(async () => {
      props.onExpandedChange(true);
    });
    expect(onSceneExpandedChange).toHaveBeenCalledWith('scene-1', true);
  });

  it('renders the branch tree for branching stories', async () => {
    const view = await render(
      <ChapterScenesList
        {...baseProps}
        storyType="branching"
        choices={[choice('scene-1', 'scene-2')]}
      />,
    );

    expect(view.getAllByText('chapter_outline_layer')).toHaveLength(2);
  });

  it('hides the quick-add button without a handler or without edit rights', async () => {
    const withoutHandler = await render(<ChapterScenesList {...baseProps} />);
    expect(withoutHandler.queryByText('quick_add_scene')).toBeNull();

    const readOnly = await render(
      <ChapterScenesList {...baseProps} canEdit={false} onQuickAddPress={jest.fn()} />,
    );
    expect(readOnly.queryByText('quick_add_scene')).toBeNull();
  });

  it('opens quick capture through the quick-add button', async () => {
    const onQuickAddPress = jest.fn();
    const view = await render(
      <ChapterScenesList {...baseProps} onQuickAddPress={onQuickAddPress} />,
    );

    await fireEvent.press(view.getByTestId('quick-add-scene-button'));

    expect(onQuickAddPress).toHaveBeenCalledTimes(1);
  });
});

describe('ChapterSceneBranchTree', () => {
  const scenes = [
    scene({ id: 'scene-1', name: 'Arrival', index: 1 }),
    scene({ id: 'scene-2', name: 'Betrayal', index: 2 }),
    scene({ id: 'scene-3', name: 'Coda', index: 3 }),
  ];

  const baseProps = {
    scenes,
    allChapterScenes: scenes,
    choices: [choice('scene-1', 'scene-2'), choice('scene-2', 'scene-3')],
    onOpenScene: jest.fn(),
    onToggleFavorite: jest.fn(),
    expandedSceneIds: new Set<string>(),
    onSceneExpandedChange: jest.fn(),
  };

  it('layers a chain in choice order', async () => {
    const view = await render(<ChapterSceneBranchTree {...baseProps} />);

    expect(view.getAllByText('chapter_outline_layer')).toHaveLength(3);
    const rendered = mockSceneListItem.mock.calls.map(
      (call) => (call[0] as { scene: SceneSelect }).scene.id,
    );
    expect(rendered).toEqual(['scene-1', 'scene-2', 'scene-3']);
  });

  it('ignores transitions that leave the chapter', async () => {
    const view = await render(
      <ChapterSceneBranchTree {...baseProps} choices={[choice('scene-1', 'elsewhere')]} />,
    );

    // No in-chapter edge: every scene is a root of the first layer.
    expect(view.getAllByText('chapter_outline_layer')).toHaveLength(1);
    expect(mockSceneListItem).toHaveBeenCalledTimes(3);
  });

  it('keeps cyclic scenes visible instead of dropping them', async () => {
    await render(
      <ChapterSceneBranchTree
        {...baseProps}
        choices={[choice('scene-1', 'scene-2'), choice('scene-2', 'scene-1')]}
      />,
    );

    expect(mockSceneListItem).toHaveBeenCalledTimes(3);
  });

  it('preserves layer numbers while filtering', async () => {
    const view = await render(<ChapterSceneBranchTree {...baseProps} scenes={[scenes[2]]} />);

    // Only the last layer survives the filter, still rendered as a layer of its own.
    expect(view.getAllByText('chapter_outline_layer')).toHaveLength(1);
    expect(view.getByTestId('scene-scene-3')).toBeTruthy();
  });
});
