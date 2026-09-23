import { cleanup, fireEvent, render } from '@testing-library/react-native';
import BoardCanvasScreen from '../../../src/screens/boards/BoardCanvasScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

if (!(global as any).requestAnimationFrame) {
  (global as any).requestAnimationFrame = (cb: () => void) => {
    cb();
    return 0;
  };
}

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockOpenEntity = jest.fn();
const mockNotify = jest.fn();
const mockGetBoard = jest.fn();
const mockUpdateBoard = jest.fn();
const mockGetGalleries = jest.fn();
const mockHydrate = jest.fn();
const mockRemember = jest.fn();
const mockLoadSummary = jest.fn();
const mockDeliverExport = jest.fn();
const mockBuildSvg = jest.fn();
let mockRouteParams: any = { boardId: 'board-1' };
let mockStory: any = null;
let mockCanEdit = true;
let mockPinOptions: any = { groupedOptions: [], options: [] };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: () => ({ navigate: mockParentNavigate }),
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

const mockT = (key: string) => key;
const mockI18n = { language: 'en' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: mockI18n }),
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
        primaryContainer: '#ddf',
        onPrimaryContainer: '#001',
        secondary: '#0a0',
        accent: '#a0a',
        error: '#f00',
      },
    }),
  };
});

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ options, groups, selectedValues, onSelectionChange }: any) => {
      const flat = options ?? (groups ?? []).flatMap((g: any) => g.options);
      return (
        <>
          <Text testID="picker-selected">{selectedValues.join(',')}</Text>
          {(flat ?? []).map((o: any) => (
            <Text key={o.value} onPress={() => onSelectionChange([o.value])}>
              {o.label}
            </Text>
          ))}
        </>
      );
    },
  };
});

jest.mock('../../../src/components/features/boards/BoardCanvas', () => {
  const { Text } = require('react-native');
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockBoardCanvas(
      { content, titles, onSelectNode, onConnectNodes }: any,
      ref: any,
    ) {
      React.useImperativeHandle(ref, () => ({
        viewportWorldCenter: () => ({ x: 160, y: 160 }),
        zoomBy: jest.fn(),
        fitToScreen: jest.fn(),
      }));
      return (
        <>
          <Text testID="canvas-nodes">{`nodes:${content.nodes.length}`}</Text>
          <Text testID="canvas-titles">{JSON.stringify(titles)}</Text>
          {content.nodes[0] ? (
            <Text testID="canvas-select-first" onPress={() => onSelectNode(content.nodes[0])}>
              select
            </Text>
          ) : null}
          <Text testID="canvas-connect" onPress={() => onConnectNodes('a', 'b')}>
            connect
          </Text>
        </>
      );
    }),
  };
});

jest.mock('../../../src/components/features/boards/BoardCanvasHeaderActions', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ dirty, onRevert, onSave, onToggleLayout, onToggleConnectionMode }: any) => (
      <>
        <Text testID="header-dirty">{dirty ? 'dirty' : 'clean'}</Text>
        <Text testID="header-save" onPress={onSave}>
          save
        </Text>
        <Text testID="header-revert" onPress={onRevert}>
          revert
        </Text>
        <Text testID="header-layout" onPress={onToggleLayout}>
          layout
        </Text>
        <Text testID="header-connect-mode" onPress={onToggleConnectionMode}>
          connections
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/features/boards/BoardConnectionModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ pair, onClose }: any) => (
      <>
        <Text testID="connection-pair">{`${pair.from}:${pair.to}`}</Text>
        <Text testID="connection-close" onPress={onClose}>
          close
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/features/boards/BoardNodeSheet', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ node, title, typeLabel, onClose, onOpenEntity, onChangeNote }: any) => (
      <>
        <Text testID="node-title">{title}</Text>
        <Text testID="node-type">{typeLabel}</Text>
        <Text testID="node-kind">{node.kind}</Text>
        <Text testID="node-close" onPress={onClose}>
          close
        </Text>
        <Text testID="node-open" onPress={onOpenEntity}>
          open
        </Text>
        <Text testID="node-note" onPress={() => onChangeNote('T', 'B')}>
          note
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/features/graphs/GraphCanvasControls/GraphCanvasControls', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onZoomIn, onZoomOut, onFit, onExport }: any) => (
      <>
        <Text testID="controls-zoom-in" onPress={onZoomIn}>
          in
        </Text>
        <Text testID="controls-zoom-out" onPress={onZoomOut}>
          out
        </Text>
        <Text testID="controls-fit" onPress={onFit}>
          fit
        </Text>
        <Text testID="controls-export" onPress={onExport}>
          export
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = {
      selectedStory: mockStory,
      setSelectedStory: jest.fn(),
      activeArcId: null,
      setActiveArcId: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/userSettingsStore', () => {
  const state = { userId: 'user-1', exportFormat: 'svg' };
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

jest.mock('../../../src/state/boardDraftStore', () => ({
  useBoardDraftStore: { getState: () => ({ hydrate: mockHydrate, remember: mockRemember }) },
}));

jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({
    role: 'owner',
    canEdit: mockCanEdit,
    canManageStoryPolicy: true,
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/hooks/useBoardPinOptions', () => ({
  useBoardPinOptions: () => mockPinOptions,
  decodeBoardPinValue: (value: string) => {
    const separator = value.indexOf(':');
    if (separator < 0) return null;
    return { entityType: value.slice(0, separator), entityId: value.slice(separator + 1) };
  },
}));

jest.mock('../../../src/hooks/useBoardCanvasLayout', () => ({
  useBoardCanvasLayout: () => ({
    handleMoveNode: jest.fn(),
    handleResizeNode: jest.fn(),
    moveNodeLayer: jest.fn(),
  }),
}));

jest.mock('../../../src/utils/boardEntitySummary', () => ({
  loadBoardEntitySummary: (...a: any[]) => mockLoadSummary(...a),
}));

jest.mock('../../../src/utils/entityNavigation', () => ({
  navigateToEntityDetail: jest.fn(),
  toNavigableEntityType: () => 'Character',
}));

jest.mock('../../../src/utils/storyTransfer', () => ({
  deliverMapExport: (...a: any[]) => mockDeliverExport(...a),
  buildBoardMapFileName: () => 'board.svg',
}));

jest.mock('../../../src/utils/storyMapSvgExport', () => ({
  buildStandaloneBoardSvg: (...a: any[]) => mockBuildSvg(...a),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: ({ renderActions }: any = {}) => {
    (global as any).__headerActions = renderActions;
  },
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));
jest.mock('../../../src/db', () => {
  const db = {};
  return { useDrizzle: () => db };
});
jest.mock('../../../src/services/storymanagement/BoardService', () => ({
  createBoardService: () => ({ getById: mockGetBoard, updateBoard: mockUpdateBoard }),
}));
jest.mock('../../../src/services/storymanagement/GalleryService', () => ({
  createGalleryService: () => ({ getGalleriesByStoryId: mockGetGalleries }),
}));

const board = {
  id: 'board-1',
  name: 'World Map',
  content: { nodes: [], edges: [] },
  isDeleted: false,
};

function pinOptions() {
  return {
    groupedOptions: [
      {
        key: 'characters',
        label: 'Characters',
        options: [{ label: 'Ilda', value: 'Character:char-1' }],
      },
    ],
    options: [{ entityType: 'Character', entityId: 'char-1', label: 'Ilda', group: 'character' }],
  };
}

describe('BoardCanvasScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { boardId: 'board-1' };
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockCanEdit = true;
    mockPinOptions = pinOptions();
    mockGetBoard.mockResolvedValue(board);
    mockUpdateBoard.mockImplementation(async (_u: string, _id: string, patch: any) => ({
      ...board,
      ...patch,
    }));
    mockGetGalleries.mockResolvedValue([]);
    mockHydrate.mockResolvedValue(null);
    mockLoadSummary.mockResolvedValue(null);
    mockBuildSvg.mockResolvedValue('<svg/>');
    mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'board.svg' });
  });

  it('shows the not-found error', async () => {
    mockGetBoard.mockResolvedValue(null);
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByText('board_not_found')).toBeTruthy();
  });

  it('shows the load failure', async () => {
    await withSilencedConsole(['log'], async () => {
      mockGetBoard.mockRejectedValue(new Error('boom'));
      const view = await render(<BoardCanvasScreen />);
      expect(await view.findByText('board_load_failed')).toBeTruthy();
    });
  });

  it('renders the canvas with tools for editors', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:0');
    expect(view.getByTestId('action-add-note')).toBeTruthy();
    expect(view.getByTestId('controls-export')).toBeTruthy();
  });

  it('hides tools for readers', async () => {
    mockCanEdit = false;
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    expect(view.queryByTestId('action-add-note')).toBeNull();
  });

  it('adds a note and opens its sheet', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByTestId('action-add-note'));
    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:1');
    await fireEvent.press(view.getByTestId('canvas-select-first'));
    expect(view.getByTestId('node-kind').props.children).toBe('note');
    expect(view.getByTestId('node-title').props.children).toBe('board_note');
    await fireEvent.press(view.getByTestId('node-note'));
    await fireEvent.press(view.getByTestId('node-close'));
    expect(view.queryByTestId('node-title')).toBeNull();
  });

  it('pins an entity from the picker', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByText('Ilda'));
    expect(view.getByTestId('canvas-nodes').props.children).toBe('nodes:1');
    const titles = JSON.parse(view.getByTestId('canvas-titles').props.children as string);
    expect(Object.values(titles)[0]).toMatchObject({ title: 'Ilda' });
  });

  it('selects a node and opens its entity', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByText('Ilda'));
    await fireEvent.press(view.getByTestId('canvas-select-first'));
    expect(view.getByTestId('node-title').props.children).toBe('Ilda');
    await fireEvent.press(view.getByTestId('node-open'));
    expect(mockOpenEntity).toHaveBeenCalledWith('Character', 'char-1');
  });

  it('connects two nodes through the modal', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByTestId('canvas-connect'));
    expect(view.getByTestId('connection-pair').props.children).toBe('a:b');
    await fireEvent.press(view.getByTestId('connection-close'));
    expect(view.queryByTestId('connection-pair')).toBeNull();
  });

  it('exports the board', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByTestId('controls-export'));
    expect(mockBuildSvg).toHaveBeenCalled();
    expect(mockDeliverExport).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('board_export_success', 'success');
  });

  it('saves and reverts through header actions', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByTestId('action-add-note'));
    const Actions = (global as any).__headerActions;
    const actions = await render(<>{Actions()}</>);
    expect(actions.getByTestId('header-dirty').props.children).toBe('dirty');
    await fireEvent.press(actions.getByTestId('header-save'));
    expect(mockUpdateBoard).toHaveBeenCalledWith(
      'user-1',
      'board-1',
      expect.objectContaining({ content: expect.any(Object) }),
    );
    expect(mockNotify).toHaveBeenCalledWith('board_saved', 'success');
    await fireEvent.press(actions.getByTestId('header-revert'));
    await fireEvent.press(actions.getByTestId('header-layout'));
    await fireEvent.press(actions.getByTestId('header-connect-mode'));
    expect(view.getByTestId('canvas-nodes')).toBeTruthy();
  });

  it('alerts when saving fails', async () => {
    await withSilencedConsole(['log'], async () => {
      mockUpdateBoard.mockRejectedValue(new Error('boom'));
      const view = await render(<BoardCanvasScreen />);
      expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
      await fireEvent.press(view.getByTestId('action-add-note'));
      const Actions = (global as any).__headerActions;
      const actions = await render(<>{Actions()}</>);
      await fireEvent.press(actions.getByTestId('header-save'));
      expect(mockNotify).toHaveBeenCalledWith('board_save_failed', 'error');
    });
  });

  it('drives canvas controls', async () => {
    const view = await render(<BoardCanvasScreen />);
    expect(await view.findByTestId('canvas-nodes')).toBeTruthy();
    await fireEvent.press(view.getByTestId('controls-zoom-in'));
    await fireEvent.press(view.getByTestId('controls-zoom-out'));
    await fireEvent.press(view.getByTestId('controls-fit'));
    expect(view.getByTestId('canvas-nodes')).toBeTruthy();
  });
});
