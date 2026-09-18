import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ConflictDetailSheet from '../../src/components/features/sync/ConflictDetailSheet/ConflictDetailSheet';
import ConflictFieldDiffSheet from '../../src/components/features/sync/ConflictFieldDiffSheet/ConflictFieldDiffSheet';
import SyncConflictBanner from '../../src/components/features/sync/SyncConflictBanner/SyncConflictBanner';
import ConflictRow from '../../src/components/features/sync/SyncConflictReviewSheet/ConflictRow';
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
      primaryContainer: '#dde',
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

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, null, children) : null,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) =>
      ReactActual.createElement(
        Text,
        {
          testID: 'stub-button',
          onPress: props.onPress,
          disabled: props.disabled,
          accessibilityLabel: props.accessibilityLabel,
          accessibilityHint: props.accessibilityHint,
        },
        props.children,
      ),
  };
});

jest.mock('../../src/components/common/controls/FormActions/FormActions', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const mockConflictActions = {
  isResolving: false,
  keepLocal: jest.fn(),
  keepServer: jest.fn(),
};
jest.mock('../../src/hooks/useSyncConflictActions', () => ({
  __esModule: true,
  useSyncConflictActions: () => mockConflictActions,
}));

const summary = (overrides: Partial<ConflictSummary> = {}): ConflictSummary => ({
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
});

const conflict = (overrides: Partial<PendingConflict> = {}): PendingConflict =>
  ({
    id: 'conflict-1',
    storyId: 'story-1',
    entityType: 'Character',
    entityId: 'entity-1',
    reason: 'test',
    localOperationType: 'update',
    localOperationIds: [],
    localValues: { name: 'Alicia', age: 30 },
    serverValues: { name: 'Alice', age: 31 },
    clientVersion: 1,
    serverVersion: 2,
    message: null,
    detectedAt: new Date('2024-01-01'),
    contestedFields: ['name', 'age'],
    isDeletedOnServer: false,
    isLocalDelete: false,
    ...overrides,
  }) as PendingConflict;

beforeEach(() => {
  jest.clearAllMocks();
  mockConflictActions.isResolving = false;
});

// Label queries land on the touchable's inner host view, where `disabled` surfaces as
// `accessibilityState` (`onPress`/`disabled` themselves stay on the composite).
const isDisabledAction = (screen: Awaited<ReturnType<typeof render>>, label: string) =>
  expect(screen.getByLabelText(label).props.accessibilityState).toMatchObject({
    disabled: true,
  });

describe('SyncConflictBanner', () => {
  it('stays hidden when there is nothing to review', async () => {
    const screen = await render(<SyncConflictBanner count={0} onPress={jest.fn()} />);

    expect(screen.toJSON()).toBeNull();
  });

  it('summarizes the waiting conflicts and opens the review', async () => {
    const onPress = jest.fn();
    const screen = await render(<SyncConflictBanner count={3} onPress={onPress} />);

    expect(screen.getByText('sync_conflicts_banner')).toBeTruthy();
    await fireEvent.press(screen.getByText('sync_conflicts_banner').parent!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ConflictRow', () => {
  const rowProps = () => ({
    summary: summary(),
    isResolving: false,
    onKeepMine: jest.fn(),
    onKeepServer: jest.fn(),
    onOpenDetails: jest.fn(),
  });

  it('shows the title with its detail line', async () => {
    const screen = await render(<ConflictRow {...rowProps()} />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('The name differs.')).toBeTruthy();
    expect(screen.getByTestId('icon-document-text-outline')).toBeTruthy();
  });

  it('marks relation rows with the network icon', async () => {
    const screen = await render(
      <ConflictRow {...rowProps()} summary={summary({ kind: 'relation' })} />,
    );

    expect(screen.getByTestId('icon-git-network-outline')).toBeTruthy();
  });

  it('resolves simple rows in place', async () => {
    const props = rowProps();
    const screen = await render(<ConflictRow {...props} />);

    await fireEvent.press(screen.getByLabelText('conflict_keep_mine'));
    expect(props.onKeepMine).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('conflict_keep_server'));
    expect(props.onKeepServer).toHaveBeenCalledTimes(1);
  });

  it('offers the board clone only when it applies and is handled', async () => {
    const onCloneBoard = jest.fn();
    const offered = await render(
      <ConflictRow
        {...rowProps()}
        summary={summary({ offerBoardClone: true })}
        onCloneBoard={onCloneBoard}
      />,
    );
    await fireEvent.press(offered.getByLabelText('conflict_clone_board'));
    expect(onCloneBoard).toHaveBeenCalledTimes(1);

    const unhandled = await render(
      <ConflictRow {...rowProps()} summary={summary({ offerBoardClone: true })} />,
    );
    expect(unhandled.queryByLabelText('conflict_clone_board')).toBeNull();

    const plain = await render(<ConflictRow {...rowProps()} onCloneBoard={onCloneBoard} />);
    expect(plain.queryByLabelText('conflict_clone_board')).toBeNull();
  });

  it('sends involved rows to the details instead of quick actions', async () => {
    const props = rowProps();
    const screen = await render(
      <ConflictRow {...props} summary={summary({ canQuickResolve: false })} />,
    );

    expect(screen.queryByLabelText('conflict_keep_mine')).toBeNull();
    await fireEvent.press(screen.getByText('Alice').parent!);
    expect(props.onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('disables everything while another row resolves', async () => {
    const screen = await render(<ConflictRow {...rowProps()} isResolving />);

    isDisabledAction(screen, 'conflict_keep_mine');
    isDisabledAction(screen, 'conflict_keep_server');
  });
});

describe('ConflictDetailSheet', () => {
  const detailProps = () => ({
    conflict: conflict(),
    summary: summary(),
    visible: true,
    isResolving: false,
    onClose: jest.fn(),
    onKeepMine: jest.fn(),
    onKeepServer: jest.fn(),
  });

  it('renders nothing while hidden', async () => {
    const screen = await render(<ConflictDetailSheet {...detailProps()} visible={false} />);

    expect(screen.toJSON()).toBeNull();
  });

  it('explains what happened to which entity', async () => {
    const screen = await render(<ConflictDetailSheet {...detailProps()} />);

    expect(screen.getByText('conflict_details_title')).toBeTruthy();
    expect(screen.getByText('Character — Alice')).toBeTruthy();
    expect(screen.getByText('conflict_what_happened')).toBeTruthy();
    expect(screen.getByText('conflict_reason_test')).toBeTruthy();
    expect(screen.getByText('conflict_choose_action')).toBeTruthy();
  });

  it('keeps either side from its action', async () => {
    const props = detailProps();
    const screen = await render(<ConflictDetailSheet {...props} />);

    await fireEvent.press(
      screen.getByLabelText('conflict_keep_mine. conflict_keep_mine_description'),
    );
    expect(props.onKeepMine).toHaveBeenCalledTimes(1);

    await fireEvent.press(
      screen.getByLabelText('conflict_keep_server. conflict_keep_server_description'),
    );
    expect(props.onKeepServer).toHaveBeenCalledTimes(1);
  });

  it('offers the board clone only when it applies and is handled', async () => {
    const onCloneBoard = jest.fn();
    const offered = await render(
      <ConflictDetailSheet
        {...detailProps()}
        summary={summary({ offerBoardClone: true })}
        onCloneBoard={onCloneBoard}
      />,
    );
    await fireEvent.press(
      offered.getByLabelText('conflict_clone_board. conflict_clone_board_description'),
    );
    expect(onCloneBoard).toHaveBeenCalledTimes(1);

    const plain = await render(
      <ConflictDetailSheet
        {...detailProps()}
        summary={summary({ offerBoardClone: true })}
        onCloneBoard={undefined}
      />,
    );
    expect(
      plain.queryByLabelText('conflict_clone_board. conflict_clone_board_description'),
    ).toBeNull();
  });

  it('offers the field comparison only when there is something to compare', async () => {
    const onCompareFields = jest.fn();
    const involved = await render(
      <ConflictDetailSheet
        {...detailProps()}
        summary={summary({ canQuickResolve: false })}
        onCompareFields={onCompareFields}
      />,
    );
    await fireEvent.press(
      involved.getByLabelText('conflict_compare_fields. conflict_compare_fields_description'),
    );
    expect(onCompareFields).toHaveBeenCalledTimes(1);

    const simple = await render(
      <ConflictDetailSheet {...detailProps()} onCompareFields={onCompareFields} />,
    );
    expect(
      simple.queryByLabelText('conflict_compare_fields. conflict_compare_fields_description'),
    ).toBeNull();
  });

  it('disables the actions while resolving and still closes', async () => {
    const props = detailProps();
    const screen = await render(<ConflictDetailSheet {...props} isResolving />);

    isDisabledAction(screen, 'conflict_keep_mine. conflict_keep_mine_description');

    await fireEvent.press(screen.getByLabelText('conflict_close_details'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConflictFieldDiffSheet', () => {
  const diffSummary = () =>
    summary({
      canQuickResolve: false,
      diffFields: [
        { field: 'name', label: 'Name', localDisplay: 'Alicia', serverDisplay: 'Alice' },
        { field: 'age', label: 'Age', localDisplay: '30', serverDisplay: '31' },
      ],
    });
  const diffProps = () => ({
    conflict: conflict(),
    summary: diffSummary(),
    visible: true,
    onClose: jest.fn(),
  });

  it('renders nothing while hidden', async () => {
    const screen = await render(<ConflictFieldDiffSheet {...diffProps()} visible={false} />);

    expect(screen.toJSON()).toBeNull();
  });

  it('defaults every field to the local side', async () => {
    const screen = await render(<ConflictFieldDiffSheet {...diffProps()} />);

    expect(screen.getByText('conflict_choose_per_field')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Alicia')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByLabelText('conflict_keep_mine')).toBeTruthy();
  });

  it('becomes a merge as soon as one field comes from the server', async () => {
    const screen = await render(<ConflictFieldDiffSheet {...diffProps()} />);

    await fireEvent.press(screen.getByLabelText('Name: conflict_side_server. Alice'));

    expect(screen.getByLabelText('conflict_apply_merge')).toBeTruthy();
  });

  it('merges the chosen values after the confirmation', async () => {
    const props = diffProps();
    const screen = await render(<ConflictFieldDiffSheet {...props} />);

    await fireEvent.press(screen.getByLabelText('Name: conflict_side_server. Alice'));
    await fireEvent.press(screen.getByLabelText('conflict_apply_merge'));

    expect(mockAlert).toHaveBeenCalledWith(
      'conflict_confirm_title',
      'conflict_confirm_keep_mine',
      expect.any(Array),
    );
    await act(async () => {
      await mockAlert.mock.calls[0][2][1].onPress();
    });

    expect(mockConflictActions.keepLocal).toHaveBeenCalledWith('conflict-1', {
      name: 'Alice',
      age: 30,
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps everything local when no field was switched', async () => {
    const props = diffProps();
    const screen = await render(<ConflictFieldDiffSheet {...props} />);

    await fireEvent.press(screen.getByLabelText('conflict_keep_mine'));
    await act(async () => {
      await mockAlert.mock.calls[0][2][1].onPress();
    });

    expect(mockConflictActions.keepLocal).toHaveBeenCalledWith('conflict-1', undefined);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the server side after the destructive confirmation', async () => {
    const props = diffProps();
    const screen = await render(<ConflictFieldDiffSheet {...props} />);

    await fireEvent.press(screen.getByLabelText('conflict_keep_server'));
    expect(mockAlert).toHaveBeenCalledWith(
      'conflict_confirm_title',
      'conflict_confirm_keep_server',
      expect.any(Array),
    );

    await act(async () => {
      await mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(mockConflictActions.keepServer).toHaveBeenCalledWith('conflict-1');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('starts over from local when another conflict is opened', async () => {
    const props = diffProps();
    const screen = await render(<ConflictFieldDiffSheet {...props} />);

    await fireEvent.press(screen.getByLabelText('Name: conflict_side_server. Alice'));
    expect(screen.getByLabelText('conflict_apply_merge')).toBeTruthy();

    await screen.rerender(
      <ConflictFieldDiffSheet {...props} conflict={conflict({ id: 'conflict-2' })} />,
    );
    expect(screen.getByLabelText('conflict_keep_mine')).toBeTruthy();
  });

  it('disables the footer while resolving', async () => {
    mockConflictActions.isResolving = true;
    const screen = await render(<ConflictFieldDiffSheet {...diffProps()} />);

    expect(screen.getByLabelText('conflict_keep_mine').props.disabled).toBe(true);
    expect(screen.getByLabelText('conflict_keep_server').props.disabled).toBe(true);
  });
});
