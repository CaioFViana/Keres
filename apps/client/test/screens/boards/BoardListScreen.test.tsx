import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import BoardListScreen from '../../../src/screens/boards/BoardListScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockNotify = jest.fn();
const mockGetBoards = jest.fn();
const mockCreateBoard = jest.fn();
const mockUpdateBoard = jest.fn();
const mockDeleteBoard = jest.fn();
const mockConfirmDelete = jest.fn();
let mockStoryId: string | undefined = 'story-1';
let mockCanEdit = true;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('../../../src/theme', () => ({
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
}));

jest.mock('../../../src/components/features/boards/BoardCreateModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, onCancel, onConfirm, title }: any) =>
      visible ? (
        <>
          <Text testID={title ? 'edit-modal' : 'create-modal'}>open</Text>
          <Text
            testID={title ? 'edit-confirm' : 'create-confirm'}
            onPress={() => onConfirm(title ? 'Renamed' : 'New Board', 'desc')}
          >
            confirm
          </Text>
          <Text testID="modal-cancel" onPress={onCancel}>
            cancel
          </Text>
        </>
      ) : null,
  };
});

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = {
      selectedStory: mockStoryId ? { id: mockStoryId } : null,
      setSelectedStory: jest.fn(),
      activeArcId: null,
      setActiveArcId: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (s: any) => any) => {
    const state = { userId: 'user-1', exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (s: any) => any) => {
    const state = { showNotification: mockNotify };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({
    role: 'owner',
    canEdit: mockCanEdit,
    canManageStoryPolicy: true,
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));
jest.mock('../../../src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...a: any[]) => mockAlert(...a) },
}));
jest.mock('../../../src/services/storymanagement/BoardService', () => ({
  createBoardService: () => ({
    getBoardsForStory: mockGetBoards,
    createBoard: mockCreateBoard,
    updateBoard: mockUpdateBoard,
    deleteBoard: mockDeleteBoard,
  }),
}));

const boards = [
  {
    id: 'board-1',
    name: 'World Map',
    description: 'Continents',
    content: { nodes: [], edges: [] },
  },
  { id: 'board-2', name: 'Factions', description: null, content: { nodes: [], edges: [] } },
];

describe('BoardListScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStoryId = 'story-1';
    mockCanEdit = true;
    mockGetBoards.mockResolvedValue(boards);
    mockCreateBoard.mockResolvedValue({ id: 'board-3' });
    mockUpdateBoard.mockResolvedValue({});
    mockDeleteBoard.mockResolvedValue(undefined);
    mockConfirmDelete.mockImplementation(async ({ onConfirm }: any) => {
      await onConfirm();
    });
  });

  it('shows the load error', async () => {
    mockGetBoards.mockRejectedValue(new Error('boom'));
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('board_load_failed')).toBeTruthy();
  });

  it('lists boards and opens the canvas', async () => {
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    expect(view.getByText('Continents')).toBeTruthy();
    expect(view.getByText('Factions')).toBeTruthy();
    await fireEvent.press(view.getByText('Factions'));
    expect(mockNavigate).toHaveBeenCalledWith('BoardCanvas', { boardId: 'board-2' });
  });

  it('filters boards by search', async () => {
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('board_search_placeholder'), 'faction');
    expect(view.queryByText('World Map')).toBeNull();
    expect(view.getByText('Factions')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('board_search_placeholder'), 'zzz');
    expect(view.getByText('board_search_no_results')).toBeTruthy();
  });

  it('shows the empty state without boards', async () => {
    mockGetBoards.mockResolvedValue([]);
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('board_list_empty')).toBeTruthy();
  });

  it('edits board details', async () => {
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    await fireEvent.press(view.getAllByLabelText('edit')[0]);
    expect(view.getByTestId('edit-modal')).toBeTruthy();
    await fireEvent.press(view.getByTestId('edit-confirm'));
    expect(mockUpdateBoard).toHaveBeenCalledWith('user-1', 'board-1', {
      name: 'Renamed',
      description: 'desc',
    });
  });

  it('duplicates a board after confirmation', async () => {
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    await fireEvent.press(view.getAllByLabelText('duplicate')[0]);
    expect(mockAlert).toHaveBeenCalledWith(
      'board_duplicate_title',
      'board_duplicate_message',
      expect.any(Array),
    );
    await mockAlert.mock.calls[0][2][0].onPress();
    expect(mockCreateBoard).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ storyId: 'story-1' }),
    );
  });

  it('deletes a board through the confirmation', async () => {
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    await fireEvent.press(view.getAllByLabelText('delete')[0]);
    expect(mockConfirmDelete).toHaveBeenCalledWith(
      expect.objectContaining({ titleKey: 'board_delete_title' }),
    );
    expect(mockDeleteBoard).toHaveBeenCalledWith('user-1', 'board-1');
  });

  it('hides edit actions for readers', async () => {
    mockCanEdit = false;
    const view = await render(<BoardListScreen />);
    expect(await view.findByText('World Map')).toBeTruthy();
    expect(view.queryByLabelText('edit')).toBeNull();
    expect(view.queryByLabelText('duplicate')).toBeNull();
    expect(view.queryByLabelText('delete')).toBeNull();
  });
});
