/**
 * @jest-environment node
 */
const mockGet = jest.fn();

jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
  apiUrl: (base: string, path: string) => `${base}${path}`,
}));

import { pingServer } from '../../src/services/ServerStatusService';

const server = { id: 'srv-1', url: 'https://a.example' } as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pingServer', () => {
  it('finds a server online by its answer to /kerescheck, with its API version', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { version: '1.2.3' } });

    await expect(pingServer(server)).resolves.toMatchObject({
      id: 'srv-1',
      pingStatus: 'online',
      apiVersion: '1.2.3',
    });
    expect(mockGet).toHaveBeenCalledWith(
      'https://a.example/kerescheck',
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it.each([
    ['an error status', { status: 502, data: { version: '1.2.3' } }],
    ['an answer with no version', { status: 200, data: {} }],
    ['an empty answer', { status: 200, data: null }],
  ])('counts a server as offline for %s', async (_name, response) => {
    mockGet.mockResolvedValue(response);

    await expect(pingServer(server)).resolves.toMatchObject({
      pingStatus: 'offline',
      apiVersion: null,
    });
  });

  it('counts a server that does not answer at all as offline, without rejecting', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));

    await expect(pingServer(server)).resolves.toMatchObject({ pingStatus: 'offline' });
  });
});
