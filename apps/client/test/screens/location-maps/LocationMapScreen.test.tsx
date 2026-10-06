import { cleanup, fireEvent, render } from '@testing-library/react-native';
import LocationMapScreen from '../../../src/screens/location-maps/LocationMapScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

if (!(global as any).requestAnimationFrame) {
  (global as any).requestAnimationFrame = (cb: () => void) => {
    cb();
    return 0;
  };
}

const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockGetMap = jest.fn();
const mockUpdateMap = jest.fn();
const mockHydrate = jest.fn();
const mockRemember = jest.fn();
let mockCanEdit = true;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
  useRoute: () => ({ params: { mapId: 'map-1' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

const mockT = (key: string) => key;
const mockI18n = { language: 'en' };
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: jest.fn(),
}));
jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        background: '#fff',
        surface: '#fff',
        card: '#fff',
        text: '#111',
        textSecondary: '#555',
        border: '#ddd',
        primary: '#00f',
        error: '#f00',
      },
    }),
  };
});

// ---- the heavy children: what the screen decides is what is under test, not how they draw ----
jest.mock('../../../src/components/features/location-maps/LocationMapCanvas', () => {
  const { Text } = require('react-native');
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockCanvas({ content }: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
        viewportWorldCenter: () => ({ x: 80, y: 80 }),
        zoomBy: jest.fn(),
        fitToScreen: jest.fn(),
      }));
      return <Text testID="canvas-nodes">{`nodes:${content.nodes.length}`}</Text>;
    }),
  };
});
jest.mock('../../../src/components/features/location-maps/LocationMapHeaderActions', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ dirty, onRevert, onSave }: any) => (
      <>
        <Text testID="header-dirty">{dirty ? 'dirty' : 'clean'}</Text>
        <Text testID="header-save" onPress={onSave}>
          save
        </Text>
        <Text testID="header-revert" onPress={onRevert}>
          revert
        </Text>
      </>
    ),
  };
});
jest.mock('../../../src/components/features/location-maps/LocationMapTools', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onAddMarker }: any) => (
      <Text testID="tools-add-marker" onPress={onAddMarker}>
        add
      </Text>
    ),
  };
});
jest.mock('../../../src/components/features/location-maps/LocationMapConnectionModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/features/location-maps/LocationMapNodeSheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  '../../../src/components/features/location-maps/LocationMapMarkerConnectionModal',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock('../../../src/components/features/location-maps/LocationMapMarkerSheetSection', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/features/graphs/CanvasOverlay/OverlaySheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../src/components/features/location-maps/TrajectoryPickerSheet', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  '../../../src/components/features/graphs/GraphCanvasControls/GraphCanvasControls',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

// ---- the hooks around the document ----
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: jest.fn(),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: ({ renderActions }: any = {}) => {
    (global as any).__headerActions = renderActions;
  },
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({ role: 'owner', canEdit: mockCanEdit, loading: false }),
}));
jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => jest.fn(),
}));
jest.mock('../../../src/hooks/useLocationMapRelations', () => ({
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
    handleConnectLocations: jest.fn(),
    handleRemoveConnection: jest.fn(),
    handleSetParent: jest.fn(),
    handleSetLocationParent: jest.fn(),
    handleRemoveParent: jest.fn(),
    handleAddChild: jest.fn(),
    handleRemoveRelation: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useLocationMapExport', () => ({
  useLocationMapExport: () => jest.fn(),
}));
jest.mock('../../../src/hooks/useLocationMapImageUris', () => ({
  useLocationMapImageUris: () => ({ galleryMediaById: {}, imageUris: {}, nodeNames: {} }),
}));
jest.mock('../../../src/hooks/useLocationMapNodeSummary', () => ({
  useLocationMapNodeSummary: () => ({ selectedNode: null, selectedNodeSummary: null }),
}));
jest.mock('../../../src/hooks/useLocationMapTrajectories', () => ({
  useLocationMapTrajectories: () => ({
    hasSelection: false,
    setPickerOpen: jest.fn(),
    pickerOpen: false,
    overlays: [],
    offMapCount: 0,
    characters: [],
    items: [],
    routes: [],
    selectedCharacterIds: [],
    selectedItemIds: [],
    routeId: null,
  }),
}));
jest.mock('../../../src/hooks/useCanvasOverlayActions', () => ({
  useCanvasOverlayActions: () => ({
    selectMode: false,
    drawTool: null,
    canFinish: false,
    interactionMode: null,
    draft: null,
    selectedOverlayId: null,
    sheetOverlayId: null,
    finishDraft: jest.fn(),
    cancelDraw: jest.fn(),
    cancelSelect: jest.fn(),
    cancelInteraction: jest.fn(),
    handleObjectsAction: jest.fn(),
    updateOverlay: jest.fn(),
    deleteOverlay: jest.fn(),
    closeOverlaySheet: jest.fn(),
  }),
}));
// "Add marker" is the one edit this test needs: it puts a node into the document through the screen's own setContent.
jest.mock('../../../src/hooks/useLocationMapCanvasActions', () => ({
  useLocationMapCanvasActions: (args: any) => ({
    imageOptions: [],
    locationOptions: [],
    destinationOptions: [],
    addImages: jest.fn(),
    addLocations: jest.fn(),
    addMarker: () =>
      args.setContent((current: any) => ({
        ...current,
        nodes: [
          ...current.nodes,
          { id: `n${current.nodes.length}`, locationId: 'loc-1', x: 0, y: 0 },
        ],
      })),
    handleResizeImageDirect: jest.fn(),
    handleRemoveImage: jest.fn(),
    handleToggleImageLock: jest.fn(),
    handleSelectImage: jest.fn(),
    handleMoveImage: jest.fn(),
    handleSelectNode: jest.fn(),
    handleMoveNode: jest.fn(),
    handleSelectMarker: jest.fn(),
    handleMoveMarker: jest.fn(),
    moveImageLayer: jest.fn(),
    moveNodeLayer: jest.fn(),
    moveMarkerLayer: jest.fn(),
    destinationName: () => null,
    openDestination: jest.fn(),
    createDestination: jest.fn(),
    handleOpenMarkerDestination: jest.fn(),
    handleOpenNodeDestination: jest.fn(),
  }),
}));

// ---- stores, services, the rest ----
jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = { selectedStory: { id: 'story-1', type: 'linear' } };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
jest.mock('../../../src/state/userSettingsStore', () => {
  const state = { userId: 'user-1' };
  const useUserSettingsStore = (selector?: (s: any) => any) =>
    typeof selector === 'function' ? selector(state) : state;
  (useUserSettingsStore as any).getState = () => state;
  return { useUserSettingsStore };
});
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (s: any) => any) => {
    const state = { showNotification: mockNotify };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
jest.mock('../../../src/state/locationMapDraftStore', () => ({
  useLocationMapDraftStore: {
    getState: () => ({ hydrate: mockHydrate, remember: mockRemember }),
  },
}));
jest.mock('../../../src/showcase/showcaseRequest', () => ({
  readShowcaseRequest: () => null,
}));
jest.mock('../../../src/utils/storyTransfer', () => ({
  exportFileLanguage: () => 'en',
}));
jest.mock('../../../src/db', () => {
  const db = {};
  return { useDrizzle: () => db };
});
jest.mock('../../../src/services/storymanagement/LocationMapService', () => ({
  createLocationMapService: () => ({
    getById: mockGetMap,
    updateMap: mockUpdateMap,
    getMapsForStory: jest.fn().mockResolvedValue([]),
  }),
}));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  createLocationService: () => ({ getAllByStoryId: jest.fn().mockResolvedValue([]) }),
}));
jest.mock('../../../src/services/storymanagement/GalleryService', () => ({
  createGalleryService: () => ({ getGalleriesByStoryId: jest.fn().mockResolvedValue([]) }),
}));
jest.mock('../../../src/services/storymanagement/LocationRelationService', () => ({
  createLocationRelationService: () => ({
    getAllRelationsForStory: jest.fn().mockResolvedValue([]),
  }),
}));

const content = (count: number) =>
  ({
    images: [],
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      locationId: 'loc-1',
      x: 0,
      y: 0,
    })),
  }) as any;

const mapRow = (nodes = 0) => ({
  id: 'map-1',
  storyId: 'story-1',
  name: 'Realm',
  content: content(nodes),
  isDeleted: false,
  version: 1,
});

async function open() {
  const view = await render(<LocationMapScreen />);
  await view.findByTestId('canvas-nodes');
  return view;
}

async function headerState() {
  const Actions = (global as any).__headerActions;
  const actions = await render(<>{Actions()}</>);
  return actions;
}

describe('LocationMapScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockCanEdit = true;
    mockGetMap.mockResolvedValue(mapRow());
    mockUpdateMap.mockImplementation(async (_user: string, _id: string, patch: any) => ({
      ...mapRow(),
      ...patch,
    }));
    mockHydrate.mockResolvedValue(null);
  });

  it('shows the not-found error', async () => {
    mockGetMap.mockResolvedValue(null);
    const view = await render(<LocationMapScreen />);

    expect(await view.findByText('location_map_not_found')).toBeTruthy();
  });

  it('shows the load failure', async () => {
    await withSilencedConsole(['log'], async () => {
      mockGetMap.mockRejectedValue(new Error('boom'));
      const view = await render(<LocationMapScreen />);

      expect(await view.findByText('location_map_load_failed')).toBeTruthy();
    });
  });

  it('opens clean, with the tools for an editor', async () => {
    const view = await open();

    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:0');
    expect(view.getByTestId('tools-add-marker')).toBeTruthy();
    expect((await headerState()).getByTestId('header-dirty').props.children).toBe('clean');
  });

  it('gives a reader no tools and no save', async () => {
    mockCanEdit = false;

    const view = await open();

    expect(view.queryByTestId('tools-add-marker')).toBeNull();
    expect((global as any).__headerActions()).toBeNull();
  });

  it('goes dirty on an edit, saves the whole content, and goes clean', async () => {
    const view = await open();
    await fireEvent.press(view.getByTestId('tools-add-marker'));
    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:1');
    const actions = await headerState();
    expect(actions.getByTestId('header-dirty').props.children).toBe('dirty');

    await fireEvent.press(actions.getByTestId('header-save'));

    expect(mockUpdateMap).toHaveBeenCalledWith(
      'user-1',
      'map-1',
      expect.objectContaining({ content: expect.objectContaining({ nodes: expect.any(Array) }) }),
    );
    expect(mockUpdateMap.mock.calls[0][2].content.nodes).toHaveLength(1);
    expect(mockNotify).toHaveBeenCalledWith('location_map_saved', 'success');
    const after = await headerState();
    expect(after.getByTestId('header-dirty').props.children).toBe('clean');
  });

  it('says so, and stays dirty, when saving fails', async () => {
    await withSilencedConsole(['log'], async () => {
      mockUpdateMap.mockRejectedValue(new Error('disk'));
      const view = await open();
      await fireEvent.press(view.getByTestId('tools-add-marker'));
      const actions = await headerState();

      await fireEvent.press(actions.getByTestId('header-save'));

      expect(mockNotify).toHaveBeenCalledWith('location_map_save_failed', 'error');
      expect((await headerState()).getByTestId('header-dirty').props.children).toBe('dirty');
    });
  });

  it('reverts to the last save', async () => {
    const view = await open();
    await fireEvent.press(view.getByTestId('tools-add-marker'));
    const actions = await headerState();

    await fireEvent.press(actions.getByTestId('header-revert'));

    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:0');
  });

  describe('opening a map that was just saved', () => {
    it('does not claim edits were restored: a draft with nothing unsaved is no draft', async () => {
      // What the store still holds after a save and a close: the drawing, equal to what was saved.
      mockGetMap.mockResolvedValue(mapRow(2));
      mockHydrate.mockResolvedValue({
        mapId: 'map-1',
        storyId: 'story-1',
        content: content(2),
        savedContent: content(2),
      });

      const view = await open();

      expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:2');
      expect((await headerState()).getByTestId('header-dirty').props.children).toBe('clean');
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_restored', 'info');
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
    });

    it('shows what the server has now when the saved map moved on and nothing was unsaved', async () => {
      mockGetMap.mockResolvedValue(mapRow(3));
      mockHydrate.mockResolvedValue({
        mapId: 'map-1',
        storyId: 'story-1',
        content: content(2),
        savedContent: content(2),
      });

      const view = await open();

      expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:3');
      expect((await headerState()).getByTestId('header-dirty').props.children).toBe('clean');
      expect(mockNotify).not.toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
    });

    it('still restores real unsaved edits, and stays dirty for them', async () => {
      mockGetMap.mockResolvedValue(mapRow(2));
      mockHydrate.mockResolvedValue({
        mapId: 'map-1',
        storyId: 'story-1',
        content: content(4),
        savedContent: content(2),
      });

      const view = await open();

      expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:4');
      expect((await headerState()).getByTestId('header-dirty').props.children).toBe('dirty');
      expect(mockNotify).toHaveBeenCalledWith('canvas_draft_restored', 'info');
    });

    it('warns, and keeps the unsaved edits, when the saved map moved on under them', async () => {
      mockGetMap.mockResolvedValue(mapRow(5));
      mockHydrate.mockResolvedValue({
        mapId: 'map-1',
        storyId: 'story-1',
        content: content(4),
        savedContent: content(2),
      });

      const view = await open();

      expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:4');
      expect(mockNotify).toHaveBeenCalledWith('canvas_draft_conflicts_with_saved', 'warning');
    });
  });

  it('keeps remembering the draft for the store, against what is saved', async () => {
    await open();

    expect(mockRemember).toHaveBeenCalledWith(
      expect.objectContaining({ mapId: 'map-1', storyId: 'story-1' }),
    );
  });
});
