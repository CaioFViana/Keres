/**
 * @jest-environment node
 */
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  apiUrl: (server: string, endpoint: string) => `${server}/api${endpoint}`,
  createKeresAxiosInstance: () => ({
    get: (...args: unknown[]) => mockAuthedGet(...args),
    post: (...args: unknown[]) => mockAuthedPost(...args),
    setTokenProvider: jest.fn(),
    setActiveServer: jest.fn(),
  }),
}));
const mockAuthedGet = jest.fn();
const mockAuthedPost = jest.fn();
jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));

import apiClient from '../../src/services/apiClient';
import {
  AgeVerificationConflictError,
  AgeVerificationUnavailableError,
  fetchAgeVerificationInfo,
  fetchVerificationStatus,
  retryVerification,
} from '../../src/services/AgeVerificationApiService';
import type { ServerSelect } from '../../src/db/schemas/servers';

const mockGet = apiClient.get as jest.Mock;
const server = { id: 'srv-1', url: 'https://s.example' } as unknown as ServerSelect;

const pendingAnswer = {
  status: 'pending',
  action: { kind: 'redirect', url: 'https://verify.example/v/token' },
};

/** A non-2xx answer as axios throws it. */
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchAgeVerificationInfo', () => {
  it('reads the public info of the server, as the contract says it', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: { mode: 'required', available: true } });

    await expect(fetchAgeVerificationInfo('https://s.example')).resolves.toEqual({
      mode: 'required',
      available: true,
    });
    expect(mockGet).toHaveBeenCalledWith(
      'https://s.example/api/age-verification/info',
      expect.objectContaining({ timeout: 5000, validateStatus: expect.any(Function) }),
    );
  });

  it('answers null when the server cannot be reached', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchAgeVerificationInfo('https://s.example')).resolves.toBeNull();
  });

  it('answers null for a server that predates the route', async () => {
    mockGet.mockResolvedValueOnce({ status: 404, data: { message: 'not found' } });

    await expect(fetchAgeVerificationInfo('https://s.example')).resolves.toBeNull();
  });

  it.each([
    ['an unknown mode', { mode: 'maybe', available: true }],
    ['a missing flag', { mode: 'required' }],
    ['a text flag', { mode: 'disabled', available: 'yes' }],
    ['an empty answer', null],
  ])('rejects garbage (%s) instead of trusting it', async (_label, data) => {
    mockGet.mockResolvedValueOnce({ status: 200, data });

    await expect(fetchAgeVerificationInfo('https://s.example')).resolves.toBeNull();
  });
});

describe('fetchVerificationStatus', () => {
  it('reads where the account stands, and the session once it is approved', async () => {
    mockAuthedGet.mockResolvedValueOnce({
      status: 200,
      data: { status: 'approved', session: { accessToken: 'at', refreshToken: 'rt' } },
    });

    await expect(fetchVerificationStatus(server)).resolves.toEqual({
      status: 'approved',
      session: { accessToken: 'at', refreshToken: 'rt' },
    });
    expect(mockAuthedGet).toHaveBeenCalledWith('/auth/verification');
  });

  it('reads a pending answer with what to do next', async () => {
    mockAuthedGet.mockResolvedValueOnce({ status: 200, data: pendingAnswer });

    await expect(fetchVerificationStatus(server)).resolves.toEqual(pendingAnswer);
  });

  it('refuses an unreadable answer', async () => {
    mockAuthedGet.mockResolvedValueOnce({ status: 200, data: { status: 'maybe' } });

    await expect(fetchVerificationStatus(server)).rejects.toThrow('unreadable answer');
  });

  it('maps 503 to the unavailable error', async () => {
    mockAuthedGet.mockRejectedValueOnce(httpError(503));

    await expect(fetchVerificationStatus(server)).rejects.toBeInstanceOf(
      AgeVerificationUnavailableError,
    );
  });

  it('lets a network failure through as it is', async () => {
    const failure = new Error('offline');
    mockAuthedGet.mockRejectedValueOnce(failure);

    await expect(fetchVerificationStatus(server)).rejects.toBe(failure);
  });
});

describe('retryVerification', () => {
  it('sends the documents again and reads the new state', async () => {
    mockAuthedPost.mockResolvedValueOnce({ status: 200, data: pendingAnswer });

    await expect(retryVerification(server, 'pt-BR')).resolves.toEqual(pendingAnswer);
    expect(mockAuthedPost).toHaveBeenCalledWith(
      '/auth/verification/retry',
      undefined,
      expect.objectContaining({ headers: { 'Accept-Language': 'pt-BR' } }),
    );
  });

  it('writes the upload page in the app language, not in the browser language', async () => {
    mockAuthedPost.mockResolvedValueOnce({ status: 200, data: pendingAnswer });

    await retryVerification(server, 'en');

    expect(mockAuthedPost.mock.calls[0][2]).toEqual({ headers: { 'Accept-Language': 'en' } });
  });

  it('falls back to English when the app has no language to send', async () => {
    mockAuthedPost.mockResolvedValueOnce({ status: 200, data: pendingAnswer });

    await retryVerification(server, '');

    expect(mockAuthedPost.mock.calls[0][2]).toEqual({ headers: { 'Accept-Language': 'en' } });
  });

  it('maps 409 to the conflict error: the retry is not allowed now', async () => {
    mockAuthedPost.mockRejectedValueOnce(httpError(409));

    await expect(retryVerification(server, 'en')).rejects.toBeInstanceOf(
      AgeVerificationConflictError,
    );
  });

  it('maps 503 to the unavailable error', async () => {
    mockAuthedPost.mockRejectedValueOnce(httpError(503));

    await expect(retryVerification(server, 'en')).rejects.toBeInstanceOf(
      AgeVerificationUnavailableError,
    );
  });

  it('keeps other failures as they are, so they are not taken for a refusal', async () => {
    mockAuthedPost.mockRejectedValueOnce(httpError(500));

    const error = await retryVerification(server, 'en').catch((failure: unknown) => failure);
    expect(error).not.toBeInstanceOf(AgeVerificationConflictError);
    expect(error).not.toBeInstanceOf(AgeVerificationUnavailableError);
  });
});
