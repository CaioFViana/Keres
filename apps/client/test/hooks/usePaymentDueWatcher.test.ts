const mockServers = jest.fn();
const mockLoad = jest.fn();
const mockWarn = jest.fn();

jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: () => ({ getAllServers: (...args: unknown[]) => mockServers(...args) }),
}));
jest.mock('../../src/services/PaymentService', () => ({
  __esModule: true,
  PAYMENTS_CHANGED: 'payments_changed',
  loadPaymentOverview: (...args: unknown[]) => mockLoad(...args),
}));
jest.mock('../../src/services/PaymentWarningService', () => ({
  __esModule: true,
  warnAboutPayment: (...args: unknown[]) => mockWarn(...args),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePaymentDueWatcher } from '../../src/hooks/usePaymentDueWatcher';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const db = {} as never;
const home = { id: 'server-1', name: 'Home' };
const work = { id: 'server-2', name: 'Work' };
const subscription = { tierName: 'Pro', status: 'active' };

beforeEach(() => {
  jest.clearAllMocks();
  useUserSettingsStore.setState({ warnPaymentDue: true });
  mockServers.mockResolvedValue([home, work]);
  mockLoad.mockResolvedValue({ info: { subscription }, plans: null });
  mockWarn.mockResolvedValue(true);
});

/** Mounts the hook and lets its first look finish: effects here are asynchronous. */
const mount = async (database: unknown = db, userId: string | null = 'user-1') => {
  let view!: ReturnType<typeof renderHook>;
  await act(async () => {
    view = renderHook(() => usePaymentDueWatcher(database as never, userId));
  });
  return view;
};

describe('usePaymentDueWatcher', () => {
  it('looks at every server at start-up and reminds about what it finds', async () => {
    await mount();

    await waitFor(() => expect(mockWarn).toHaveBeenCalledTimes(2));
    expect(mockLoad).toHaveBeenCalledWith(home);
    expect(mockLoad).toHaveBeenCalledWith(work);
    expect(mockWarn).toHaveBeenCalledWith(home, subscription, true);
  });

  it('looks at nothing, and asks no server, when the user did not allow reminders', async () => {
    useUserSettingsStore.setState({ warnPaymentDue: false });

    await mount();

    expect(mockServers).not.toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('does nothing before there is a database and a user', async () => {
    await mount(null, 'user-1');
    await mount(db, null);

    expect(mockServers).not.toHaveBeenCalled();
  });

  it('passes a server with no plans, and one that cannot be reached, without a word', async () => {
    mockLoad.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));

    await mount();

    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(home, null, true);
  });

  it('looks again, at that server only, when it says a payment changed', async () => {
    await mount();
    await waitFor(() => expect(mockWarn).toHaveBeenCalledTimes(2));
    mockLoad.mockClear();
    mockWarn.mockClear();

    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'server-2');
    });

    await waitFor(() => expect(mockWarn).toHaveBeenCalledTimes(1));
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenCalledWith(work);
  });

  it('stops listening, and stops looking, when it is unmounted', async () => {
    const { unmount } = await mount();
    await waitFor(() => expect(mockWarn).toHaveBeenCalledTimes(2));
    await act(async () => unmount());
    mockLoad.mockClear();

    await act(async () => {
      entityEventEmitter.emit('payments_changed', 'server-1');
    });

    expect(mockLoad).not.toHaveBeenCalled();
  });
});
