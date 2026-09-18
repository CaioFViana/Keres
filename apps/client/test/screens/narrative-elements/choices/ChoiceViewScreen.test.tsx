import {
  act,
  cleanup,
  fireEvent,
  render,
  type RenderResult,
  waitFor,
} from '@testing-library/react-native';
import type { GraphNode } from '@keres/shared/graphs/storyGraphLayout';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockShowNotification = jest.fn();
const mockDeliverMapExport = jest.fn();
const mockEmitterOn = jest.fn();
const mockEmitterOff = jest.fn();

const mockGetScenesByStoryId = jest.fn();
const mockGetChoicesByStoryId = jest.fn();
const mockGetChaptersByStoryId = jest.fn();
const mockGetCheckGroups = jest.fn();
const mockGetChecks = jest.fn();
const mockGetEffects = jest.fn();
const mockGetItemsByStoryId = jest.fn();
const mockGetPlots = jest.fn();
const mockGetPlotScenes = jest.fn();

let mockSelectedStory: { id: string; type: string; title: string } | null = {
  id: 'story-1',
  type: 'branching',
  title: 'My Story',
};
let mockIsCompact = false;
let mockHeaderArgs: { title: string } | null = null;
let mockRemoteHandler: ((change: { storyId?: string }) => void) | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: { title: string }) => {
    mockHeaderArgs = args;
  },
}));

jest.mock('../../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: mockIsCompact }),
}));

jest.mock('../../../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => ({ definition: { id: 'cal-1' } }),
}));

jest.mock('../../../../src/db', () => {
  const db = {};
  return {
    __esModule: true,
    useDrizzle: () => db,
  };
});

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));

jest.mock('../../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));

jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: { getState: () => ({ exportFormat: 'png' }) },
}));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      surface: '#f5f5f5',
      background: '#ffffff',
      border: '#cccccc',
      text: '#111111',
      textSecondary: '#555555',
      error: '#ff0000',
      accent: '#00cccc',
    },
  }),
}));

jest.mock('../../../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: {
    on: (...args: unknown[]) => {
      mockEmitterOn(...args);
      mockRemoteHandler = args[1] as never;
    },
    off: (...args: unknown[]) => mockEmitterOff(...args),
  },
}));

jest.mock('../../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildStoryMapFileName: (title: string) => `${title}-map.svg`,
  deliverMapExport: (...args: unknown[]) => mockDeliverMapExport(...args),
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {
    __esModule: true,
    useTranslation: () => ({ t }),
  };
});

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getScenesByStoryId: mockGetScenesByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: () => ({ getChoicesByStoryId: mockGetChoicesByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({ getChaptersByStoryId: mockGetChaptersByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceCheckGroupService', () => ({
  __esModule: true,
  createChoiceCheckGroupService: () => ({ getAllByStoryId: mockGetCheckGroups }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceCheckService', () => ({
  __esModule: true,
  createChoiceCheckService: () => ({ getAllByStoryId: mockGetChecks }),
}));

jest.mock('../../../../src/services/storymanagement/EffectService', () => ({
  __esModule: true,
  createEffectService: () => ({ getAllByStoryId: mockGetEffects }),
}));

jest.mock('../../../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: () => ({ getItemsByStoryId: mockGetItemsByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/PlotService', () => ({
  __esModule: true,
  createPlotService: () => ({ getAllByStoryId: mockGetPlots }),
}));

jest.mock('../../../../src/services/storymanagement/PlotSceneService', () => ({
  __esModule: true,
  createPlotSceneService: () => ({ getAllByStoryId: mockGetPlotScenes }),
}));

jest.mock('../../../../src/screens/narrative-elements/choices/ChoiceViewContent', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ChoiceViewContent: (props: {
      plots: { id: string }[];
      selectedPlotIds: string[];
      setSelectedPlotIds: (ids: string[]) => void;
      layout: {
        nodes: { id: string }[];
        edges: { id: string; label: string; sourceId: string; targetId: string }[];
      };
      showEdgeLabels: boolean;
      highlightedNodeIds?: ReadonlySet<string>;
      selectedNodeId: string | null;
      setSelectedNodeId: (id: string | null) => void;
      handleSelectNode: (node: GraphNode) => void;
      setLabelsOverride: (value: boolean) => void;
      exporting: boolean;
      handleExport: () => void;
      selectedNode: { id: string } | null;
      selectedSceneEffects: unknown[];
      connections: {
        outgoing: { choiceId: string; text: string; sceneName: string; extra?: string }[];
        incoming: { choiceId: string; text: string; sceneName: string; extra?: string }[];
      };
      handleOpenScene: (sceneId: string) => void;
      mapSubtitle: string;
      loading: boolean;
      error: string | null;
    }) => (
      <>
        <Text testID="view-content">
          {JSON.stringify({
            plots: props.plots.map((plot) => plot.id),
            selectedPlotIds: props.selectedPlotIds,
            nodes: props.layout.nodes.map((node) => node.id),
            edges: props.layout.edges.map((edge) => ({
              id: edge.id,
              label: edge.label,
              from: edge.sourceId,
              to: edge.targetId,
            })),
            showEdgeLabels: props.showEdgeLabels,
            highlighted: props.highlightedNodeIds ? [...props.highlightedNodeIds].sort() : null,
            selectedNodeId: props.selectedNodeId,
            selectedNode: props.selectedNode?.id ?? null,
            effects: props.selectedSceneEffects.length,
            outgoing: props.connections.outgoing,
            incoming: props.connections.incoming,
            mapSubtitle: props.mapSubtitle,
            loading: props.loading,
            error: props.error,
            exporting: props.exporting,
          })}
        </Text>
        <Text testID="content-pick-plot" onPress={() => props.setSelectedPlotIds(['plot-1'])}>
          plot
        </Text>
        <Text
          testID="content-select-node"
          onPress={() =>
            props.layout.nodes.length > 0 &&
            props.handleSelectNode(props.layout.nodes[0] as unknown as GraphNode)
          }
        >
          select
        </Text>
        <Text testID="content-clear-node" onPress={() => props.setSelectedNodeId(null)}>
          clear
        </Text>
        <Text testID="content-labels-off" onPress={() => props.setLabelsOverride(false)}>
          labels-off
        </Text>
        <Text testID="content-export" onPress={() => props.handleExport()}>
          export
        </Text>
        <Text testID="content-open-scene" onPress={() => props.handleOpenScene('scene-1')}>
          open
        </Text>
      </>
    ),
  };
});

import ChoiceViewScreen from '../../../../src/screens/narrative-elements/choices/ChoiceViewScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

function mockServicesLoaded() {
  mockGetScenesByStoryId.mockResolvedValue([
    { id: 'scene-1', name: 'Opening', chapterId: 'ch-1', index: 0, isStart: true, isFinish: false },
    { id: 'scene-2', name: 'Climax', chapterId: 'ch-1', index: 1, isStart: false, isFinish: true },
  ]);
  mockGetChoicesByStoryId.mockResolvedValue([
    { id: 'choice-1', sceneId: 'scene-1', nextSceneId: 'scene-2', text: 'Go on' },
  ]);
  mockGetChaptersByStoryId.mockResolvedValue([{ id: 'ch-1', name: 'Arrival', index: 0 }]);
  mockGetCheckGroups.mockResolvedValue([{ id: 'group-1', choiceId: 'choice-1' }]);
  mockGetChecks.mockResolvedValue([
    {
      id: 'check-1',
      groupId: 'group-1',
      type: 'inventory',
      mode: 'block',
      itemId: 'item-1',
      itemPresence: 'has',
    },
  ]);
  mockGetEffects.mockResolvedValue([
    {
      id: 'effect-1',
      entityType: 'Choice',
      entityId: 'choice-1',
      effectType: 'itemGrant',
      itemId: 'item-1',
    },
    {
      id: 'effect-2',
      entityType: 'Scene',
      entityId: 'scene-1',
      effectType: 'triggerSet',
      triggerName: 'met_ada',
    },
  ]);
  mockGetItemsByStoryId.mockResolvedValue([{ id: 'item-1', name: 'Sword' }]);
  mockGetPlots.mockResolvedValue([{ id: 'plot-1', name: 'Main' }]);
  mockGetPlotScenes.mockResolvedValue([{ plotId: 'plot-1', sceneId: 'scene-2' }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', type: 'branching', title: 'My Story' };
  mockIsCompact = false;
  mockHeaderArgs = null;
  mockRemoteHandler = null;
  mockServicesLoaded();
  mockDeliverMapExport.mockResolvedValue({ delivered: true, fileName: 'map.svg' });
});

describe('ChoiceViewScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays on loading while the graph resolves', async () => {
    mockGetScenesByStoryId.mockReturnValue(new Promise(() => {}));
    const view = await render(<ChoiceViewScreen />);
    expect(jsonOf(view, 'view-content')).toMatchObject({ loading: true, error: null });
  });

  it('renders the branching graph with labels on', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    expect(mockHeaderArgs).toMatchObject({ title: 'story_map_title' });
    expect(jsonOf(view, 'view-content')).toMatchObject({
      nodes: ['scene-1', 'scene-2'],
      edges: [{ id: 'choice-1', label: 'Go on', from: 'scene-1', to: 'scene-2' }],
      showEdgeLabels: true,
      plots: ['plot-1'],
      selectedPlotIds: [],
      highlighted: null,
      selectedNodeId: null,
      mapSubtitle: 'story_map_subtitle',
      error: null,
    });
  });

  it('projects implicit edges for linear stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'linear', title: 'Linear' };
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    expect(mockHeaderArgs).toMatchObject({ title: 'story_flow_title' });
    const content = jsonOf(view, 'view-content');
    expect(content.mapSubtitle).toBe('story_flow_subtitle');
    expect(content.edges).toHaveLength(1);
    expect(content.edges[0]).toMatchObject({ from: 'scene-1', to: 'scene-2', label: '' });
  });

  it('renders compact layouts without crashing', async () => {
    mockIsCompact = true;
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    expect(jsonOf(view, 'view-content').nodes).toEqual(['scene-1', 'scene-2']);
  });

  it('shows an error when loading fails', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockGetScenesByStoryId.mockRejectedValue(new Error('db down'));
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() =>
      expect(jsonOf(view, 'view-content').error).toBe('failed_to_load_graph_data'),
    );
    expect(jsonOf(view, 'view-content').loading).toBe(false);
    log.mockRestore();
  });

  it('highlights scenes for the selected plots', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-pick-plot'));
    expect(jsonOf(view, 'view-content')).toMatchObject({
      selectedPlotIds: ['plot-1'],
      highlighted: ['scene-2'],
    });
  });

  it('selects nodes and describes their connections', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-select-node'));
    const content = jsonOf(view, 'view-content');
    expect(content).toMatchObject({
      selectedNodeId: 'scene-1',
      selectedNode: 'scene-1',
      effects: 1,
    });
    expect(content.outgoing).toHaveLength(1);
    expect(content.outgoing[0]).toMatchObject({
      choiceId: 'choice-1',
      text: 'Go on',
      sceneName: 'Climax',
    });
    expect(content.outgoing[0].extra).toContain('check_condition_prefix_block');
    expect(content.outgoing[0].extra).toContain('effect_description_item_grant');
    expect(content.incoming).toEqual([]);
    await fireEvent.press(view.getByTestId('content-clear-node'));
    expect(jsonOf(view, 'view-content').selectedNodeId).toBeNull();
  });

  it('omits the connection extra without checks or effects', async () => {
    mockGetCheckGroups.mockResolvedValue([]);
    mockGetChecks.mockResolvedValue([]);
    mockGetEffects.mockResolvedValue([]);
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-select-node'));
    const content = jsonOf(view, 'view-content');
    expect(content.outgoing[0].extra).toBeUndefined();
    expect(content.effects).toBe(0);
  });

  it('toggles edge labels off', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-labels-off'));
    expect(jsonOf(view, 'view-content').showEdgeLabels).toBe(false);
  });

  it('opens scenes through navigation and clears the selection', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-select-node'));
    expect(jsonOf(view, 'view-content').selectedNodeId).toBe('scene-1');
    await fireEvent.press(view.getByTestId('content-open-scene'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-1' });
    expect(jsonOf(view, 'view-content').selectedNodeId).toBeNull();
  });

  it('exports the map and notifies success', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-export'));
    await waitFor(() => expect(mockDeliverMapExport).toHaveBeenCalledTimes(1));
    expect(mockDeliverMapExport).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
      'My Story-map.svg',
      'png',
    );
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith('story_map_export_success', 'success'),
    );
  });

  it('warns when the export has no share target', async () => {
    mockDeliverMapExport.mockResolvedValue({ delivered: false, uri: null, fileName: 'map.svg' });
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-export'));
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        'story_map_export_no_share_target',
        'warning',
      ),
    );
  });

  it('notifies when the export fails', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockDeliverMapExport.mockRejectedValue(new Error('share failed'));
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-export'));
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith('story_map_export_failed', 'error'),
    );
    log.mockRestore();
  });

  it('skips export without nodes', async () => {
    mockGetScenesByStoryId.mockResolvedValue([]);
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    await fireEvent.press(view.getByTestId('content-export'));
    expect(mockDeliverMapExport).not.toHaveBeenCalled();
  });

  it('reloads the graph on remote changes for the story', async () => {
    const view = await render(<ChoiceViewScreen />);
    await waitFor(() => expect(jsonOf(view, 'view-content').loading).toBe(false));
    expect(mockEmitterOn).toHaveBeenCalledWith('story_data_changed', expect.any(Function));
    const calls = mockGetScenesByStoryId.mock.calls.length;
    await act(async () => {
      mockRemoteHandler?.({ storyId: 'story-1' });
    });
    await waitFor(() => expect(mockGetScenesByStoryId.mock.calls.length).toBe(calls + 1));
    mockRemoteHandler?.({ storyId: 'story-2' });
    mockRemoteHandler?.({});
    expect(mockGetScenesByStoryId.mock.calls.length).toBe(calls + 1);
    expect(view).toBeTruthy();
  });
});
