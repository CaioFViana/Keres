const mockDb = {};
const mockT = (key: string) => key;
const mockGroupService = {
  getChoiceCheckGroupsByChoiceId: jest.fn(),
  createChoiceCheckGroup: jest.fn(),
  updateChoiceCheckGroup: jest.fn(),
  deleteChoiceCheckGroup: jest.fn(),
};
const mockCheckService = {
  getChoiceChecksByGroupId: jest.fn(),
  createChoiceCheck: jest.fn(),
  updateChoiceCheck: jest.fn(),
  deleteChoiceCheck: jest.fn(),
};
const mockAlert = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(() => ({ userId: 'user' })),
}));
jest.mock('../../src/services/storymanagement/ChoiceCheckGroupService', () => ({
  __esModule: true,
  createChoiceCheckGroupService: jest.fn(() => mockGroupService),
}));
jest.mock('../../src/services/storymanagement/ChoiceCheckService', () => ({
  __esModule: true,
  createChoiceCheckService: jest.fn(() => mockCheckService),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useChoiceChecks } from '../../src/hooks/useChoiceChecks';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  mockGroupService.getChoiceCheckGroupsByChoiceId.mockResolvedValue([
    { id: 'group-1', order: 0, combinator: 'AND' },
  ]);
  mockCheckService.getChoiceChecksByGroupId.mockResolvedValue([
    { id: 'check-1', groupId: 'group-1', order: 0, type: 'sceneCount' },
  ]);
  mockGroupService.createChoiceCheckGroup.mockResolvedValue({
    id: 'group-2',
    order: 1,
    combinator: 'AND',
  });
  mockCheckService.createChoiceCheck.mockResolvedValue({
    id: 'check-2',
    groupId: 'group-1',
    order: 1,
    type: 'sceneCount',
  });
  mockCheckService.updateChoiceCheck.mockResolvedValue({
    id: 'check-1',
    groupId: 'group-1',
    order: 0,
    type: 'inventory',
  });
});

describe('useChoiceChecks', () => {
  it('loads groups and their checks, then creates new defaults at the next order', async () => {
    const view = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(view.result.current.checks).toHaveLength(1));
    expect(view.result.current.checkGroups).toHaveLength(1);

    await act(async () => view.result.current.handleAddCheckGroup());
    expect(mockGroupService.createChoiceCheckGroup).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        storyId: 'story',
        choiceId: 'choice',
        combinator: 'AND',
        order: 1,
      }),
    );
    await act(async () => view.result.current.handleAddCheck('group-1'));
    expect(mockCheckService.createChoiceCheck).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        groupId: 'group-1',
        type: 'sceneCount',
        minVisits: null,
        order: 1,
      }),
    );
    expect(() =>
      entityEventEmitter.emit('choice_check_group_changed', 'story', 'choice'),
    ).not.toThrow();
  });

  it('updates dependent fields when the check type changes and removes a group with its checks', async () => {
    const view = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(view.result.current.checks).toHaveLength(1));
    await act(async () => view.result.current.handleChangeCheckType('check-1', 'inventory'));
    expect(mockCheckService.updateChoiceCheck).toHaveBeenCalledWith(
      'user',
      'check-1',
      expect.objectContaining({ type: 'inventory', minVisits: null, itemPresence: 'has' }),
    );

    await act(async () => view.result.current.handleDeleteCheckGroup('group-1'));
    expect(mockCheckService.deleteChoiceCheck).toHaveBeenCalledWith('user', 'check-1');
    expect(mockGroupService.deleteChoiceCheckGroup).toHaveBeenCalledWith('user', 'group-1');
    expect(view.result.current).toMatchObject({ checkGroups: [], checks: [] });
  });

  it('keeps empty state when it is disabled or cannot load', async () => {
    const disabled = await renderHook(() => useChoiceChecks('choice', 'story', false));
    expect(disabled.result.current).toMatchObject({ checkGroups: [], checks: [] });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGroupService.getChoiceCheckGroupsByChoiceId.mockRejectedValueOnce(new Error('offline'));
    const failing = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(mockGroupService.getChoiceCheckGroupsByChoiceId).toHaveBeenCalled());
    expect(failing.result.current).toMatchObject({ checkGroups: [], checks: [] });
  });

  it('clears state without services or ids', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(null);
    const nodb = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await act(async () => {});
    expect(nodb.result.current).toMatchObject({ checkGroups: [], checks: [] });
    expect(mockGroupService.getChoiceCheckGroupsByChoiceId).not.toHaveBeenCalled();

    const noids = await renderHook(() => useChoiceChecks(undefined, undefined, true));
    expect(noids.result.current).toMatchObject({ checkGroups: [], checks: [] });
    (useDrizzle as jest.Mock).mockReturnValue(mockDb);
  });

  it('updates combinators and single checks, and deletes one check at a time', async () => {
    mockGroupService.updateChoiceCheckGroup.mockResolvedValue({
      id: 'group-1',
      order: 0,
      combinator: 'OR',
    });
    const view = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(view.result.current.checks).toHaveLength(1));

    await act(async () => view.result.current.handleUpdateCheckGroupCombinator('group-1', 'OR'));
    expect(view.result.current.checkGroups).toEqual([
      expect.objectContaining({ id: 'group-1', combinator: 'OR' }),
    ]);

    await act(async () => view.result.current.handleUpdateCheck('check-1', { minVisits: 3 }));
    expect(mockCheckService.updateChoiceCheck).toHaveBeenCalledWith('user', 'check-1', {
      minVisits: 3,
    });

    await act(async () => view.result.current.handleDeleteCheck('check-1'));
    expect(mockCheckService.deleteChoiceCheck).toHaveBeenCalledWith('user', 'check-1');
    expect(view.result.current.checks).toEqual([]);
  });

  it('reports every mutation failure with an alert', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(view.result.current.checks).toHaveLength(1));

    mockGroupService.createChoiceCheckGroup.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleAddCheckGroup());
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_check_group');

    mockGroupService.updateChoiceCheckGroup.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleUpdateCheckGroupCombinator('group-1', 'OR'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_check_group');

    mockGroupService.deleteChoiceCheckGroup.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleDeleteCheckGroup('group-1'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_check_group');

    mockCheckService.createChoiceCheck.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleAddCheck('group-1'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_check');

    mockCheckService.updateChoiceCheck.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleUpdateCheck('check-1', { minVisits: 3 }));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_check');

    mockCheckService.deleteChoiceCheck.mockRejectedValueOnce(new Error('offline'));
    await act(async () => view.result.current.handleDeleteCheck('check-1'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_check');
  });

  it('ignores every mutation without a local user', async () => {
    (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: null });
    const view = await renderHook(() => useChoiceChecks('choice', 'story', true));
    await waitFor(() => expect(view.result.current.checks).toHaveLength(1));

    await act(async () => {
      await view.result.current.handleAddCheckGroup();
      await view.result.current.handleUpdateCheckGroupCombinator('group-1', 'OR');
      await view.result.current.handleDeleteCheckGroup('group-1');
      await view.result.current.handleAddCheck('group-1');
      await view.result.current.handleUpdateCheck('check-1', { minVisits: 3 });
      await view.result.current.handleDeleteCheck('check-1');
    });
    expect(mockGroupService.createChoiceCheckGroup).not.toHaveBeenCalled();
    expect(mockGroupService.updateChoiceCheckGroup).not.toHaveBeenCalled();
    expect(mockGroupService.deleteChoiceCheckGroup).not.toHaveBeenCalled();
    expect(mockCheckService.createChoiceCheck).not.toHaveBeenCalled();
    expect(mockCheckService.updateChoiceCheck).not.toHaveBeenCalled();
    expect(mockCheckService.deleteChoiceCheck).not.toHaveBeenCalled();
    (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: 'user' });
  });
});
