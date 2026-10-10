import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockGetCharactersByStoryId = jest.fn();
const mockGetCharacterRelationsByStoryId = jest.fn();
const mockNotify = jest.fn();
const mockDeliverMapExport = jest.fn();
const mockZoomBy = jest.fn();
const mockFitToScreen = jest.fn();
const mockFitToRect = jest.fn();
const mockSaveRelation = jest.fn();
const mockDeleteRelation = jest.fn();
const mockAlert = jest.fn();
let mockCanEdit = true;
const mockTCalls: [string, unknown][] = [];
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string, options?: unknown) => {
  mockTCalls.push([key, options]);
  return key;
};
let mockStory: { id: string; title: string } | null = { id: 'story-1', title: 'Saga' };
let mockIsCompact = false;
let mockLanguage = 'en';
const mockBuildFileName = jest.fn((...args: unknown[]) => `${args[0] as string}.svg`);

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: ({ message }: { message: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, message);
  },
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  __esModule: true,
  default: (props: {
    options: { label: string; value: string }[];
    selectedValues: string[];
    onSelectionChange: (next: string[]) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'focus-filter' },
      react.createElement(
        native.Text,
        { testID: 'focus-selected' },
        JSON.stringify(props.selectedValues),
      ),
      ...props.options.map((option) =>
        react.createElement(
          native.Text,
          {
            key: option.value,
            testID: `focus-${option.value}`,
            onPress: () => props.onSelectionChange([...props.selectedValues, option.value]),
          },
          option.label,
        ),
      ),
    );
  },
}));
jest.mock(
  '@/src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas',
  () => {
    const react = jest.requireActual('react') as typeof import('react');
    return {
      __esModule: true,
      default: react.forwardRef(
        (
          props: {
            layout: { nodes: { id: string }[]; edges: unknown[] };
            showEdgeLabels: boolean;
            selectedNodeId: string | null;
            highlightedNodeIds: string[];
            focusNodeIds: Set<string> | null;
            edgeColors: Map<string, string>;
            nodeAccessibilityLabel: (node: never) => string;
            onSelectNode: (node: { id: string }) => void;
            onBackgroundTap: () => void;
          },
          ref: React.Ref<{ zoomBy: unknown; fitToScreen: unknown; fitToRect: unknown }>,
        ) => {
          const native = jest.requireActual('react-native') as typeof import('react-native');
          react.useImperativeHandle(ref, () => ({
            zoomBy: mockZoomBy,
            fitToScreen: mockFitToScreen,
            fitToRect: mockFitToRect,
          }));
          return react.createElement(
            native.View,
            { testID: 'graph-canvas' },
            react.createElement(
              native.Text,
              { testID: 'graph-marker' },
              JSON.stringify({
                nodes: props.layout.nodes.map((node) => node.id),
                edges: props.layout.edges.length,
                labels: props.showEdgeLabels,
                selected: props.selectedNodeId,
                highlighted: props.highlightedNodeIds,
                focus: props.focusNodeIds ? [...props.focusNodeIds].sort() : null,
                edgeColors: Object.fromEntries(props.edgeColors ?? []),
                labels_a11y: props.layout.nodes.map((node) =>
                  props.nodeAccessibilityLabel(node as never),
                ),
              }),
            ),
            react.createElement(
              native.Text,
              { testID: 'canvas-background', onPress: props.onBackgroundTap },
              'background',
            ),
            ...props.layout.nodes.map((node) =>
              react.createElement(
                native.Text,
                {
                  key: node.id,
                  testID: `node-${node.id}`,
                  onPress: () => props.onSelectNode(node),
                },
                node.id,
              ),
            ),
          );
        },
      ),
    };
  },
);
jest.mock('@/src/components/features/graphs/GraphLegend/GraphLegend', () => ({
  __esModule: true,
  default: (props: {
    items: { id: string; label: string; color: string; hidden?: boolean; onToggle?: () => void }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'legend' },
      ...props.items.map((item) =>
        react.createElement(
          native.Text,
          {
            key: item.id,
            testID: `legend-${item.id}`,
            onPress: item.onToggle,
          },
          JSON.stringify({ label: item.label, color: item.color, hidden: !!item.hidden }),
        ),
      ),
    );
  },
}));
jest.mock('@/src/components/features/graphs/GraphNodeFinder/GraphNodeFinder', () => ({
  __esModule: true,
  default: (props: { options: { id: string; label: string }[]; onPick: (id: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'node-finder' },
      ...props.options.map((option) =>
        react.createElement(
          native.Text,
          { key: option.id, testID: `find-${option.id}`, onPress: () => props.onPick(option.id) },
          option.label,
        ),
      ),
    );
  },
}));
jest.mock('@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => ({
  __esModule: true,
  default: (props: {
    title: string;
    badges?: { label: string }[];
    sections: {
      items: {
        id: string;
        label: string;
        onPress: () => void;
        trailing?: { label: string; onPress: () => void }[];
      }[];
      actions?: { label: string; onPress: () => void }[];
    }[];
    actionLabel: string;
    onAction: () => void;
    onClose: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'node-sheet' },
      react.createElement(native.Text, { testID: 'sheet-title' }, props.title),
      react.createElement(
        native.Text,
        { testID: 'sheet-badges' },
        JSON.stringify((props.badges ?? []).map((badge) => badge.label)),
      ),
      ...props.sections.flatMap((section) => [
        ...section.items.flatMap((item) => [
          react.createElement(
            native.Text,
            { key: item.id, testID: `sheet-item-${item.id}`, onPress: item.onPress },
            item.label,
          ),
          ...(item.trailing ?? []).map((action) =>
            react.createElement(
              native.Text,
              {
                key: `${item.id}-${action.label}`,
                testID: `sheet-row-action-${action.label}`,
                onPress: action.onPress,
              },
              action.label,
            ),
          ),
        ]),
        ...(section.actions ?? []).map((action) =>
          react.createElement(
            native.Text,
            { key: 'section-action', testID: 'sheet-section-action', onPress: action.onPress },
            action.label,
          ),
        ),
      ]),
      react.createElement(
        native.Text,
        { testID: 'sheet-action', onPress: props.onAction },
        props.actionLabel,
      ),
      react.createElement(native.Text, { testID: 'sheet-close', onPress: props.onClose }, 'close'),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: mockIsCompact }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({ getCharactersByStoryId: mockGetCharactersByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/CharacterRelationService', () => ({
  __esModule: true,
  createCharacterRelationService: () => ({
    getCharacterRelationsByStoryId: mockGetCharacterRelationsByStoryId,
    saveCharacterRelation: (...args: unknown[]) => mockSaveRelation(...args),
    deleteCharacterRelation: (...args: unknown[]) => mockDeleteRelation(...args),
  }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => {
  const store = () => ({ userId: 'user-1' });
  store.getState = () => ({ exportFormat: 'svg' });
  return { __esModule: true, useUserSettingsStore: store };
});
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock(
  '@/src/components/features/relations/CharacterRelationManager/CharacterRelationModal',
  () => ({
    __esModule: true,
    default: (props: {
      onClose: () => void;
      onSave: (relatedId: string, type: string, relationId?: string) => void;
      initialRelation: { id: string } | null;
      currentCharacterId: string;
      relatedCharacterIds: string[];
    }) => {
      const react = jest.requireActual('react') as typeof import('react');
      const native = jest.requireActual('react-native') as typeof import('react-native');
      return react.createElement(
        native.View,
        { testID: 'relation-modal' },
        react.createElement(
          native.Text,
          { testID: 'relation-modal-info' },
          JSON.stringify({
            current: props.currentCharacterId,
            related: props.relatedCharacterIds,
            editing: props.initialRelation?.id ?? null,
          }),
        ),
        react.createElement(
          native.Text,
          {
            testID: 'relation-modal-save',
            onPress: () => props.onSave('char-3', 'mentor', props.initialRelation?.id),
          },
          'save',
        ),
        react.createElement(
          native.Text,
          { testID: 'relation-modal-close', onPress: props.onClose },
          'close',
        ),
      );
    },
  }),
);
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#eef',
      surface: '#fafafa',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  ...jest.requireActual('../../../src/utils/storyTransfer'),
  buildCharacterRelationMapFileName: (...args: unknown[]) => mockBuildFileName(...args),
  deliverMapExport: (...args: unknown[]) => mockDeliverMapExport(...args),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT, i18n: { language: mockLanguage } }),
}));

import CharacterRelationGraphScreen from '../../../src/screens/characterrelations/CharacterRelationGraphScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const stamp = new Date('2026-01-01T00:00:00.000Z');

const makeCharacter = (id: string, name: string) => ({
  id,
  storyId: 'story-1',
  name,
  title: null,
  gender: null,
  race: null,
  subrace: null,
  description: null,
  personality: null,
  motivation: null,
  qualities: null,
  weaknesses: null,
  biography: null,
  plannedTimeline: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: stamp,
  updatedAt: stamp,
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const makeRelation = (id: string, character1Id: string, character2Id: string, type = 'ally') => ({
  id,
  storyId: 'story-1',
  character1Id,
  character2Id,
  relationType: type,
  char1Name: character1Id,
  char2Name: character2Id,
});

function graphMarker(view: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(view.getByTestId('graph-marker').props.children as string) as {
    nodes: string[];
    edges: number;
    labels: boolean;
    selected: string | null;
    highlighted: string[];
    focus: string[] | null;
    edgeColors: Record<string, string>;
    labels_a11y: string[];
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCharactersByStoryId.mockReset();
  mockGetCharacterRelationsByStoryId.mockReset();
  mockDeliverMapExport.mockReset();
  mockStory = { id: 'story-1', title: 'Saga' };
  mockCanEdit = true;
  mockSaveRelation.mockReset();
  mockDeleteRelation.mockReset();
  mockSaveRelation.mockResolvedValue({});
  mockDeleteRelation.mockResolvedValue(true);
  mockIsCompact = false;
  mockLanguage = 'en';
  mockGetCharactersByStoryId.mockResolvedValue([
    makeCharacter('char-1', 'Aria'),
    makeCharacter('char-2', 'Bram'),
  ]);
  mockGetCharacterRelationsByStoryId.mockResolvedValue([makeRelation('rel-1', 'char-1', 'char-2')]);
  mockDeliverMapExport.mockResolvedValue({ delivered: true, fileName: 'Saga.svg' });
});

afterEach(() => {
  cleanup();
});

it('renders the map with subtitle and canvas state', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(view.getByText('Saga')).toBeTruthy();
  expect(view.getByText('character_relation_map_subtitle')).toBeTruthy();
  expect(graphMarker(view)).toMatchObject({ nodes: ['char-1', 'char-2'], edges: 1, labels: true });
  expect(view.getByTestId('focus-char-1')).toBeTruthy();
});

it('shows loading, error and empty states', async () => {
  mockGetCharactersByStoryId.mockImplementation(() => new Promise(() => {}));
  const loading = await render(<CharacterRelationGraphScreen />);
  expect(loading.getByTestId('screen-loading')).toBeTruthy();

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockGetCharactersByStoryId.mockRejectedValueOnce(new Error('boom'));
  mockGetCharactersByStoryId.mockResolvedValueOnce([]);
  const failed = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(failed.getByTestId('screen-error')).toBeTruthy());
  await fireEvent.press(failed.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();

  mockGetCharactersByStoryId.mockResolvedValueOnce([]);
  mockGetCharacterRelationsByStoryId.mockResolvedValueOnce([]);
  const empty = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(empty.getByText('character_relation_map_empty')).toBeTruthy());
  consoleSpy.mockRestore();
});

it('selects nodes and walks connections through the sheet', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByTestId('node-char-1'));
  expect(view.getByTestId('node-sheet')).toBeTruthy();
  expect(view.getByTestId('sheet-title').props.children).toBe('Aria');
  expect(view.getByTestId('sheet-item-rel-1')).toBeTruthy();
  expect(graphMarker(view).selected).toBe('char-1');

  await fireEvent.press(view.getByTestId('sheet-item-rel-1'));
  expect(view.getByTestId('sheet-title').props.children).toBe('Bram');

  await fireEvent.press(view.getByTestId('sheet-close'));
  expect(view.queryByTestId('node-sheet')).toBeNull();
  // Closing the details leaves the focus: the author still sees who is around the character.
  expect(graphMarker(view).selected).toBe('char-2');
});

it('opens the character detail from the sheet', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByTestId('node-char-2'));
  await fireEvent.press(view.getByTestId('sheet-action'));
  expect(mockNavigate).toHaveBeenCalledWith('CharactersStack', {
    screen: 'CharacterDetail',
    params: { characterId: 'char-2' },
  });
  expect(view.queryByTestId('node-sheet')).toBeNull();
});

it('badges isolated characters', async () => {
  mockGetCharactersByStoryId.mockResolvedValueOnce([
    makeCharacter('char-1', 'Aria'),
    makeCharacter('char-9', 'Solo'),
  ]);
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByTestId('node-char-9'));
  expect(view.getByTestId('sheet-badges').props.children).toBe(
    '["character_relation_map_badge_isolated"]',
  );
});

it('narrows the map through the focus filter', async () => {
  mockGetCharactersByStoryId.mockResolvedValueOnce([
    makeCharacter('char-1', 'Aria'),
    makeCharacter('char-2', 'Bram'),
    makeCharacter('char-3', 'Cy'),
  ]);
  mockGetCharacterRelationsByStoryId.mockResolvedValueOnce([
    makeRelation('rel-1', 'char-1', 'char-2'),
  ]);
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(graphMarker(view).nodes).toHaveLength(3);

  await fireEvent.press(view.getByTestId('focus-char-1'));
  await waitFor(() => expect(graphMarker(view).nodes).toEqual(['char-1', 'char-2']));
  expect(graphMarker(view).highlighted).toEqual(['char-1']);
  expect(view.getByText('character_relation_map_filter_hint')).toBeTruthy();

  await fireEvent.press(view.getByText('character_relation_map_clear_filter'));
  await waitFor(() => expect(graphMarker(view).nodes).toHaveLength(3));
});

it('drives zoom and fit through the canvas handle', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('character_relation_map_zoom_in'));
  expect(mockZoomBy).toHaveBeenCalledWith(1.25);
  await fireEvent.press(view.getByLabelText('character_relation_map_zoom_out'));
  expect(mockZoomBy).toHaveBeenCalledWith(0.8);
  await fireEvent.press(view.getByLabelText('character_relation_map_fit'));
  expect(mockFitToScreen).toHaveBeenCalled();
});

it('toggles edge labels off and on', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(graphMarker(view).labels).toBe(true);
  await fireEvent.press(view.getByLabelText('character_relation_map_toggle_labels'));
  expect(graphMarker(view).labels).toBe(false);
  await fireEvent.press(view.getByLabelText('character_relation_map_toggle_labels'));
  expect(graphMarker(view).labels).toBe(true);
});

it('exports the map and reports delivery', async () => {
  mockLanguage = 'pt-BR';
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('character_relation_map_export'));
  await waitFor(() => expect(mockDeliverMapExport).toHaveBeenCalled());
  expect(mockBuildFileName).toHaveBeenCalledWith('Saga', expect.any(Date), 'pt');
  expect(mockNotify).toHaveBeenCalledWith('character_relation_map_export_success', 'success');
});

it('warns when the export has no share target', async () => {
  mockDeliverMapExport.mockResolvedValueOnce({ delivered: false, uri: '/tmp/map.svg' });
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('character_relation_map_export'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith(
      'character_relation_map_export_no_share_target',
      'warning',
    ),
  );
});

it('reports export failures', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockDeliverMapExport.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('character_relation_map_export'));
  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith('character_relation_map_export_failed', 'error'),
  );
  consoleSpy.mockRestore();
});

it('reloads only for the current story change event', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  const callsBefore = mockGetCharactersByStoryId.mock.calls.length;

  await act(async () => {
    entityEventEmitter.emit('story_data_changed', { storyId: 'other-story' });
  });
  expect(mockGetCharactersByStoryId.mock.calls.length).toBe(callsBefore);

  await act(async () => {
    entityEventEmitter.emit('story_data_changed', { storyId: 'story-1' });
  });
  await waitFor(() =>
    expect(mockGetCharactersByStoryId.mock.calls.length).toBeGreaterThan(callsBefore),
  );
});

it('lays out compact screens top to bottom', async () => {
  mockIsCompact = true;
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(graphMarker(view).nodes).toEqual(['char-1', 'char-2']);
});

it('focuses the tapped node and its neighbours, and a tap on empty canvas lets go', async () => {
  mockGetCharactersByStoryId.mockResolvedValueOnce([
    makeCharacter('char-1', 'Aria'),
    makeCharacter('char-2', 'Bram'),
    makeCharacter('char-3', 'Cy'),
  ]);
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(graphMarker(view).focus).toBeNull();

  await fireEvent.press(view.getByTestId('node-char-1'));
  expect(graphMarker(view).focus).toEqual(['char-1', 'char-2']);

  await fireEvent.press(view.getByTestId('canvas-background'));
  expect(graphMarker(view).selected).toBeNull();
  expect(graphMarker(view).focus).toBeNull();
  expect(view.queryByTestId('node-sheet')).toBeNull();
});

it('tells a screen reader each node by name and number of relations', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(mockTCalls).toContainEqual(['graph_node_a11y', { name: 'Aria', count: 1 }]);
  expect(mockTCalls).toContainEqual(['graph_node_a11y', { name: 'Bram', count: 1 }]);
});

describe('finding a character by name', () => {
  it('focuses it and frames it with its neighbours, without opening the details', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());

    await fireEvent.press(view.getByTestId('find-char-2'));

    await waitFor(() => expect(graphMarker(view).selected).toBe('char-2'));
    expect(mockFitToRect).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('node-sheet')).toBeNull();
  });

  it('lifts the filter when it hides the character', async () => {
    mockGetCharactersByStoryId.mockResolvedValue([
      makeCharacter('char-1', 'Aria'),
      makeCharacter('char-2', 'Bram'),
      makeCharacter('char-3', 'Cy'),
    ]);
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
    await fireEvent.press(view.getByTestId('focus-char-1'));
    await waitFor(() => expect(graphMarker(view).nodes).toEqual(['char-1', 'char-2']));

    await fireEvent.press(view.getByTestId('find-char-3'));

    await waitFor(() => expect(graphMarker(view).selected).toBe('char-3'));
    expect(graphMarker(view).nodes).toHaveLength(3);
    expect(graphMarker(view).highlighted).toEqual([]);
  });
});

it('offers to centre on the selection only while there is one', async () => {
  const view = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(view.queryByLabelText('center_on_selection')).toBeNull();

  await fireEvent.press(view.getByTestId('node-char-1'));
  await fireEvent.press(view.getByLabelText('center_on_selection'));

  expect(mockFitToRect).toHaveBeenCalledTimes(1);
});

it('frames the new map when the focus filter changes', async () => {
  const view = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(mockFitToScreen).not.toHaveBeenCalled();

  await fireEvent.press(view.getByTestId('focus-char-1'));

  await waitFor(() => expect(mockFitToScreen).toHaveBeenCalledTimes(1));
});

it('says so when the focus filter is full', async () => {
  const many = Array.from({ length: 12 }, (_, i) => makeCharacter(`c${i}`, `Char ${i}`));
  mockGetCharactersByStoryId.mockResolvedValue(many);
  mockGetCharacterRelationsByStoryId.mockResolvedValue([]);
  const view = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());

  for (const character of many) await fireEvent.press(view.getByTestId(`focus-${character.id}`));

  await waitFor(() => expect(graphMarker(view).highlighted).toHaveLength(12));
  expect(mockTCalls).toContainEqual(['graph_focus_limit_hint', { count: 12 }]);
});

it('says how to start when there are characters but no relations', async () => {
  mockGetCharacterRelationsByStoryId.mockResolvedValue([]);
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(view.getByText('character_relation_map_none_yet')).toBeTruthy();
});

it('does not nag about relations once there are some', async () => {
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  expect(view.queryByText('character_relation_map_none_yet')).toBeNull();
});

it('offers to create the first character from the empty map', async () => {
  mockGetCharactersByStoryId.mockResolvedValue([]);
  mockGetCharacterRelationsByStoryId.mockResolvedValue([]);
  const view = await render(<CharacterRelationGraphScreen />);

  await waitFor(() => expect(view.getByText('character_relation_map_empty')).toBeTruthy());
  expect(view.getByText('character_relation_map_empty_hint')).toBeTruthy();
  await fireEvent.press(view.getByText('character_relation_map_empty_action'));

  expect(mockNavigate).toHaveBeenCalledWith('CharactersStack', {
    screen: 'CharacterForm',
    params: { characterId: undefined },
  });
});

it('refreshes in silence: the map stays on screen and keeps its focus', async () => {
  const view = await render(<CharacterRelationGraphScreen />);
  await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
  await fireEvent.press(view.getByTestId('node-char-1'));
  mockGetCharactersByStoryId.mockImplementation(() => new Promise(() => {}));

  await act(async () => {
    entityEventEmitter.emit('story_data_changed', { storyId: 'story-1' });
  });

  expect(view.queryByTestId('screen-loading')).toBeNull();
  expect(view.getByTestId('graph-canvas')).toBeTruthy();
  expect(graphMarker(view).selected).toBe('char-1');
});

describe('the kinds of relation', () => {
  const PALETTE = [
    '#0072B2',
    '#D55E00',
    '#009E73',
    '#CC79A7',
    '#B8860B',
    '#56B4E9',
    '#7A5195',
    '#8C6D31',
  ];

  beforeEach(() => {
    mockGetCharactersByStoryId.mockResolvedValue([
      makeCharacter('char-1', 'Aria'),
      makeCharacter('char-2', 'Bram'),
      makeCharacter('char-3', 'Cy'),
    ]);
    mockGetCharacterRelationsByStoryId.mockResolvedValue([
      makeRelation('rel-1', 'char-1', 'char-2', 'Friend'),
      makeRelation('rel-2', 'char-2', 'char-3', 'friend'),
      makeRelation('rel-3', 'char-1', 'char-3', 'Rival'),
    ]);
  });

  it('are listed in the legend with how many relations each has, the biggest first', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());

    expect(JSON.parse(view.getByTestId('legend-friend').props.children)).toMatchObject({
      label: 'Friend (2)',
      hidden: false,
    });
    expect(JSON.parse(view.getByTestId('legend-rival').props.children)).toMatchObject({
      label: 'Rival (1)',
    });
    const order = view
      .getByTestId('legend')
      .props.children.map((child: { props: { testID: string } }) => child.props.testID);
    expect(order).toEqual(['legend-friend', 'legend-rival']);
  });

  it('get a colour of the palette each, the same one in the legend and on the canvas', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());

    const { edgeColors } = graphMarker(view);
    expect(Object.keys(edgeColors).sort()).toEqual(['friend', 'rival']);
    expect(PALETTE).toContain(edgeColors.friend);
    expect(edgeColors.friend).not.toBe(edgeColors.rival);
    expect(JSON.parse(view.getByTestId('legend-friend').props.children).color).toBe(
      edgeColors.friend,
    );
  });

  it('can be switched off in the legend, and back on', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
    expect(graphMarker(view).edges).toBe(3);

    await fireEvent.press(view.getByTestId('legend-friend'));
    expect(graphMarker(view).edges).toBe(1);
    expect(JSON.parse(view.getByTestId('legend-friend').props.children).hidden).toBe(true);
    // The colours do not move while a kind is off.
    expect(Object.keys(graphMarker(view).edgeColors).sort()).toEqual(['friend', 'rival']);

    await fireEvent.press(view.getByTestId('legend-friend'));
    expect(graphMarker(view).edges).toBe(3);
  });

  it('colour the lines of the exported map too', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('character_relation_map_export'));
    await waitFor(() => expect(mockDeliverMapExport).toHaveBeenCalled());

    const svg = mockDeliverMapExport.mock.calls[0][0] as string;
    expect(PALETTE.some((color) => svg.includes(`stroke="${color}"`))).toBe(true);
  });
});

describe('writing the relation types on a big map', () => {
  const chain = (count: number) => {
    const people = Array.from({ length: count }, (_, i) => makeCharacter(`c${i}`, `Char ${i}`));
    const links = Array.from({ length: count - 1 }, (_, i) =>
      makeRelation(`r${i}`, `c${i}`, `c${i + 1}`),
    );
    mockGetCharactersByStoryId.mockResolvedValue(people);
    mockGetCharacterRelationsByStoryId.mockResolvedValue(links);
  };

  it('writes none while nothing is in focus, and writes the focused one once something is', async () => {
    chain(45);
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
    expect(graphMarker(view).labels).toBe(false);

    await fireEvent.press(view.getByTestId('node-c3'));
    expect(graphMarker(view).labels).toBe(true);

    await fireEvent.press(view.getByTestId('canvas-background'));
    expect(graphMarker(view).labels).toBe(false);
  });

  it('obeys the author when the labels are switched off', async () => {
    chain(45);
    const view = await render(<CharacterRelationGraphScreen />);
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
    // On, then off: an explicit choice wins over the focus.
    await fireEvent.press(view.getByLabelText('character_relation_map_toggle_labels'));
    expect(graphMarker(view).labels).toBe(true);
    await fireEvent.press(view.getByLabelText('character_relation_map_toggle_labels'));
    await fireEvent.press(view.getByTestId('node-c3'));

    expect(graphMarker(view).labels).toBe(false);
  });
});

describe('editing the relations of a character from the map', () => {
  const openSheetOf = async (view: Awaited<ReturnType<typeof render>>, id: string) => {
    await waitFor(() => expect(view.getByTestId('graph-canvas')).toBeTruthy());
    await fireEvent.press(view.getByTestId(`node-${id}`));
  };

  it('offers to add, change and remove only to someone who may edit', async () => {
    mockCanEdit = false;
    const view = await render(<CharacterRelationGraphScreen />);

    await openSheetOf(view, 'char-1');

    expect(view.getByTestId('node-sheet')).toBeTruthy();
    expect(view.queryByTestId('sheet-section-action')).toBeNull();
    expect(view.queryByTestId('sheet-row-action-edit: Bram')).toBeNull();
    expect(view.queryByTestId('sheet-row-action-delete: Bram')).toBeNull();
  });

  it('adds a relation: the details give way to the form of that character', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await openSheetOf(view, 'char-1');

    await fireEvent.press(view.getByTestId('sheet-section-action'));

    expect(view.queryByTestId('node-sheet')).toBeNull();
    expect(JSON.parse(view.getByTestId('relation-modal-info').props.children)).toEqual({
      current: 'char-1',
      related: ['char-2'],
      editing: null,
    });
  });

  it('saves what the form returns, then shows the map again from the data', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await openSheetOf(view, 'char-1');
    await fireEvent.press(view.getByTestId('sheet-section-action'));
    const loadsBefore = mockGetCharacterRelationsByStoryId.mock.calls.length;

    await fireEvent.press(view.getByTestId('relation-modal-save'));

    await waitFor(() => expect(mockSaveRelation).toHaveBeenCalledTimes(1));
    expect(mockSaveRelation.mock.calls[0][0]).toBe('user-1');
    expect(mockSaveRelation.mock.calls[0][1]).toMatchObject({
      storyId: 'story-1',
      character1Id: 'char-1',
      character2Id: 'char-3',
      relationType: 'mentor',
    });
    await waitFor(() =>
      expect(mockGetCharacterRelationsByStoryId.mock.calls.length).toBeGreaterThan(loadsBefore),
    );
    // The map stayed on screen all along.
    expect(view.queryByTestId('screen-loading')).toBeNull();
  });

  it('changes a relation: the form opens on it', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await openSheetOf(view, 'char-1');

    await fireEvent.press(view.getByTestId('sheet-row-action-edit: Bram'));

    expect(JSON.parse(view.getByTestId('relation-modal-info').props.children)).toMatchObject({
      current: 'char-1',
      editing: 'rel-1',
    });
  });

  it('closes the form without writing anything', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await openSheetOf(view, 'char-1');
    await fireEvent.press(view.getByTestId('sheet-section-action'));

    await fireEvent.press(view.getByTestId('relation-modal-close'));

    expect(view.queryByTestId('relation-modal')).toBeNull();
    expect(mockSaveRelation).not.toHaveBeenCalled();
  });

  it('removes a relation only after the author confirms', async () => {
    const view = await render(<CharacterRelationGraphScreen />);
    await openSheetOf(view, 'char-1');

    await fireEvent.press(view.getByTestId('sheet-row-action-delete: Bram'));
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockDeleteRelation).not.toHaveBeenCalled();

    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'delete')!.onPress!());

    expect(mockDeleteRelation).toHaveBeenCalledWith('user-1', 'rel-1');
  });
});
