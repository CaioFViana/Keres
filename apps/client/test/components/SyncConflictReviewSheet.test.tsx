import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import SyncConflictReviewSheet from '../../src/components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet';
import type { ConflictSummary } from '../../src/services/ConflictSummaryService';
import type { PendingConflict } from '../../src/services/SyncConflictService';

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

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, null, children) : null,
  };
});

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

let mockUserId: string | null = 'user-1';
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: unknown) => unknown) => selector({ userId: mockUserId }),
}));

const mockStore = {
  conflicts: [] as PendingConflict[],
  selectedConflictId: null as string | null,
  selectConflict: jest.fn(),
  clearSelection: jest.fn(),
};
jest.mock('../../src/state/syncConflictStore', () => ({
  __esModule: true,
  useSyncConflictStore: (selector: (state: unknown) => unknown) => selector(mockStore),
}));

let mockSummaries: ConflictSummary[] = [];
jest.mock('../../src/hooks/useConflictReviewData', () => ({
  __esModule: true,
  useConflictReviewData: () => ({ summaries: mockSummaries }),
}));

const mockActions = {
  isResolving: false,
  keepLocal: jest.fn(),
  keepServer: jest.fn(),
  keepServerAndCloneBoard: jest.fn(),
};
jest.mock('../../src/hooks/useSyncConflictActions', () => ({
  __esModule: true,
  useSyncConflictActions: () => mockActions,
}));

const mockRowProps = new Map<string, Record<string, any>>();
jest.mock('../../src/components/features/sync/SyncConflictReviewSheet/ConflictRow', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) => {
      mockRowProps.set(props.summary.id, props);
      return ReactActual.createElement(View, { testID: `conflict-row-${props.summary.id}` });
    },
  };
});

const mockDetailProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/sync/ConflictDetailSheet/ConflictDetailSheet', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockDetailProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'conflict-detail' });
    },
  };
});

const mockDiffProps = { current: null as Record<string, any> | null };
jest.mock(
  '../../src/components/features/sync/ConflictFieldDiffSheet/ConflictFieldDiffSheet',
  () => {
    const ReactActual = require('react');
    const { View } = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: (props: Record<string, unknown>) => {
        mockDiffProps.current = props as Record<string, any>;
        return ReactActual.createElement(View, { testID: 'conflict-diff' });
      },
    };
  },
);

const pendingConflict = (overrides: Record<string, unknown> = {}): PendingConflict =>
  ({
    id: 'conflict-1',
    storyId: 'story-1',
    entityType: 'Character',
    entityId: 'entity-1',
    reason: 'test' as PendingConflict['reason'],
    localOperationType: 'update',
    localOperationIds: [],
    localValues: {},
    serverValues: {},
    clientVersion: 1,
    serverVersion: 2,
    message: null,
    detectedAt: new Date('2024-01-01'),
    contestedFields: [],
    isDeletedOnServer: false,
    isLocalDelete: false,
    ...overrides,
  }) as PendingConflict;

const summaryOf = (overrides: Record<string, unknown> = {}): ConflictSummary =>
  ({
    id: 'conflict-1',
    entityType: 'Character',
    kind: 'content',
    entityLabel: 'Character',
    title: 'Alice',
    detail: 'The name differs.',
    reason: 'test' as ConflictSummary['reason'],
    canQuickResolve: true,
    offerBoardClone: false,
    diffFields: [],
    ...overrides,
  }) as ConflictSummary;

const populated = () => {
  mockStore.conflicts = [pendingConflict(), pendingConflict({ id: 'conflict-2' })];
  mockSummaries = [
    summaryOf({ id: 'conflict-1', kind: 'relation' }),
    summaryOf({ id: 'conflict-2', kind: 'content', title: 'Bob' }),
  ];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-1';
  mockStore.conflicts = [];
  mockStore.selectedConflictId = null;
  mockSummaries = [];
  mockRowProps.clear();
  mockDetailProps.current = null;
  mockDiffProps.current = null;
});

describe('SyncConflictReviewSheet', () => {
  it('renders nothing while hidden', async () => {
    const screen = await render(<SyncConflictReviewSheet visible={false} onClose={jest.fn()} />);

    expect(screen.toJSON()).toBeNull();
  });

  it('says so when there is nothing to review', async () => {
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    expect(screen.getByText('conflict_review_title')).toBeTruthy();
    expect(screen.getByText('conflict_review_empty')).toBeTruthy();
  });

  it('closes the review', async () => {
    const onClose = jest.fn();
    const screen = await render(<SyncConflictReviewSheet visible onClose={onClose} />);

    await fireEvent.press(screen.getByLabelText('conflict_close_review'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('splits relations from content conflicts', async () => {
    populated();
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    expect(screen.getByText('conflict_section_relations')).toBeTruthy();
    expect(screen.getByText('conflict_section_content')).toBeTruthy();
    expect(screen.getByTestId('conflict-row-conflict-1')).toBeTruthy();
    expect(screen.getByTestId('conflict-row-conflict-2')).toBeTruthy();
  });

  it('keeps the local side after the confirmation', async () => {
    populated();
    await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    await act(async () => {
      mockRowProps.get('conflict-1')?.onKeepMine();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'conflict_confirm_title',
      'conflict_confirm_keep_mine',
      expect.any(Array),
    );
    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(mockActions.keepLocal).toHaveBeenCalledWith('conflict-1');
  });

  it('keeps the server side after the destructive confirmation', async () => {
    populated();
    await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    await act(async () => {
      mockRowProps.get('conflict-1')?.onKeepServer();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'conflict_confirm_title',
      'conflict_confirm_keep_server',
      expect.any(Array),
    );
    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(mockActions.keepServer).toHaveBeenCalledWith('conflict-1');
  });

  it('clones the board aside only when there is a user to own the copy', async () => {
    populated();
    mockSummaries = [summaryOf({ offerBoardClone: true })];
    await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    expect(mockRowProps.get('conflict-1')?.onCloneBoard).toEqual(expect.any(Function));
    await act(async () => {
      mockRowProps.get('conflict-1')?.onCloneBoard();
    });
    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(mockActions.keepServerAndCloneBoard).toHaveBeenCalledWith(
      'conflict-1',
      'user-1',
      'board_copy_name',
    );

    mockUserId = null;
    await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);
    expect(mockRowProps.get('conflict-1')?.onCloneBoard).toBeUndefined();
  });

  it('opens the details and resolves from there', async () => {
    populated();
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    await act(async () => {
      mockRowProps.get('conflict-2')?.onOpenDetails();
    });

    expect(screen.getByTestId('conflict-detail')).toBeTruthy();
    expect(mockDetailProps.current?.conflict.id).toBe('conflict-2');
    expect(mockDetailProps.current?.summary.title).toBe('Bob');

    await act(async () => {
      mockDetailProps.current?.onKeepMine();
    });
    await act(async () => {
      mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(mockActions.keepLocal).toHaveBeenCalledWith('conflict-2');
    // Resolving closes the details it came from.
    expect(screen.queryByTestId('conflict-detail')).toBeNull();
  });

  it('closes the details without resolving', async () => {
    populated();
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    await act(async () => {
      mockRowProps.get('conflict-2')?.onOpenDetails();
    });
    expect(screen.getByTestId('conflict-detail')).toBeTruthy();

    await act(async () => {
      mockDetailProps.current?.onClose();
    });
    expect(screen.queryByTestId('conflict-detail')).toBeNull();
  });

  it('drills into the field comparison from the details', async () => {
    populated();
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    await act(async () => {
      mockRowProps.get('conflict-2')?.onOpenDetails();
    });
    await act(async () => {
      mockDetailProps.current?.onCompareFields();
    });

    expect(mockStore.selectConflict).toHaveBeenCalledWith('conflict-2');
    expect(screen.queryByTestId('conflict-detail')).toBeNull();
  });

  it('shows the comparison for the selected conflict and clears it on close', async () => {
    populated();
    mockStore.selectedConflictId = 'conflict-2';
    const screen = await render(<SyncConflictReviewSheet visible onClose={jest.fn()} />);

    expect(screen.getByTestId('conflict-diff')).toBeTruthy();
    expect(mockDiffProps.current?.conflict.id).toBe('conflict-2');
    expect(mockDiffProps.current?.summary.title).toBe('Bob');

    await act(async () => {
      mockDiffProps.current?.onClose();
    });
    expect(mockStore.clearSelection).toHaveBeenCalledTimes(1);
  });
});
