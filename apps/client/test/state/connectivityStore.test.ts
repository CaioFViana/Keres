/**
 * @jest-environment node
 */
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));

jest.mock('../../src/utils/i18n', () => ({ t: (key: string) => key }));

import { useConnectivityStore } from '../../src/state/connectivityStore';

const store = () => useConnectivityStore.getState();

beforeEach(() => {
  store().reset();
  mockShowNotification.mockClear();
});

/**
 * Synchronization runs on a timer: a server that is down fails on every cycle. Warning on every failure
 * buries the user; warning on none leaves them not understanding why nothing saves. That is why the
 * store only speaks on *transitions* - exactly two messages per outage.
 */
describe('reportUnreachable', () => {
  it('announces the first time a server goes down', () => {
    store().reportUnreachable('server-1', 'Casa');

    expect(mockShowNotification).toHaveBeenCalledWith('server_unreachable: Casa', 'warning');
  });

  it('stays quiet on every failure after the first', () => {
    store().reportUnreachable('server-1', 'Casa');
    mockShowNotification.mockClear();

    store().reportUnreachable('server-1', 'Casa');
    store().reportUnreachable('server-1', 'Casa');

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('marks the server as offline', () => {
    store().reportUnreachable('server-1');

    expect(store().isOffline('server-1')).toBe(true);
  });

  it('falls back to a nameless message when the server has no name', () => {
    store().reportUnreachable('server-1');

    expect(mockShowNotification).toHaveBeenCalledWith('server_unreachable', 'warning');
  });
});

describe('reportReachable', () => {
  it('says nothing the first time a server answers after startup', () => {
    store().reportReachable('server-1', 'Casa');

    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(store().isOffline('server-1')).toBe(false);
  });

  it('announces a recovery, and only a recovery', () => {
    store().reportUnreachable('server-1', 'Casa');
    mockShowNotification.mockClear();

    store().reportReachable('server-1', 'Casa');

    expect(mockShowNotification).toHaveBeenCalledWith('server_reconnected: Casa', 'success');
  });

  it('stays quiet while the server keeps answering', () => {
    store().reportReachable('server-1');
    store().reportReachable('server-1');

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('announces again after a second drop and recovery', () => {
    store().reportUnreachable('server-1', 'Casa');
    store().reportReachable('server-1', 'Casa');
    mockShowNotification.mockClear();

    store().reportUnreachable('server-1', 'Casa');
    store().reportReachable('server-1', 'Casa');

    expect(mockShowNotification).toHaveBeenCalledTimes(2);
  });
});

describe('several servers', () => {
  it('tracks each server on its own', () => {
    store().reportUnreachable('server-1');
    store().reportReachable('server-2');

    expect(store().isOffline('server-1')).toBe(true);
    expect(store().isOffline('server-2')).toBe(false);
  });

  it('announces a drop per server', () => {
    store().reportUnreachable('server-1', 'Casa');
    store().reportUnreachable('server-2', 'Trabalho');

    expect(mockShowNotification).toHaveBeenCalledTimes(2);
  });

  it('treats a server it never saw as reachable', () => {
    expect(store().isOffline('nunca-visto')).toBe(false);
  });
});

describe('reset', () => {
  it('forgets every server, so the next report starts a fresh cycle', () => {
    store().reportUnreachable('server-1', 'Casa');

    store().reset();
    mockShowNotification.mockClear();
    store().reportReachable('server-1', 'Casa');

    expect(store().isOffline('server-1')).toBe(false);
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});
