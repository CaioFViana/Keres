/**
 * @jest-environment node
 */
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  apiUrl: (server: string, endpoint: string) => `${server}/api${endpoint}`,
}));

import apiClient from '../../src/services/apiClient';
import { redeemRecoveryCode } from '../../src/services/AuthApiService';

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('redeemRecoveryCode', () => {
  it('logs the user in with the tokens returned for a valid code', async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        userId: 'user-1',
        username: 'ana',
        tag: 'ana',
      },
    });

    const outcome = await redeemRecoveryCode(
      'https://keres.example.com',
      'ana',
      'AAAAA-11111',
      'new-password-123',
    );

    expect(outcome).toEqual({
      success: true,
      result: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        userId: 'user-1',
        username: 'ana',
        tag: 'ana',
      },
    });
    expect(mockPost).toHaveBeenCalledWith(
      'https://keres.example.com/api/auth/forgot-password',
      { username: 'ana', recoveryCode: 'AAAAA-11111', newPassword: 'new-password-123' },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it('trims the recovery code before sending it', async () => {
    mockPost.mockResolvedValue({ status: 401, data: {} });

    await redeemRecoveryCode('https://keres.example.com', 'ana', '  AAAAA-11111  ', 'pass1234');

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ recoveryCode: 'AAAAA-11111' }),
      expect.anything(),
    );
  });

  it('reports an invalid code as its own outcome, not a thrown error', async () => {
    mockPost.mockResolvedValue({
      status: 401,
      data: { message: 'Invalid username or recovery code.' },
    });

    await expect(
      redeemRecoveryCode('https://keres.example.com', 'ana', 'WRONG-CODE', 'pass1234'),
    ).resolves.toEqual({ success: false, reason: 'invalid_code' });
  });

  it('reports any other non-2xx status as a server_error with the status attached', async () => {
    mockPost.mockResolvedValue({ status: 500, data: {} });

    await expect(
      redeemRecoveryCode('https://keres.example.com', 'ana', 'AAAAA-11111', 'pass1234'),
    ).resolves.toEqual({ success: false, reason: 'server_error', status: 500 });
  });

  it('treats a 200 with an incomplete payload as a server_error too', async () => {
    mockPost.mockResolvedValue({ status: 200, data: { accessToken: 'only-this' } });

    await expect(
      redeemRecoveryCode('https://keres.example.com', 'ana', 'AAAAA-11111', 'pass1234'),
    ).resolves.toEqual({ success: false, reason: 'server_error', status: 200 });
  });
});
