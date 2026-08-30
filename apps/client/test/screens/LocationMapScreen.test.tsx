import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockColors = {
  background: '#111',
  border: '#444',
  error: '#f44',
  primary: '#a66cff',
  surface: '#222',
  text: '#fff',
  textSecondary: '#aaa',
};
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: mockColors }),
}));
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      goBack: mockGoBack,
      getParent: () => ({ setOptions: mockSetOptions }),
    }),
    useRoute: () => ({ params: { mapId: 'map-1' } }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../src/state/storyStore', () => {
  const state = { selectedStory: { id: 'story-1' } };
  return {
    __esModule: true,
    useStoryStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
const mockDraftState = { draft: null as unknown, remember: jest.fn(), clear: jest.fn() };
jest.mock('../../src/state/locationMapDraftStore', () => ({
  __esModule: true,
  useLocationMapDraftStore: { getState: () => mockDraftState },
}));

const mockNavigateToEntity = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToEntity,
}));
jest.mock('../../src/hooks/useResolvedMediaUris', () => ({
  __esModule: true,
  useResolvedMediaUris: () => ({}),
}));
jest.mock('../../src/hooks/useLocationMapRelations', () => ({
  __esModule: true,
  useLocationMapRelations: () => ({
    connections: [],
    contains: [],
    nodeConnections: [],
    nodeParent: null,
    nodeChildren: [],
    parentCandidates: [],
    childCandidates: [],
    connectCandidates: [],
    handleAddConnection: jest.fn(),
    handleRemoveConnection: jest.fn(),
    handleSetParent: jest.fn(),
    handleRemoveParent: jest.fn(),
    handleAddChild: jest.fn(),
    handleRemoveRelation: jest.fn(),
  }),
}));

const mockGetById = jest.fn();
const mockGetLocations = jest.fn();
const mockGetGalleries = jest.fn();
const mockGetRelations = jest.fn();
jest.mock('../../src/services/storymanagement/LocationMapService', () => ({
  __esModule: true,
  createLocationMapService: () => ({ getById: mockGetById, updateMap: jest.fn() }),
}));
jest.mock('../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getAllByStoryId: mockGetLocations }),
}));
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({ getGalleriesByStoryId: mockGetGalleries }),
}));
jest.mock('../../src/services/storymanagement/LocationRelationService', () => ({
  __esModule: true,
  createLocationRelationService: () => ({ getAllRelationsForStory: mockGetRelations }),
}));
jest.mock('../../src/utils/boardEntitySummary', () => ({
  __esModule: true,
  loadBoardEntitySummary: jest.fn(async () => ({ title: 'A fortaleza', body: 'Resumo local' })),
}));

let mockCanvasProps: any;
jest.mock('../../src/components/features/location-maps/LocationMapCanvas', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, _ref: unknown) => {
      mockCanvasProps = props;
      return (
        <TouchableOpacity testID="map-select-node" onPress={() => props.onSelectNode('node-1')}>
          <Text>canvas</Text>
        </TouchableOpacity>
      );
    }),
  };
});
jest.mock('../../src/components/features/location-maps/LocationMapTools', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <TouchableOpacity
        testID="map-add-location"
        onPress={() => props.onAddLocations(['location-2'])}
      >
        <Text>add location</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('../../src/components/features/location-maps/LocationMapNodeSheet', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <View>
        <Text>{props.name}</Text>
        <Text>{props.summary?.body ?? 'no summary'}</Text>
        <TouchableOpacity testID="map-open-location" onPress={props.onOpenLocation}>
          <Text>open</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});
jest.mock('../../src/components/features/location-maps/LocationMapImageSheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/features/location-maps/LocationMapHeaderActions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/features/graphs/GraphCanvasControls/GraphCanvasControls', () => ({
  __esModule: true,
  default: () => null,
}));

import LocationMapScreen from '../../src/screens/location-maps/LocationMapScreen';

const map = {
  id: 'map-1',
  name: 'Mapa da fortaleza',
  storyId: 'story-1',
  isDeleted: false,
  content: {
    images: [],
    nodes: [
      {
        id: 'node-1',
        locationId: 'location-1',
        x: 120,
        y: 90,
        icon: 'business-outline',
        color: '#a66cff',
      },
    ],
  },
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockCanvasProps = null;
  mockDraftState.draft = null;
  mockGetById.mockResolvedValue(map);
  mockGetLocations.mockResolvedValue([
    { id: 'location-1', name: 'Fortaleza', isDeleted: false },
    { id: 'location-2', name: 'Porto', isDeleted: false },
  ]);
  mockGetGalleries.mockResolvedValue([]);
  mockGetRelations.mockResolvedValue([]);
});

describe('LocationMapScreen', () => {
  it('loads the map, shows the selected location summary and navigates from its inspector', async () => {
    const view = await render(<LocationMapScreen />);
    await waitFor(() => expect(mockCanvasProps?.nodeNames).toEqual({ 'location-1': 'Fortaleza' }));

    await fireEvent.press(view.getByTestId('map-select-node'));
    await waitFor(() => expect(view.getByText('Resumo local')).toBeTruthy());
    expect(view.getByText('Fortaleza')).toBeTruthy();

    await fireEvent.press(view.getByTestId('map-open-location'));
    expect(mockNavigateToEntity).toHaveBeenCalledWith('Location', 'location-1');
  });

  it('adds a selected location through the map tools without replacing existing nodes', async () => {
    const view = await render(<LocationMapScreen />);
    await waitFor(() => expect(mockCanvasProps?.content.nodes).toHaveLength(1));

    await fireEvent.press(view.getByTestId('map-add-location'));
    await waitFor(() => expect(mockCanvasProps.content.nodes).toHaveLength(2));
    expect(
      mockCanvasProps.content.nodes.map((node: { locationId: string }) => node.locationId),
    ).toEqual(['location-1', 'location-2']);
  });
});
