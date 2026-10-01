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
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
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
            onSelectNode: (node: { id: string }) => void;
          },
          ref: React.Ref<{ zoomBy: unknown; fitToScreen: unknown }>,
        ) => {
          const native = jest.requireActual('react-native') as typeof import('react-native');
          react.useImperativeHandle(ref, () => ({
            zoomBy: mockZoomBy,
            fitToScreen: mockFitToScreen,
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
              }),
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
jest.mock('@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => ({
  __esModule: true,
  default: (props: {
    title: string;
    badges?: { label: string }[];
    sections: { items: { id: string; label: string; onPress: () => void }[] }[];
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
      ...props.sections.flatMap((section) =>
        section.items.map((item) =>
          react.createElement(
            native.Text,
            { key: item.id, testID: `sheet-item-${item.id}`, onPress: item.onPress },
            item.label,
          ),
        ),
      ),
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
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: { getState: () => ({ exportFormat: 'svg' }) },
}));
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
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCharactersByStoryId.mockReset();
  mockGetCharacterRelationsByStoryId.mockReset();
  mockDeliverMapExport.mockReset();
  mockStory = { id: 'story-1', title: 'Saga' };
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
