/**
 * @jest-environment node
 */
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  apiUrl: (server: string, endpoint: string) => `${server}/api${endpoint}`,
}));
jest.mock('@keres/shared', () => ({
  __esModule: true,
  APP_RELEASE: { version: '9.9.9-test' },
  canTalkToServer: jest.fn(),
}));

import { canTalkToServer } from '@keres/shared';
import apiClient from '../../src/services/apiClient';
import {
  authenticateWithKeresServer,
  keresAuthAlertMessage,
  type KeresAuthFailure,
} from '../../src/utils/keresServerAuth';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const baseInput = {
  address: 'https://keres.example.com',
  username: 'ana',
  password: 'secret-123',
  isRegistering: false,
  needsAuth: true,
  urlChangedWithoutPassword: false,
  existingUserId: null,
  existingTag: null,
};

const healthyCheck = { status: 200, data: { version: '2.0.0', syncProtocol: { current: 3 } } };

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(healthyCheck);
  (canTalkToServer as jest.Mock).mockReturnValue(true);
});

describe('server probing', () => {
  it('refuses non-Keres answers', async () => {
    mockGet.mockResolvedValueOnce({ status: 404, data: {} });

    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey: 'invalid_keres_server',
    });
    expect(mockGet).toHaveBeenCalledWith(
      'https://keres.example.com/api/kerescheck',
      expect.objectContaining({ timeout: 5000, validateStatus: expect.any(Function) }),
    );
  });

  it('refuses answers without a version string', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: { version: 42 } });

    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey: 'invalid_keres_server',
    });
  });

  it('refuses servers outside the sync protocol with both versions', async () => {
    (canTalkToServer as jest.Mock).mockReturnValueOnce(false);

    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey: 'server_version_mismatch',
      params: { serverVersion: '2.0.0', appVersion: '9.9.9-test' },
    });
    expect(canTalkToServer).toHaveBeenCalledWith({ current: 3 });
  });

  it('requires a password when the URL changed', async () => {
    await expect(
      authenticateWithKeresServer({ ...baseInput, urlChangedWithoutPassword: true }),
    ).resolves.toEqual({ ok: false, alertKey: 'password_required_for_url_change' });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('token reuse', () => {
  it('keeps existing tokens when no authentication is needed', async () => {
    await expect(
      authenticateWithKeresServer({
        ...baseInput,
        needsAuth: false,
        existingUserId: 'user-1',
        existingTag: 'ana',
      }),
    ).resolves.toEqual({
      ok: true,
      accessToken: '',
      refreshToken: '',
      userId: 'user-1',
      tag: 'ana',
      recoveryCodes: null,
      tokensChanged: false,
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('fails when there is no identified user to keep', async () => {
    await expect(authenticateWithKeresServer({ ...baseInput, needsAuth: false })).resolves.toEqual({
      ok: false,
      alertKey: 'user_not_identified_on_server',
    });
  });
});

describe('login and registration', () => {
  const tokens = {
    status: 200,
    data: {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      userId: 'user-1',
      tag: 'ana@1',
      recoveryCodes: ['AAAAA-11111'],
    },
  };

  it('logs in and drops recovery codes outside registration', async () => {
    mockPost.mockResolvedValueOnce(tokens);

    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: true,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      userId: 'user-1',
      tag: 'ana@1',
      recoveryCodes: null,
      tokensChanged: true,
    });
    expect(mockPost).toHaveBeenCalledWith(
      'https://keres.example.com/api/auth/login',
      { username: 'ana', password: 'secret-123' },
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('registers and keeps the recovery codes', async () => {
    mockPost.mockResolvedValueOnce(tokens);

    const result = await authenticateWithKeresServer({ ...baseInput, isRegistering: true });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, recoveryCodes: ['AAAAA-11111'], tokensChanged: true }),
    );
    expect(mockPost).toHaveBeenCalledWith(
      'https://keres.example.com/api/auth/register',
      expect.anything(),
      expect.anything(),
    );
  });

  it('falls back to the existing tag and null codes on odd payloads', async () => {
    mockPost.mockResolvedValueOnce({
      status: 200,
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        userId: 'user-1',
        tag: null,
        recoveryCodes: 'not-a-list',
      },
    });

    await expect(
      authenticateWithKeresServer({ ...baseInput, isRegistering: true, existingTag: 'old' }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, tag: 'old', recoveryCodes: null }));
  });

  it.each([
    [401, 'invalid_credentials'],
    [409, 'user_already_exists'],
    [403, 'registration_closed'],
  ])('maps status %s to %s', async (status, alertKey) => {
    mockPost.mockResolvedValueOnce({ status, data: {} });
    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey,
    });
  });

  it('reports other failures as server errors with the status', async () => {
    mockPost.mockResolvedValueOnce({ status: 500, data: {} });
    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey: 'server_error',
      status: 500,
    });
  });

  it('treats token-less 200 answers as server errors', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { userId: 'user-1' } });
    await expect(authenticateWithKeresServer(baseInput)).resolves.toEqual({
      ok: false,
      alertKey: 'server_error',
      status: 200,
    });
  });
});

describe('keresAuthAlertMessage', () => {
  const t = jest.fn((key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  );

  beforeEach(() => jest.clearAllMocks());

  it('interpolates the version mismatch params', () => {
    const failure: KeresAuthFailure = {
      ok: false,
      alertKey: 'server_version_mismatch',
      params: { serverVersion: '1.0.0', appVersion: '9.9.9-test' },
    };
    expect(keresAuthAlertMessage(t, failure)).toBe(
      'server_version_mismatch:{"serverVersion":"1.0.0","appVersion":"9.9.9-test"}',
    );
  });

  it('appends the status to server errors', () => {
    expect(keresAuthAlertMessage(t, { ok: false, alertKey: 'server_error', status: 500 })).toBe(
      'server_error: 500',
    );
  });

  it('translates plain keys directly', () => {
    expect(keresAuthAlertMessage(t, { ok: false, alertKey: 'invalid_credentials' })).toBe(
      'invalid_credentials',
    );
  });
});
