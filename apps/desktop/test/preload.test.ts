import { beforeAll, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electronMocks.exposeInMainWorld },
  ipcRenderer: { invoke: electronMocks.invoke },
}));

beforeAll(async () => {
  await import('../src/preload');
});

const exposed = (name: string) =>
  electronMocks.exposeInMainWorld.mock.calls.find(
    ([worldName]) => worldName === name,
  )?.[1] as Record<string, (...args: any[]) => any>;

describe('preload bridge', () => {
  it('exposes only the media operations the renderer needs', () => {
    expect(exposed('keresMedia')).toEqual({
      writeBytes: expect.any(Function),
      readBytes: expect.any(Function),
      deleteFile: expect.any(Function),
      deleteDirectory: expect.any(Function),
      listAllFiles: expect.any(Function),
    });
  });

  it('forwards media calls through their dedicated IPC channels', async () => {
    const media = exposed('keresMedia');
    const bytes = new Uint8Array([1, 2, 3]);

    await media.writeBytes('media/story-1/a.png', bytes);
    await media.readBytes('media/story-1/a.png');
    await media.deleteFile('media/story-1/a.png');
    await media.deleteDirectory('media/story-1');
    await media.listAllFiles();

    expect(electronMocks.invoke.mock.calls).toEqual([
      ['media:write', 'media/story-1/a.png', bytes],
      ['media:read', 'media/story-1/a.png'],
      ['media:delete-file', 'media/story-1/a.png'],
      ['media:delete-directory', 'media/story-1'],
      ['media:list-all'],
    ]);
  });

  it('exposes the token vault without exposing Electron itself', async () => {
    const auth = exposed('keresAuth');
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };

    await auth.status();
    await auth.read('server-1');
    await auth.write('server-1', tokens);
    await auth.remove('server-1');

    expect(electronMocks.invoke.mock.calls.slice(-4)).toEqual([
      ['auth:status'],
      ['auth:read', 'server-1'],
      ['auth:write', 'server-1', tokens],
      ['auth:remove', 'server-1'],
    ]);
    expect(electronMocks.exposeInMainWorld).toHaveBeenCalledTimes(2);
  });
});
