/**
 * @jest-environment node
 */
// `__esModule` importa aqui pelo mesmo motivo do mock em `TokenVault.test.ts`: sem a marca, o
// interop do Babel entrega o mock inteiro como `default` e os imports nomeados vêm undefined.
jest.mock('../../src/services/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
  updateClientSettings: jest.fn(),
}));

import * as ClientSettingsService from '../../src/services/ClientSettingsService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const mockClientSettings = ClientSettingsService as unknown as {
  getClientSettings: jest.Mock;
  updateClientSettings: jest.Mock;
};

const store = () => useUserSettingsStore.getState();
const db = {} as never;
const server = { id: 'server-1', name: 'Casa', url: 'http://servidor' } as never;

const SETTINGS = { id: 'local-user-1', localUsername: 'ana', language: 'pt-BR' };

beforeEach(() => {
  jest.clearAllMocks();
  store().resetSettings();
  mockClientSettings.getClientSettings.mockResolvedValue(null);
  mockClientSettings.updateClientSettings.mockResolvedValue(undefined);
});

/**
 * O `userId` daqui é a identidade local do autor - é o que diferencia os favoritos de cada
 * pessoa numa história compartilhada e o que assina cada operação no log. Vir nulo faz o app
 * gravar favoritos sem dono.
 */
describe('initializeSettings', () => {
  it('loads the local identity, name and language from the database', async () => {
    mockClientSettings.getClientSettings.mockResolvedValue(SETTINGS);

    const settings = await store().initializeSettings(db);

    expect(store()).toMatchObject({ userId: 'local-user-1', username: 'ana', language: 'pt-BR' });
    expect(settings).toEqual(SETTINGS);
  });

  it('leaves the state untouched when there are no settings yet', async () => {
    const settings = await store().initializeSettings(db);

    expect(settings).toBeNull();
    expect(store()).toMatchObject({ userId: null, username: null, language: null });
  });

  it('does not clear the active server, which is session state and not a stored setting', async () => {
    store().setActiveServer(server);
    mockClientSettings.getClientSettings.mockResolvedValue(SETTINGS);

    await store().initializeSettings(db);

    expect(store().activeServer).toEqual(server);
  });
});

describe('setUsername', () => {
  it('persists before updating what the screens read', async () => {
    await store().setUsername(db, 'nova-ana');

    expect(mockClientSettings.updateClientSettings).toHaveBeenCalledWith(db, {
      localUsername: 'nova-ana',
    });
    expect(store().username).toBe('nova-ana');
  });

  it('does not update the state when the write fails', async () => {
    mockClientSettings.updateClientSettings.mockRejectedValueOnce(new Error('banco fora'));

    await expect(store().setUsername(db, 'nova-ana')).rejects.toThrow();
    expect(store().username).toBeNull();
  });

  it('leaves the local identity alone', async () => {
    mockClientSettings.getClientSettings.mockResolvedValue(SETTINGS);
    await store().initializeSettings(db);

    await store().setUsername(db, 'nova-ana');

    expect(store().userId).toBe('local-user-1');
  });
});

describe('setLanguage', () => {
  it('persists before updating what the screens read', async () => {
    await store().setLanguage(db, 'en');

    expect(mockClientSettings.updateClientSettings).toHaveBeenCalledWith(db, { language: 'en' });
    expect(store().language).toBe('en');
  });

  it('does not update the state when the write fails', async () => {
    mockClientSettings.updateClientSettings.mockRejectedValueOnce(new Error('banco fora'));

    await expect(store().setLanguage(db, 'en')).rejects.toThrow();
    expect(store().language).toBeNull();
  });
});

describe('active server', () => {
  it('remembers the server the user signed into', () => {
    store().setActiveServer(server);

    expect(store().activeServer).toEqual(server);
  });

  it('clears it on sign out', () => {
    store().setActiveServer(server);

    store().clearActiveServer();

    expect(store().activeServer).toBeNull();
  });

  it('keeps the local identity after signing out of a server', async () => {
    mockClientSettings.getClientSettings.mockResolvedValue(SETTINGS);
    await store().initializeSettings(db);
    store().setActiveServer(server);

    store().clearActiveServer();

    expect(store().userId).toBe('local-user-1');
  });
});

describe('resetSettings', () => {
  it('wipes everything, including the active server', async () => {
    mockClientSettings.getClientSettings.mockResolvedValue(SETTINGS);
    await store().initializeSettings(db);
    store().setActiveServer(server);

    store().resetSettings();

    expect(store()).toMatchObject({
      userId: null,
      username: null,
      language: null,
      activeServer: null,
    });
  });
});
