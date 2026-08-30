/**
 * @jest-environment node
 */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useHasRegisteredServer } from '../../src/hooks/useHasRegisteredServer';
import { createServerService } from '../../src/services/ServerService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const getAllServers = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({});
  (createServerService as jest.Mock).mockReturnValue({ getAllServers });
  getAllServers.mockResolvedValue([]);
});

afterEach(() => jest.restoreAllMocks());

describe('useHasRegisteredServer', () => {
  it('reads the durable server registry rather than a transient active-server selection', async () => {
    getAllServers.mockResolvedValue([{ id: 'server-1' }]);
    const view = await renderHook(() => useHasRegisteredServer());

    await waitFor(() => expect(view.result.current).toBe(true));
  });

  it('refreshes when a server is registered or removed', async () => {
    const view = await renderHook(() => useHasRegisteredServer());
    await waitFor(() => expect(view.result.current).toBe(false));

    getAllServers.mockResolvedValue([{ id: 'server-1' }]);
    entityEventEmitter.emit('server_connection_changed');
    await waitFor(() => expect(view.result.current).toBe(true));
  });

  it('fails closed when the registry cannot be read and stops reacting after unmount', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    getAllServers.mockRejectedValue(new Error('database unavailable'));
    const view = await renderHook(() => useHasRegisteredServer());
    await waitFor(() => expect(view.result.current).toBe(false));

    await view.unmount();
    expect(() => entityEventEmitter.emit('server_connection_changed')).not.toThrow();
  });
});
