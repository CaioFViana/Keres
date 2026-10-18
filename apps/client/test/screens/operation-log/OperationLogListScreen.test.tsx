/** @jest-environment node */
import { act, render } from '@testing-library/react-native';
import OperationLogScreen from '@/src/screens/operation-log/OperationLogListScreen';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseStoryStore = jest.fn();
const mockRenderList = jest.fn();
const mockUseScreenTour = jest.fn();

jest.mock('@/src/hooks/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@/src/hooks/nav/useScreenHeader', () => ({ useScreenHeader: () => {} }));
jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('@/src/theme', () => ({
  useTheme: () => ({ colors: { textSecondary: '#666' } }),
}));
jest.mock('@/src/theme/commonStyles', () => ({
  commonScreenStyleDefs: () => ({ container: { flex: 1 } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('@/src/state/story/storyStore', () => ({
  useStoryStore: (...args: unknown[]) => mockUseStoryStore(...args),
}));
jest.mock('@/src/components/features/operation-log/OperationLogList/OperationLogList', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockRenderList(props);
    return null;
  },
}));

const lastListProps = () => mockRenderList.mock.calls[mockRenderList.mock.calls.length - 1][0];

beforeEach(() => {
  jest.clearAllMocks();
});

it('requests its guided tour', async () => {
  mockUseStoryStore.mockReturnValue({ selectedStory: { id: 'story-1' } });
  await render(<OperationLogScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('OperationLogStack');
});

it('asks for a story instead of rendering the log list', async () => {
  mockUseStoryStore.mockReturnValue({ selectedStory: null });
  const screen = await render(<OperationLogScreen />);

  expect(await screen.findByText('no_story_selected')).toBeTruthy();
  expect(mockRenderList).not.toHaveBeenCalled();
});

it('renders the paginated log list for the selected story', async () => {
  mockUseStoryStore.mockReturnValue({ selectedStory: { id: 'story-1' } });
  await render(<OperationLogScreen />);

  expect(lastListProps()).toMatchObject({
    storyId: 'story-1',
    paginated: true,
    pageSize: 20,
    showPrivateGaps: true,
    shouldRefetch: false,
  });
});

it('opens the tapped log entry in the detail screen', async () => {
  mockUseStoryStore.mockReturnValue({ selectedStory: { id: 'story-1' } });
  await render(<OperationLogScreen />);

  await act(async () => {
    lastListProps().onPressItem('log-9');
  });

  expect(mockNavigate).toHaveBeenCalledWith('OperationLogStack', {
    screen: 'OperationLogDetail',
    params: { logId: 'log-9' },
  });
});

it('refetches only when the current story reports an update', async () => {
  mockUseStoryStore.mockReturnValue({ selectedStory: { id: 'story-1' } });
  await render(<OperationLogScreen />);
  expect(lastListProps().shouldRefetch).toBe(false);

  await act(async () => {
    entityEventEmitter.emit('operation_log_updated', 'story-1');
  });
  expect(lastListProps().shouldRefetch).toBe(true);

  await act(async () => {
    entityEventEmitter.emit('operation_log_updated', 'other-story');
  });
  expect(lastListProps().shouldRefetch).toBe(true);

  await act(async () => {
    entityEventEmitter.emit('operation_log_updated', 'story-1');
  });
  expect(lastListProps().shouldRefetch).toBe(false);
});
