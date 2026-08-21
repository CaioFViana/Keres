/**
 * @jest-environment jsdom
 */
jest.mock('../../src/services/browserCookieSession', () => ({
  usesHttpOnlyCookieSession: jest.fn(),
  hostedApiOrigin: jest.fn(() => 'http://localhost:3000'),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: { getState: () => mockSettings },
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: { setBaseUrl: jest.fn(), setActiveServer: jest.fn() },
}));
jest.mock('../../src/services/ServerService', () => ({
  createServerService: jest.fn(() => ({ createServer: mockCreateServer })),
}));

import axios from 'axios';
import { restoreHostedCookieSession } from '../../src/services/HostedCookieSession';
import { usesHttpOnlyCookieSession } from '../../src/services/browserCookieSession';
import apiClient from '../../src/services/apiClient';

const mockSettings = { setActiveServer: jest.fn() };
const mockCreateServer = jest.fn();
const usesCookie = usesHttpOnlyCookieSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  usesCookie.mockReturnValue(true);
});

it('does nothing outside the hosted cookie session', async () => {
  usesCookie.mockReturnValue(false);
  const db = { query: { servers: { findFirst: jest.fn() } } } as never;
  await expect(restoreHostedCookieSession(db)).resolves.toBeNull();
  expect(mockCreateServer).not.toHaveBeenCalled();
});

it('creates a local server record from GET /auth/me', async () => {
  const created = {
    id: 'server-1',
    url: 'http://localhost:3000',
    idUser: 'user-1',
    userName: 'ana',
    tag: 'ana',
    name: 'localhost:3000',
  };
  mockCreateServer.mockResolvedValueOnce(created);
  const db = { query: { servers: { findFirst: jest.fn(async () => undefined) } } } as never;
  jest.spyOn(axios, 'get').mockResolvedValueOnce({
    status: 200,
    data: { userId: 'user-1', username: 'ana', tag: 'ana' },
  });

  await expect(restoreHostedCookieSession(db)).resolves.toEqual(created);
  expect(mockCreateServer).toHaveBeenCalledWith(
    expect.objectContaining({
      idUser: 'user-1',
      url: 'http://localhost:3000',
    }),
  );
  expect(apiClient.setBaseUrl).toHaveBeenCalledWith('http://localhost:3000');
  expect(mockSettings.setActiveServer).toHaveBeenCalledWith(created);
});

it('ignores a missing session', async () => {
  const db = { query: { servers: { findFirst: jest.fn() } } } as never;
  jest.spyOn(axios, 'get').mockResolvedValueOnce({ status: 401, data: { message: 'Unauthorized' } });
  await expect(restoreHostedCookieSession(db)).resolves.toBeNull();
  expect(mockCreateServer).not.toHaveBeenCalled();
});
