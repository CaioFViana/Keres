import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { GraphNode, StoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import type { TFunction } from 'i18next';
import { ChoiceViewContent } from '../../../../src/screens/narrative-elements/choices/ChoiceViewContent';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message: string }) => (
      <Text testID="screen-loading">{message}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      selectedValues,
      onSelectionChange,
      placeholder,
    }: {
      options: { value: string; label: string }[];
      selectedValues: string[];
      onSelectionChange: (ids: string[]) => void;
      placeholder: string;
    }) => (
      <>
        <Text testID="plot-filter">{JSON.stringify({ options, selectedValues, placeholder })}</Text>
        <Text testID="plot-filter-select" onPress={() => onSelectionChange(['plot-1'])}>
          select
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/graphs/StoryGraph/StoryGraphCanvas', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      layout,
      showEdgeLabels,
      selectedNodeId,
      highlightedNodeIds,
      onSelectNode,
    }: {
      layout: StoryGraphLayout;
      showEdgeLabels: boolean;
      selectedNodeId: string | null;
      highlightedNodeIds?: ReadonlySet<string>;
      onSelectNode: (node: GraphNode) => void;
    }) => (
      <>
        <Text testID="graph-canvas">
          {JSON.stringify({
            nodes: layout.nodes.map((node) => node.id),
            edges: layout.edges.length,
            showEdgeLabels,
            selectedNodeId,
            highlighted: highlightedNodeIds ? [...highlightedNodeIds] : null,
          })}
        </Text>
        {layout.nodes.length > 0 && (
          <Text testID="graph-canvas-select" onPress={() => onSelectNode(layout.nodes[0])}>
            select-first
          </Text>
        )}
      </>
    ),
  };
});

interface SheetItem {
  id: string;
  label: string;
  detail?: string;
  extra?: string;
  italicLabel?: boolean;
  onPress: () => void;
}

interface SheetSection {
  title: string;
  description?: string;
  emptyMessage?: string;
  items?: SheetItem[];
}

jest.mock('../../../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      subtitle,
      badges,
      sections,
      actionLabel,
      onAction,
      onClose,
    }: {
      title: string;
      subtitle?: { text: string; color?: string };
      badges?: { label: string; color: string }[];
      sections: SheetSection[];
      actionLabel: string;
      onAction: () => void;
      onClose: () => void;
    }) => (
      <>
        <Text testID="node-sheet">
          {JSON.stringify({
            title,
            subtitle: subtitle ?? null,
            badges: (badges ?? []).map((badge) => badge.label),
            sections: sections.map((section) => ({
              title: section.title,
              description: section.description ?? null,
              emptyMessage: section.emptyMessage ?? null,
              items: (section.items ?? []).map((item) => ({
                id: item.id,
                label: item.label,
                detail: item.detail ?? null,
                extra: item.extra ?? null,
                italicLabel: item.italicLabel ?? false,
              })),
            })),
            actionLabel,
          })}
        </Text>
        {sections
          .flatMap((section) => section.items ?? [])
          .map((item: SheetItem) => (
            <Text key={item.id} testID={`sheet-item-${item.id}`} onPress={item.onPress}>
              {item.label}
            </Text>
          ))}
        <Text testID="node-sheet-action" onPress={onAction}>
          action
        </Text>
        <Text testID="node-sheet-close" onPress={onClose}>
          close
        </Text>
      </>
    ),
  };
});

const t = ((key: string) => key) as unknown as TFunction;

const colors = {
  primary: '#0000ff',
  primaryVariant: '#0000cc',
  primaryContainer: '#aaaaff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  secondaryVariant: '#008800',
  background: '#ffffff',
  surface: '#f5f5f5',
  error: '#ff0000',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onBackground: '#111111',
  onSurface: '#111111',
  onError: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  card: '#eeeeee',
  border: '#cccccc',
  notification: '#ff8800',
  onNotification: '#ffffff',
  accent: '#00cccc',
  onAccent: '#ffffff',
  star: '#ffcc00',
  shadow: '#000000',
} as unknown as ThemeColors;

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'scene-1',
    scene: {
      id: 'scene-1',
      name: 'Opening',
      chapterId: 'chapter-1',
      index: 0,
      isStart: true,
      isFinish: false,
      summary: 'It begins',
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
    },
    labelLines: ['Opening'],
    chapterId: 'chapter-1',
    chapterName: 'Arrival',
    chapterColor: '#ff0000',
    isStart: true,
    isFinish: false,
    layer: 0,
    x: 0,
    y: 0,
    width: 168,
    height: 72,
    isDetached: false,
    ...overrides,
  };
}

function makeLayout(overrides: Partial<StoryGraphLayout> = {}): StoryGraphLayout {
  return {
    nodes: [makeNode()],
    edges: [],
    width: 400,
    height: 300,
    chapters: [{ id: 'chapter-1', name: 'Arrival', color: '#ff0000', sceneCount: 1 }],
    danglingChoiceCount: 0,
    hasBackwardEdges: false,
    detachedSceneCount: 0,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  const canvasRef = {
    current: { zoomBy: jest.fn(), fitToScreen: jest.fn() },
  };
  return {
    t,
    colors,
    calendar: {},
    navigation: { goBack: jest.fn() },
    canvasRef: canvasRef as never,
    selectedStory: { id: 'story-1', title: 'My Story', normalizeSceneTiming: false },
    plots: [],
    selectedPlotIds: [],
    setSelectedPlotIds: jest.fn(),
    layout: makeLayout(),
    showEdgeLabels: true,
    highlightedNodeIds: undefined,
    selectedNodeId: null,
    setSelectedNodeId: jest.fn(),
    handleSelectNode: jest.fn(),
    setLabelsOverride: jest.fn(),
    exporting: false,
    handleExport: jest.fn(),
    selectedNode: null,
    selectedSceneEffects: [],
    itemNamesById: {},
    connections: { outgoing: [], incoming: [] },
    handleOpenScene: jest.fn(),
    mapSubtitle: 'sub',
    loading: false,
    error: null,
    ...overrides,
  };
}

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('ChoiceViewContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the loading state', async () => {
    const view = await render(<ChoiceViewContent {...baseProps({ loading: true })} />);
    expect(view.getByTestId('screen-loading').props.children).toBe('loading_graph_data');
    expect(view.queryByTestId('graph-canvas')).toBeNull();
  });

  it('renders the error state and navigates back', async () => {
    const props = baseProps({ error: 'boom' });
    const view = await render(<ChoiceViewContent {...props} />);
    expect(view.getByTestId('screen-error').props.children).toBe('boom');
    await fireEvent.press(view.getByTestId('screen-error'));
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state without nodes', async () => {
    const view = await render(
      <ChoiceViewContent {...baseProps({ layout: makeLayout({ nodes: [] }) })} />,
    );
    expect(view.getByText('story_map_empty')).toBeTruthy();
    expect(view.queryByTestId('graph-canvas')).toBeNull();
  });

  it('renders the header, legend and canvas wiring', async () => {
    const props = baseProps({
      layout: makeLayout({ hasBackwardEdges: true, danglingChoiceCount: 2 }),
      highlightedNodeIds: new Set(['scene-1']),
      selectedNodeId: 'scene-1',
    });
    const view = await render(<ChoiceViewContent {...props} />);
    expect(view.getByText('My Story')).toBeTruthy();
    expect(view.getByText('sub')).toBeTruthy();
    expect(view.getByText('Arrival (1)')).toBeTruthy();
    expect(view.getByText('story_map_badge_start')).toBeTruthy();
    expect(view.getByText('story_map_badge_finish')).toBeTruthy();
    expect(view.getByText('story_map_legend_loops')).toBeTruthy();
    expect(view.getByText('story_map_dangling_choices')).toBeTruthy();
    expect(jsonOf(view, 'graph-canvas')).toMatchObject({
      nodes: ['scene-1'],
      showEdgeLabels: true,
      selectedNodeId: 'scene-1',
      highlighted: ['scene-1'],
    });
    await fireEvent.press(view.getByTestId('graph-canvas-select'));
    expect(props.handleSelectNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'scene-1' }));
  });

  it('hides the title, loops legend and warning when absent', async () => {
    const view = await render(
      <ChoiceViewContent {...baseProps({ selectedStory: { id: 'story-1' } })} />,
    );
    expect(view.queryByText('My Story')).toBeNull();
    expect(view.getByText('sub')).toBeTruthy();
    expect(view.queryByText('story_map_legend_loops')).toBeNull();
    expect(view.queryByText('story_map_dangling_choices')).toBeNull();
    expect(view.queryByTestId('plot-filter')).toBeNull();
  });

  it('renders the plot filter and forwards selection changes', async () => {
    const props = baseProps({
      plots: [{ id: 'plot-1', name: 'Main' }],
      selectedPlotIds: ['plot-1'],
    });
    const view = await render(<ChoiceViewContent {...props} />);
    expect(jsonOf(view, 'plot-filter')).toMatchObject({
      options: [{ value: 'plot-1', label: 'Main' }],
      selectedValues: ['plot-1'],
      placeholder: 'story_map_filter_plots',
    });
    await fireEvent.press(view.getByTestId('plot-filter-select'));
    expect(props.setSelectedPlotIds).toHaveBeenCalledWith(['plot-1']);
  });

  it('wires the map controls to the canvas and export', async () => {
    const zoomBy = jest.fn();
    const fitToScreen = jest.fn();
    const props = baseProps({
      showEdgeLabels: false,
      canvasRef: { current: { zoomBy, fitToScreen } } as never,
    });
    const view = await render(<ChoiceViewContent {...props} />);
    await fireEvent.press(view.getByLabelText('story_map_zoom_in'));
    expect(zoomBy).toHaveBeenCalledWith(1.25);
    await fireEvent.press(view.getByLabelText('story_map_zoom_out'));
    expect(zoomBy).toHaveBeenCalledWith(0.8);
    await fireEvent.press(view.getByLabelText('story_map_fit'));
    expect(fitToScreen).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText('story_map_toggle_labels'));
    expect(props.setLabelsOverride).toHaveBeenCalledWith(true);
    await fireEvent.press(view.getByLabelText('story_map_export'));
    expect(props.handleExport).toHaveBeenCalledTimes(1);
  });

  it('disables export while exporting', async () => {
    const props = baseProps({ exporting: true });
    const view = await render(<ChoiceViewContent {...props} />);
    await fireEvent.press(view.getByLabelText('story_map_export'));
    expect(props.handleExport).not.toHaveBeenCalled();
  });

  it('renders the node sheet with badges, timing and effects', async () => {
    const selectedNode = makeNode({
      isFinish: true,
      isDetached: true,
      scene: {
        id: 'scene-1',
        name: 'Opening',
        chapterId: 'chapter-1',
        index: 0,
        isStart: true,
        isFinish: true,
        summary: 'It begins',
        gap: 2,
        gapType: 'days',
        duration: 3,
        durationType: 'hours',
      },
    });
    const props = baseProps({
      selectedNode,
      selectedNodeId: 'scene-1',
      selectedSceneEffects: [{ effectType: 'itemGrant', itemId: 'item-1' }],
      itemNamesById: { 'item-1': 'Sword' },
    });
    const view = await render(<ChoiceViewContent {...props} />);
    const sheet = jsonOf(view, 'node-sheet');
    expect(sheet.title).toBe('Opening');
    expect(sheet.subtitle).toMatchObject({ text: 'Arrival', color: '#ff0000' });
    expect(sheet.badges).toEqual([
      'story_map_badge_start',
      'story_map_badge_finish',
      'story_map_badge_detached',
    ]);
    expect(sheet.actionLabel).toBe('story_map_open_scene');
    const titles = sheet.sections.map((section: { title: string }) => section.title);
    expect(titles).toEqual([
      'summary',
      'scene_timing',
      'effects_title',
      'story_map_outgoing_choices',
      'story_map_incoming_choices',
    ]);
    expect(sheet.sections[0].description).toBe('It begins');
    expect(sheet.sections[1].description).toContain('gap');
    expect(sheet.sections[1].description).toContain('in_universe_duration');
    expect(sheet.sections[2].description).toContain('effect_description_item_grant');
    await fireEvent.press(view.getByTestId('node-sheet-action'));
    expect(props.handleOpenScene).toHaveBeenCalledWith('scene-1');
    await fireEvent.press(view.getByTestId('node-sheet-close'));
    expect(props.setSelectedNodeId).toHaveBeenCalledWith(null);
  });

  it('omits optional sheet sections without data', async () => {
    const selectedNode = makeNode({
      chapterName: '',
      isStart: false,
      scene: {
        id: 'scene-1',
        name: 'Opening',
        chapterId: 'chapter-1',
        index: 0,
        isStart: false,
        isFinish: false,
        summary: null,
        gap: null,
        gapType: null,
        duration: null,
        durationType: null,
      },
    });
    const view = await render(
      <ChoiceViewContent {...baseProps({ selectedNode, selectedNodeId: 'scene-1' })} />,
    );
    const sheet = jsonOf(view, 'node-sheet');
    expect(sheet.subtitle).toBeNull();
    expect(sheet.badges).toEqual([]);
    const titles = sheet.sections.map((section: { title: string }) => section.title);
    expect(titles).toEqual(['story_map_outgoing_choices', 'story_map_incoming_choices']);
    expect(sheet.sections[0].emptyMessage).toBe('story_map_no_outgoing_choices');
    expect(sheet.sections[1].emptyMessage).toBe('story_map_no_incoming_choices');
  });

  it('renders connections with implicit labels and navigates between nodes', async () => {
    const selectedNode = makeNode();
    const props = baseProps({
      selectedNode,
      selectedNodeId: 'scene-1',
      connections: {
        outgoing: [
          {
            choiceId: 'choice-1',
            text: '',
            sceneId: 'scene-2',
            sceneName: 'Next',
            extra: 'needs key',
          },
        ],
        incoming: [{ choiceId: 'choice-0', text: 'Go', sceneId: 'scene-0', sceneName: 'Before' }],
      },
    });
    const view = await render(<ChoiceViewContent {...props} />);
    const sheet = jsonOf(view, 'node-sheet');
    expect(sheet.sections[1].items).toEqual([
      {
        id: 'choice-1',
        label: 'story_map_implicit_choice',
        detail: 'Next',
        extra: 'needs key',
        italicLabel: true,
      },
    ]);
    expect(sheet.sections[2].items).toEqual([
      { id: 'choice-0', label: 'Go', detail: 'Before', extra: null, italicLabel: false },
    ]);
    await fireEvent.press(view.getByTestId('sheet-item-choice-1'));
    expect(props.setSelectedNodeId).toHaveBeenCalledWith('scene-2');
    await fireEvent.press(view.getByTestId('sheet-item-choice-0'));
    expect(props.setSelectedNodeId).toHaveBeenCalledWith('scene-0');
    expect(view.queryByTestId('node-sheet')).toBeTruthy();
  });

  it('renders no sheet without a selected node', async () => {
    const view = await render(<ChoiceViewContent {...baseProps()} />);
    expect(view.queryByTestId('node-sheet')).toBeNull();
    expect(view.getByTestId('graph-canvas')).toBeTruthy();
  });

  it('renders only the summary section for a bare node', async () => {
    const node = makeNode();
    const view = await render(
      <ChoiceViewContent {...baseProps({ selectedNode: node, selectedNodeId: 'scene-1' })} />,
    );
    const sheet = jsonOf(view, 'node-sheet');
    expect(sheet.sections[0]).toMatchObject({ title: 'summary', description: 'It begins' });
  });
});
