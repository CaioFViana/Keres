import { act, fireEvent, render } from '@testing-library/react-native';
import OperationLogList from '../../src/components/features/operation-log/OperationLogList/OperationLogList';
import type { OperationLogSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseOperationLogs = jest.fn();
jest.mock('../../src/hooks/useOperationLogs', () => ({
  __esModule: true,
  useOperationLogs: (...args: unknown[]) => mockUseOperationLogs(...args),
}));

// `list-items` belongs to another scope; the list only hands the row its props.
jest.mock('../../src/components/features/list-items/OperationLogListItem', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ log, onPress }: { log: { id: string }; onPress?: (id: string) => void }) =>
      ReactActual.createElement(
        Text,
        { testID: `oplog-${log.id}`, onPress: onPress ? () => onPress(log.id) : undefined },
        log.id,
      ),
  };
});

const log = (overrides: Partial<OperationLogSelect> = {}): OperationLogSelect =>
  ({
    id: 'log-1',
    storyId: 'story-1',
    entityId: 'entity-1',
    isSynced: true,
    serverOperationVersion: 10,
    ...overrides,
  }) as OperationLogSelect;

const hookState = (overrides = {}) => ({
  logs: [],
  loading: false,
  error: null,
  favoriteBehavior: 'individual',
  worldPieceSections: {},
  loadMore: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OperationLogList', () => {
  it('forwards its paging options to the hook', async () => {
    mockUseOperationLogs.mockReturnValue(hookState());
    await render(
      <OperationLogList storyId="story-1" limit={5} paginated pageSize={7} shouldRefetch />,
    );

    expect(mockUseOperationLogs).toHaveBeenCalledWith({
      storyId: 'story-1',
      limit: 5,
      paginated: true,
      pageSize: 7,
      shouldRefetch: true,
    });
  });

  it('shows a spinner while the first page loads', async () => {
    mockUseOperationLogs.mockReturnValue(hookState({ loading: true }));
    const screen = await render(<OperationLogList storyId="story-1" />);

    expect(screen.getByText('loading_operations...')).toBeTruthy();
  });

  it('shows the error it is given', async () => {
    mockUseOperationLogs.mockReturnValue(hookState({ error: 'boom' }));
    const screen = await render(<OperationLogList storyId="story-1" />);

    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('shows the empty state when there is nothing to list', async () => {
    mockUseOperationLogs.mockReturnValue(hookState());
    const screen = await render(<OperationLogList storyId="story-1" />);

    expect(screen.getByText('no_operations_found')).toBeTruthy();
  });

  it('renders every log and forwards taps with the log id', async () => {
    mockUseOperationLogs.mockReturnValue(
      hookState({ logs: [log({ id: 'a' }), log({ id: 'b', serverOperationVersion: 9 })] }),
    );
    const onPressItem = jest.fn();
    const screen = await render(<OperationLogList storyId="story-1" onPressItem={onPressItem} />);

    await fireEvent.press(screen.getByTestId('oplog-a'));
    await fireEvent.press(screen.getByTestId('oplog-b'));

    expect(onPressItem).toHaveBeenCalledWith('a');
    expect(onPressItem).toHaveBeenCalledWith('b');
  });

  it('marks the private gaps between server versions', async () => {
    mockUseOperationLogs.mockReturnValue(
      hookState({
        logs: [
          log({ id: 'a', serverOperationVersion: 10 }),
          log({ id: 'b', serverOperationVersion: 5 }),
        ],
      }),
    );
    const screen = await render(<OperationLogList storyId="story-1" showPrivateGaps />);

    expect(screen.getByText('private_operations_omitted')).toBeTruthy();
    expect(screen.getByText('private_operations_explanation')).toBeTruthy();
  });

  it('stays quiet about gaps when versions run consecutively', async () => {
    mockUseOperationLogs.mockReturnValue(
      hookState({
        logs: [
          log({ id: 'a', serverOperationVersion: 10 }),
          log({ id: 'b', serverOperationVersion: 9 }),
        ],
      }),
    );
    const screen = await render(<OperationLogList storyId="story-1" showPrivateGaps />);

    expect(screen.queryByText('private_operations_omitted')).toBeNull();
    expect(screen.queryByText('private_operations_explanation')).toBeNull();
  });

  it('ignores gaps unless the behavior is individual', async () => {
    mockUseOperationLogs.mockReturnValue(
      hookState({
        favoriteBehavior: 'global',
        logs: [
          log({ id: 'a', serverOperationVersion: 10 }),
          log({ id: 'b', serverOperationVersion: 5 }),
        ],
      }),
    );
    const screen = await render(<OperationLogList storyId="story-1" showPrivateGaps />);

    expect(screen.queryByText('private_operations_omitted')).toBeNull();
  });

  it('ignores unsynced logs when looking for gaps', async () => {
    mockUseOperationLogs.mockReturnValue(
      hookState({
        logs: [log({ id: 'a', serverOperationVersion: 10 }), log({ id: 'b', isSynced: false })],
      }),
    );
    const screen = await render(<OperationLogList storyId="story-1" showPrivateGaps />);

    expect(screen.queryByText('private_operations_omitted')).toBeNull();
  });

  it('pages through a FlatList, loading more at the end', async () => {
    const loadMore = jest.fn();
    mockUseOperationLogs.mockReturnValue(hookState({ logs: [log()], loadMore }));
    const screen = await render(<OperationLogList storyId="story-1" paginated />);

    expect(screen.getByTestId('oplog-log-1')).toBeTruthy();
    // The real FlatList keeps its paging props on the composite, queryable from the container.
    const lists = screen.container.queryAll(
      (node) => Array.isArray(node.props.data) && typeof node.props.onEndReached === 'function',
    );
    expect(lists).not.toHaveLength(0);
    expect(lists[0].props.onEndReachedThreshold).toBe(0.5);
    loadMore.mockClear();
    await act(async () => {
      lists[0].props.onEndReached();
    });

    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
