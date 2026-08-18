import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Os 10 canais IPC são a única porta entre o renderer (que não tem acesso a disco) e a máquina
 * do usuário: os de `auth:` guardam os tokens no cofre do sistema, e os de `media:` escrevem
 * arquivos reais. O Electron é mockado, mas o sistema de arquivos não - os testes de mídia e
 * do cofre operam num diretório temporário de verdade, que é onde os erros de resolução de
 * caminho realmente aparecem.
 */
const USER_DATA = path.join(os.tmpdir(), `keres-ipc-test-${process.pid}`);
const MEDIA_ROOT = path.join(USER_DATA, 'media-storage');

type Handler = (event: unknown, ...args: any[]) => unknown;
const handlers = new Map<string, Handler>();

const electronMocks = vi.hoisted(() => ({
  isAsyncEncryptionAvailable: vi.fn(async () => true),
  getSelectedStorageBackend: vi.fn(() => 'gnome_libsecret'),
  encryptStringAsync: vi.fn(async (plain: string) => Buffer.from(`enc:${plain}`)),
  decryptStringAsync: vi.fn(async (buffer: Buffer) => ({
    result: buffer.toString().replace(/^enc:/, ''),
    shouldReEncrypt: false,
  })),
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    isPackaged: false,
    // Nunca resolve: o callback de `whenReady` sobe janela e protocolo, nada disso é o alvo
    // aqui. Os registradores de IPC são chamados diretamente pelo teste.
    whenReady: () => new Promise<void>(() => {}),
    getPath: () => USER_DATA,
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: electronMocks.handle },
  Menu: { setApplicationMenu: vi.fn() },
  net: { fetch: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  safeStorage: {
    isAsyncEncryptionAvailable: electronMocks.isAsyncEncryptionAvailable,
    getSelectedStorageBackend: electronMocks.getSelectedStorageBackend,
    encryptStringAsync: electronMocks.encryptStringAsync,
    decryptStringAsync: electronMocks.decryptStringAsync,
  },
  session: { defaultSession: { clearCache: vi.fn(), clearCodeCaches: vi.fn() } },
}));

/** Renderer legítimo: só `app://app/...` é aceito, ver `isTrustedRendererUrl`. */
const trustedEvent = { senderFrame: { url: 'app://app/' } };
const untrustedEvent = { senderFrame: { url: 'https://exemplo.com/' } };

const invoke = (channel: string, event: unknown, ...args: any[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`Canal não registrado: ${channel}`);
  return handler(event, ...args);
};

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };

beforeAll(async () => {
  electronMocks.handle.mockImplementation((channel: string, handler: Handler) => {
    handlers.set(channel, handler);
  });

  const main = await import('../src/main');
  main.registerAuthIpcHandlers();
  main.registerMediaIpcHandlers();
});

beforeEach(async () => {
  await fs.rm(USER_DATA, { recursive: true, force: true });
  await fs.mkdir(MEDIA_ROOT, { recursive: true });
  electronMocks.isAsyncEncryptionAvailable.mockResolvedValue(true);
  electronMocks.decryptStringAsync.mockImplementation(async (buffer: Buffer) => ({
    result: buffer.toString().replace(/^enc:/, ''),
    shouldReEncrypt: false,
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  electronMocks.handle.mockImplementation((channel: string, handler: Handler) =>
    handlers.set(channel, handler),
  );
});

afterAll(async () => {
  await fs.rm(USER_DATA, { recursive: true, force: true });
});

describe('registered channels', () => {
  it.each([
    'auth:status',
    'auth:read',
    'auth:write',
    'auth:remove',
    'media:write',
    'media:read',
    'media:delete-file',
    'media:delete-directory',
    'media:list-all',
  ])('registers %s', (channel) => {
    expect(handlers.has(channel)).toBe(true);
  });
});

describe('auth channels', () => {
  it.each(['auth:status', 'auth:read', 'auth:write', 'auth:remove'])(
    'rejects %s coming from an untrusted origin',
    async (channel) => {
      await expect(invoke(channel, untrustedEvent, 'server-1', TOKENS)).rejects.toThrow(
        'Unauthorized IPC sender.',
      );
    },
  );

  it('rejects an IPC call with no sender frame at all', async () => {
    await expect(invoke('auth:status', {})).rejects.toThrow('Unauthorized IPC sender.');
  });

  it('reports secure storage as available when the platform provides it', async () => {
    await expect(invoke('auth:status', trustedEvent)).resolves.toEqual({ available: true });
  });

  it('reports secure storage as unavailable when the platform does not provide it', async () => {
    electronMocks.isAsyncEncryptionAvailable.mockResolvedValue(false);

    await expect(invoke('auth:status', trustedEvent)).resolves.toEqual({ available: false });
  });

  it('round-trips a token pair through the vault', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
  });

  it('encrypts the tokens instead of writing them in the clear', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);

    const raw = await fs.readFile(path.join(USER_DATA, 'auth-vault.json'), 'utf8');
    expect(electronMocks.encryptStringAsync).toHaveBeenCalledWith(JSON.stringify(TOKENS));
    expect(raw).not.toContain('access-1');
    expect(raw).not.toContain('refresh-1');
  });

  it('creates the userData directory on first write instead of failing with ENOENT', async () => {
    // beforeEach cria USER_DATA como efeito colateral do mkdir de MEDIA_ROOT (que é um
    // subdiretório dele) - remove só o USER_DATA de novo pra reproduzir o cenário real de
    // primeira execução, onde o Electron ainda não criou esse diretório.
    await fs.rm(USER_DATA, { recursive: true, force: true });

    await expect(invoke('auth:write', trustedEvent, 'server-1', TOKENS)).resolves.toBeUndefined();
    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
  });

  it('keeps one entry per server', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);
    await invoke('auth:write', trustedEvent, 'server-2', { accessToken: 'a2', refreshToken: 'r2' });

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
    await expect(invoke('auth:read', trustedEvent, 'server-2')).resolves.toEqual({
      accessToken: 'a2',
      refreshToken: 'r2',
    });
  });

  /**
   * Regressão: duas escritas concorrentes usavam o mesmo nome de arquivo temporário
   * (`auth-vault.json.tmp`), então a segunda `rename` a rodar encontrava ENOENT - a primeira
   * já tinha movido (consumido) o arquivo. Isso derrubava a escrita inteira com um erro não
   * tratado, e o token nunca chegava a ser salvo de verdade - exatamente o que fazia
   * requisições autenticadas seguintes falharem com 401 mesmo depois do login "ter dado certo".
   */
  it('survives concurrent writes to different servers without losing either one', async () => {
    await expect(
      Promise.all([
        invoke('auth:write', trustedEvent, 'server-1', TOKENS),
        invoke('auth:write', trustedEvent, 'server-2', { accessToken: 'a2', refreshToken: 'r2' }),
      ]),
    ).resolves.toBeDefined();

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
    await expect(invoke('auth:read', trustedEvent, 'server-2')).resolves.toEqual({
      accessToken: 'a2',
      refreshToken: 'r2',
    });
  });

  it('survives a write racing a remove for a different server', async () => {
    await invoke('auth:write', trustedEvent, 'server-2', { accessToken: 'a2', refreshToken: 'r2' });

    await expect(
      Promise.all([
        invoke('auth:write', trustedEvent, 'server-1', TOKENS),
        invoke('auth:remove', trustedEvent, 'server-2'),
      ]),
    ).resolves.toBeDefined();

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
    await expect(invoke('auth:read', trustedEvent, 'server-2')).resolves.toBeNull();
  });

  it('returns null for a server that was never stored', async () => {
    await expect(invoke('auth:read', trustedEvent, 'nunca-visto')).resolves.toBeNull();
  });

  it('returns null when the vault file does not exist yet', async () => {
    await fs.rm(path.join(USER_DATA, 'auth-vault.json'), { force: true });

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toBeNull();
  });

  it('returns null instead of decrypting when secure storage went away', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);
    electronMocks.isAsyncEncryptionAvailable.mockResolvedValue(false);

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toBeNull();
    expect(electronMocks.decryptStringAsync).not.toHaveBeenCalled();
  });

  it('refuses to store tokens when secure storage is unavailable, rather than falling back to plaintext', async () => {
    electronMocks.isAsyncEncryptionAvailable.mockResolvedValue(false);

    await expect(invoke('auth:write', trustedEvent, 'server-1', TOKENS)).rejects.toThrow(
      'Secure credential storage is unavailable on this device.',
    );
  });

  it('re-encrypts on read when the platform says the ciphertext is stale', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);
    electronMocks.encryptStringAsync.mockClear();
    electronMocks.decryptStringAsync.mockResolvedValueOnce({
      result: JSON.stringify(TOKENS),
      shouldReEncrypt: true,
    });

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toEqual(TOKENS);
    expect(electronMocks.encryptStringAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no tokens', undefined],
    ['no access token', { refreshToken: 'r' }],
    ['no refresh token', { accessToken: 'a' }],
    ['an empty access token', { accessToken: '', refreshToken: 'r' }],
  ])('rejects a write with %s', async (_label, tokens) => {
    await expect(invoke('auth:write', trustedEvent, 'server-1', tokens)).rejects.toThrow(
      'Invalid token payload.',
    );
  });

  it('removes only the entry it was asked to remove', async () => {
    await invoke('auth:write', trustedEvent, 'server-1', TOKENS);
    await invoke('auth:write', trustedEvent, 'server-2', { accessToken: 'a2', refreshToken: 'r2' });

    await invoke('auth:remove', trustedEvent, 'server-1');

    await expect(invoke('auth:read', trustedEvent, 'server-1')).resolves.toBeNull();
    await expect(invoke('auth:read', trustedEvent, 'server-2')).resolves.not.toBeNull();
  });

  it('is a no-op when removing a server that was never stored', async () => {
    await expect(invoke('auth:remove', trustedEvent, 'nunca-visto')).resolves.toBeUndefined();
  });

  it.each([
    ['a path traversal', '../../etc/passwd'],
    ['a path separator', 'server/1'],
    ['an empty id', ''],
    ['an id longer than the limit', 'a'.repeat(129)],
  ])('refuses %s as a vault key', async (_label, serverId) => {
    for (const channel of ['auth:read', 'auth:write', 'auth:remove']) {
      await expect(invoke(channel, trustedEvent, serverId, TOKENS)).rejects.toThrow(
        'Invalid server identifier.',
      );
    }
  });
});

describe('media channels', () => {
  const RELATIVE = 'media/story-1/abc123.png';
  const BYTES = new Uint8Array([1, 2, 3]);

  it('writes a file, creating the story directory on the way', async () => {
    await invoke('media:write', null, RELATIVE, BYTES);

    const written = await fs.readFile(path.join(MEDIA_ROOT, 'media', 'story-1', 'abc123.png'));
    expect(Array.from(written)).toEqual([1, 2, 3]);
  });

  it('reads back exactly what it wrote', async () => {
    await invoke('media:write', null, RELATIVE, BYTES);

    const read = (await invoke('media:read', null, RELATIVE)) as Buffer;
    expect(Array.from(read)).toEqual([1, 2, 3]);
  });

  it('overwrites an existing file instead of failing', async () => {
    await invoke('media:write', null, RELATIVE, BYTES);
    await invoke('media:write', null, RELATIVE, new Uint8Array([9]));

    expect(Array.from((await invoke('media:read', null, RELATIVE)) as Buffer)).toEqual([9]);
  });

  it('fails to read a file that does not exist', async () => {
    await expect(invoke('media:read', null, 'media/story-1/sumiu.png')).rejects.toThrow();
  });

  it('deletes a file and stays quiet when it is already gone', async () => {
    await invoke('media:write', null, RELATIVE, BYTES);

    await invoke('media:delete-file', null, RELATIVE);
    await expect(invoke('media:delete-file', null, RELATIVE)).resolves.toBeUndefined();
    await expect(invoke('media:read', null, RELATIVE)).rejects.toThrow();
  });

  it('deletes a whole story directory', async () => {
    await invoke('media:write', null, 'media/story-1/a.png', BYTES);
    await invoke('media:write', null, 'media/story-1/b.png', BYTES);

    await invoke('media:delete-directory', null, 'media/story-1');

    await expect(invoke('media:list-all', null)).resolves.toEqual([]);
  });

  it('lists every file as the relative path the client cache expects', async () => {
    await invoke('media:write', null, 'media/story-1/a.png', BYTES);
    await invoke('media:write', null, 'media/story-2/b.png', BYTES);

    const listed = (await invoke('media:list-all', null)) as string[];

    expect(listed.sort()).toEqual(['media/story-1/a.png', 'media/story-2/b.png']);
  });

  it('lists only files directly inside each story directory', async () => {
    await invoke('media:write', null, 'media/story-1/a.png', BYTES);
    await fs.mkdir(path.join(MEDIA_ROOT, 'media', 'story-1', 'nested'));
    await fs.writeFile(path.join(MEDIA_ROOT, 'media', 'story-1', 'nested', 'ignored.png'), BYTES);

    await expect(invoke('media:list-all', null)).resolves.toEqual(['media/story-1/a.png']);
  });

  it('returns an empty list when no media was ever written', async () => {
    await expect(invoke('media:list-all', null)).resolves.toEqual([]);
  });

  it.each([
    ['media:write', ['../escapou.png', new Uint8Array([1])]],
    ['media:read', ['../escapou.png']],
    ['media:delete-file', ['../escapou.png']],
    ['media:delete-directory', ['..']],
  ])('refuses %s outside the media root', async (channel, args) => {
    await expect(invoke(channel, null, ...(args as any[]))).rejects.toThrow(
      /outside media storage/,
    );
  });

  it('does not create anything outside the root when a traversal is refused', async () => {
    await expect(invoke('media:write', null, '../escapou.png', BYTES)).rejects.toThrow();

    await expect(fs.access(path.join(USER_DATA, 'escapou.png'))).rejects.toThrow();
  });
});
