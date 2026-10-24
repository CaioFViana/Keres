/**
 * @jest-environment node
 */
import apiClient from '@/src/services/api/apiClient';
import { fetchAccountRequirement } from '@/src/services/api/AccountRequirementApiService';

jest.mock('@/src/services/api/apiClient', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  apiUrl: (server: string, endpoint: string) => `${server}/api${endpoint}`,
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchAccountRequirement', () => {
  it('reads the public config of the server and answers true when it asks for an account', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: { requireAccountOnboarding: true } });

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(true);
    expect(mockGet).toHaveBeenCalledWith(
      'https://s.example/api/public/config',
      expect.objectContaining({ timeout: 5000, validateStatus: expect.any(Function) }),
    );
  });

  it('answers false when the server does not ask for an account', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: { requireAccountOnboarding: false } });

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(false);
  });

  it('answers false for a server that predates the field', async () => {
    mockGet.mockResolvedValueOnce({ status: 200, data: { someOtherFlag: true } });

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(false);
  });

  it.each([
    ['a text flag', { requireAccountOnboarding: 'true' }],
    ['a numeric flag', { requireAccountOnboarding: 1 }],
    ['a null flag', { requireAccountOnboarding: null }],
    ['an empty answer', null],
  ])('rejects a non-boolean answer (%s)', async (_label, data) => {
    mockGet.mockResolvedValueOnce({ status: 200, data });

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(false);
  });

  it.each([
    [404, { requireAccountOnboarding: true }],
    [500, { requireAccountOnboarding: true }],
    [503, { requireAccountOnboarding: true }],
  ])('answers false for a status %i even when the body says true', async (status, data) => {
    mockGet.mockResolvedValueOnce({ status, data });

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(false);
  });

  it('answers false when the server cannot be reached', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchAccountRequirement('https://s.example')).resolves.toBe(false);
  });
});
