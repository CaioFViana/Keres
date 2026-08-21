/**
 * @jest-environment node
 */
jest.mock('../../src/services/AuthTokenManager', () => ({
  authTokenManager: {
    getTokens: jest.fn(),
    refreshAccessToken: jest.fn(),
  },
}));

jest.mock('../../src/utils/jwtUtils', () => ({ isJwtExpired: jest.fn() }));
jest.mock('../../src/services/apiClient', () => ({ isOfflineError: jest.fn() }));
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: jest.fn() },
}));

import type { ServerSelect } from '../../src/db/schema';
import { authTokenManager } from '../../src/services/AuthTokenManager';
import { createServerService } from '../../src/services/ServerService';
import { isOfflineError } from '../../src/services/apiClient';
import { useConnectivityStore } from '../../src/state/connectivityStore';
import { useNotificationStore } from '../../src/state/notificationStore';
import { isJwtExpired } from '../../src/utils/jwtUtils';

const mockGetTokens = authTokenManager.getTokens as jest.Mock;
const mockRefreshAccessToken = authTokenManager.refreshAccessToken as jest.Mock;
const mockIsJwtExpired = isJwtExpired as jest.Mock;
const mockIsOfflineError = isOfflineError as jest.Mock;
const mockGetNotificationState = useNotificationStore.getState as jest.Mock;
const mockShowNotification = jest.fn();

const server = { id: 'server-1', name: 'Principal' } as ServerSelect;
let service: ReturnType<typeof createServerService>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNotificationState.mockReturnValue({ showNotification: mockShowNotification });
  useConnectivityStore.getState().reset();
  service = createServerService({} as never);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('ServerService.refreshServerToken', () => {
  it('leaves an unauthenticated server untouched without notifying on every sync cycle', async () => {
    mockGetTokens.mockResolvedValue(null);

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('does not refresh an access token that is still valid', async () => {
    mockGetTokens.mockResolvedValue({ accessToken: 'valid', refreshToken: 'refresh' });
    mockIsJwtExpired.mockReturnValue(false);

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and reports the success once', async () => {
    mockGetTokens.mockResolvedValue({ accessToken: 'expired', refreshToken: 'refresh' });
    mockIsJwtExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: 'new', refreshToken: 'new-refresh' });

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('server-1', 'refresh');
    expect(mockShowNotification).toHaveBeenCalledWith(
      'Tokens for Principal refreshed successfully.',
      'success',
    );
  });

  it('reports a rejected refresh as an authentication problem', async () => {
    mockGetTokens.mockResolvedValue({ accessToken: 'expired', refreshToken: 'refresh' });
    mockIsJwtExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue(null);

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Token refresh failed for server Principal. Please re-authenticate.',
      'error',
    );
  });

  it('defers a failed refresh while offline without alarming the user', async () => {
    const offline = new Error('offline');
    mockGetTokens.mockResolvedValue({ accessToken: 'expired', refreshToken: 'refresh' });
    mockIsJwtExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockRejectedValue(offline);
    mockIsOfflineError.mockReturnValue(true);

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('does not report "refresh failed" when the server is already known unreachable', async () => {
    // AuthTokenManager.refreshAccessToken swallows an offline failure into a plain `null`
    // return (see its own isOfflineError branch) - the only way refreshServerToken can
    // still tell "offline" from "credentials rejected" apart is by checking connectivityStore,
    // which the request's own interceptor should already have updated before returning.
    useConnectivityStore.getState().reportUnreachable(server.id, server.name);
    mockShowNotification.mockClear(); // Clear the "server_unreachable" call from the line above.

    mockGetTokens.mockResolvedValue({ accessToken: 'expired', refreshToken: 'refresh' });
    mockIsJwtExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue(null);

    await expect(service.refreshServerToken(server)).resolves.toBe(server);

    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});
