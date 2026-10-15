import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import removeUnusedChromiumLibraries, {
  removeUnusedChromiumLibraries as named,
  UNUSED_WINDOWS_LIBRARIES,
} from '../src/afterPack';

let appOutDir: string;

async function seed(...names: string[]) {
  for (const name of names) await fs.writeFile(path.join(appOutDir, name), 'x');
}

async function remaining() {
  return (await fs.readdir(appOutDir)).sort();
}

beforeEach(async () => {
  appOutDir = await fs.mkdtemp(path.join(os.tmpdir(), 'keres-after-pack-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(appOutDir, { recursive: true, force: true });
});

describe('removeUnusedChromiumLibraries', () => {
  it('is the default export electron-builder loads', () => {
    expect(removeUnusedChromiumLibraries).toBe(named);
  });

  it('removes the DirectX shader compiler from the Windows build and keeps what WebGL needs', async () => {
    await seed(
      ...UNUSED_WINDOWS_LIBRARIES,
      'd3dcompiler_47.dll',
      'libEGL.dll',
      'libGLESv2.dll',
      'vk_swiftshader.dll',
      'vulkan-1.dll',
      'ffmpeg.dll',
    );

    const removed = await removeUnusedChromiumLibraries({
      electronPlatformName: 'win32',
      appOutDir,
    });

    expect(removed.sort()).toEqual([...UNUSED_WINDOWS_LIBRARIES].sort());
    expect(await remaining()).toEqual([
      'd3dcompiler_47.dll',
      'ffmpeg.dll',
      'libEGL.dll',
      'libGLESv2.dll',
      'vk_swiftshader.dll',
      'vulkan-1.dll',
    ]);
  });

  it.each(['darwin', 'linux'])('touches nothing on %s', async (electronPlatformName) => {
    await seed(...UNUSED_WINDOWS_LIBRARIES);

    expect(await removeUnusedChromiumLibraries({ electronPlatformName, appOutDir })).toEqual([]);
    expect(await remaining()).toEqual([...UNUSED_WINDOWS_LIBRARIES].sort());
  });

  it('accepts a build where one or both are already gone', async () => {
    await seed('dxil.dll');

    expect(
      await removeUnusedChromiumLibraries({ electronPlatformName: 'win32', appOutDir }),
    ).toEqual(['dxil.dll']);
    expect(
      await removeUnusedChromiumLibraries({ electronPlatformName: 'win32', appOutDir }),
    ).toEqual([]);
  });

  it('does not hide a failure that is not a missing file', async () => {
    // A directory where the file should be: `rm` without `recursive` refuses it.
    await fs.mkdir(path.join(appOutDir, 'dxcompiler.dll'));

    await expect(
      removeUnusedChromiumLibraries({ electronPlatformName: 'win32', appOutDir }),
    ).rejects.toThrow();
  });
});
