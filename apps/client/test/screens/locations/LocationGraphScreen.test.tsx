import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockShowNotification = jest.fn();
const mockGetAllLocationsByStoryId = jest.fn();
const mockGetAllRelationsForStory = jest.fn();
const mockDeliverMapExport = jest.fn();
const mockZoomBy = jest.fn();
const mockFitToScreen = jest.fn();

let mockIsCompact = false;

const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockT = ((key: string) => key) as (key: string) => string;
const mockDrizzleDb = {};
const mockSelectedStory = { id: 'story-1', title: 'My Story' };
const mockColors = {
  primary: '#0000ff',
  primaryContainer: '#eeeeff',
  onPrimary: '#ffffff',
  background: '#ffffff',
  surface: '#f5f5f5',
  onSurface: '#111111',
  card: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  border: '#dddddd',
  error: '#ff0000',
  success: '#00aa00',
  warning: '#ffaa00',
  info: '#0000ff',
};

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: mockIsCompact }),
}));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getAllByStoryId: mockGetAllLocationsByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/LocationRelationService', () => ({
  __esModule: true,
  createLocationRelationService: () => ({
    getAllRelationsForStory: mockGetAllRelationsForStory,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../src/state/userSettingsStore', () => {
  const store = () => ({ exportFormat: 'png' });
  store.getState = () => ({ exportFormat: 'png' });
  return { __esModule: true, useUserSettingsStore: store };
});
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildLocationGraphMapFileName: (title: string) => `${title}-map.svg`,
  deliverMapExport: (...args: unknown[]) => mockDeliverMapExport(...args),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message?: string }) => (
      <Text testID="screen-loading">{message ?? 'loading'}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      options: { label: string; value: string }[];
      selectedValues: string[];
      onSelectionChange: (next: string[]) => void;
      maxSelections: number;
    }) => (
      <>
        <Text testID="filter-picker">
          {JSON.stringify({
            options: props.options.map((o) => o.label),
            selected: props.selectedValues,
            max: props.maxSelections,
          })}
        </Text>
        <Text
          testID="filter-pick-first"
          onPress={() =>
            props.onSelectionChange(props.options.length > 0 ? [props.options[0].value] : [])
          }
        >
          pick
        </Text>
      </>
    ),
  };
});
jest.mock('../../../src/components/features/graphs/LocationGraph/LocationGraphCanvas', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        props: {
          layout: { nodes: { id: string; location: { name: string } }[]; edges: unknown[] };
          selectedNodeId: string | null;
          highlightedNodeIds: string[];
          onSelectNode: (node: { id: string }) => void;
        },
        ref: React.Ref<{ zoomBy: (factor: number) => void; fitToScreen: () => void }>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          zoomBy: mockZoomBy,
          fitToScreen: mockFitToScreen,
        }));
        return (
          <>
            <Text testID="canvas-marker">
              {JSON.stringify({
                nodes: props.layout.nodes.map((n) => n.id),
                edges: props.layout.edges.length,
                selected: props.selectedNodeId,
                highlighted: props.highlightedNodeIds,
              })}
            </Text>
            {props.layout.nodes.map((node) => (
              <Text
                key={node.id}
                testID={`node-${node.id}`}
                onPress={() => props.onSelectNode(node)}
              >
                {node.location.name}
              </Text>
            ))}
          </>
        );
      },
    ),
  };
});
jest.mock('../../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      title: string;
      badges?: { label: string }[];
      sections: {
        title: string;
        emptyMessage: string;
        items: { id: string; label: string; onPress: () => void }[];
      }[];
      actionLabel: string;
      onAction: () => void;
      onClose: () => void;
    }) => (
      <>
        <Text testID="node-sheet-title">{props.title}</Text>
        <Text testID="node-sheet-badges">
          {(props.badges ?? []).map((badge) => badge.label).join(',')}
        </Text>
        {props.sections.map((section) => (
          <Text key={section.title} testID={`sheet-section-${section.title}`}>
            {section.items.length === 0
              ? section.emptyMessage
              : section.items.map((item) => item.label).join(',')}
          </Text>
        ))}
        <Text testID="node-sheet-first-item" onPress={() => props.sections[0]?.items[0]?.onPress()}>
          first-item
        </Text>
        <Text testID="node-sheet-action" onPress={props.onAction}>
          {props.actionLabel}
        </Text>
        <Text testID="node-sheet-close" onPress={props.onClose}>
          close
        </Text>
      </>
    ),
  };
});
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import LocationGraphScreen from '../../../src/screens/locations/LocationGraphScreen';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeLocation(id: string, name: string) {
  return {
    id,
    storyId: 'story-1',
    name,
    description: null,
    climate: null,
    culture: null,
    politics: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

function makeRelation(id: string, locationAId: string, locationBId: string, relationType: string) {
  return {
    id,
    storyId: 'story-1',
    locationAId,
    locationBId,
    relationType,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

type View = {
  getByTestId: (id: string) => { props: { children: unknown } };
  getByText: (text: string) => unknown;
  getByLabelText: (label: string) => unknown;
};

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('LocationGraphScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCompact = false;
    mockGetAllLocationsByStoryId.mockResolvedValue([
      makeLocation('loc-1', 'Keep'),
      makeLocation('loc-2', 'Harbor'),
      makeLocation('loc-3', 'Tower'),
    ]);
    mockGetAllRelationsForStory.mockResolvedValue([
      makeRelation('rel-1', 'loc-1', 'loc-2', 'contains'),
      makeRelation('rel-2', 'loc-2', 'loc-3', 'connected_to'),
    ]);
    mockDeliverMapExport.mockResolvedValue({
      delivered: true,
      fileName: 'map.svg',
      uri: null,
    });
  });

  it('loads the graph and renders the canvas with the header', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(mockGetAllLocationsByStoryId).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(mockGetAllRelationsForStory).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    expect(view.getByText('My Story')).toBeTruthy();
    expect(jsonOf(view, 'canvas-marker')).toMatchObject({
      nodes: ['loc-2', 'loc-1', 'loc-3'],
      edges: 2,
      selected: null,
      highlighted: [],
    });
    expect(jsonOf(view, 'filter-picker')).toMatchObject({
      options: ['Keep', 'Harbor', 'Tower'],
      selected: [],
      max: 12,
    });
    expect(mockUseScreenHeader).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'location_graph_title' }),
    );
  });

  it('narrows the map through the focus filter and clears it', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByTestId('filter-pick-first'));
    expect(jsonOf(view, 'canvas-marker').highlighted).toEqual(['loc-1']);
    expect(view.getByText('location_graph_filter_hint')).toBeTruthy();
    await fireEvent.press(view.getByText('location_graph_clear_filter'));
    expect(jsonOf(view, 'canvas-marker').highlighted).toEqual([]);
  });

  it('opens the node sheet and navigates to the location', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByTestId('node-loc-2'));
    expect(jsonOf(view, 'canvas-marker').selected).toBe('loc-2');
    expect(view.getByTestId('node-sheet-title').props.children).toBe('Harbor');
    expect(view.getByTestId('sheet-section-parent_location').props.children).toBe('Keep');
    expect(view.getByTestId('sheet-section-connected_locations').props.children).toBe('Tower');
    await fireEvent.press(view.getByTestId('node-sheet-first-item'));
    expect(jsonOf(view, 'canvas-marker').selected).toBe('loc-1');
    await fireEvent.press(view.getByTestId('node-sheet-action'));
    expect(mockNavigate).toHaveBeenCalledWith('LocationDetail', { locationId: 'loc-1' });
  });

  it('closes the node sheet', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByTestId('node-loc-1'));
    expect(view.queryByTestId('node-sheet-title')).not.toBeNull();
    await fireEvent.press(view.getByTestId('node-sheet-close'));
    expect(view.queryByTestId('node-sheet-title')).toBeNull();
  });

  it('drives the canvas camera through the control buttons', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByLabelText('location_graph_zoom_in'));
    expect(mockZoomBy).toHaveBeenCalledWith(1.25);
    await fireEvent.press(view.getByLabelText('location_graph_zoom_out'));
    expect(mockZoomBy).toHaveBeenCalledWith(0.8);
    await fireEvent.press(view.getByLabelText('location_graph_fit'));
    expect(mockFitToScreen).toHaveBeenCalledTimes(1);
  });

  it('exports the map and notifies on success', async () => {
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByLabelText('location_graph_export'));
    await waitFor(() => expect(mockDeliverMapExport).toHaveBeenCalled());
    const [svg, fileName, format] = mockDeliverMapExport.mock.calls[0];
    expect(typeof svg).toBe('string');
    expect((svg as string).includes('<svg')).toBe(true);
    expect(fileName).toBe('My Story-map.svg');
    expect(format).toBe('png');
    expect(mockShowNotification).toHaveBeenCalledWith('location_graph_export_success', 'success');
  });

  it('warns when the export has no share target and errors on failure', async () => {
    mockDeliverMapExport.mockResolvedValueOnce({
      delivered: false,
      fileName: 'map.svg',
      uri: null,
    });
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByTestId('canvas-marker')).not.toBeNull());
    await fireEvent.press(view.getByLabelText('location_graph_export'));
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        'location_graph_export_no_share_target',
        'warning',
      ),
    );

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockDeliverMapExport.mockRejectedValueOnce(new Error('share down'));
    try {
      await fireEvent.press(view.getByLabelText('location_graph_export'));
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith('location_graph_export_failed', 'error'),
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows the empty state without locations', async () => {
    mockGetAllLocationsByStoryId.mockResolvedValue([]);
    mockGetAllRelationsForStory.mockResolvedValue([]);
    const view = await render(<LocationGraphScreen />);
    await waitFor(() => expect(view.queryByText('location_graph_empty')).not.toBeNull());
  });

  it('shows the error state when loading fails', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockGetAllLocationsByStoryId.mockRejectedValue(new Error('db down'));
    try {
      const view = await render(<LocationGraphScreen />);
      await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
      expect(view.getByTestId('screen-error').props.children).toBe('failed_to_load_graph_data');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });
});
