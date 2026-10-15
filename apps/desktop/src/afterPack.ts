import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * electron-builder's `afterPack` hook (see electron-builder.yml): drops what Chromium ships for features this app
 * never uses, from the Windows build.
 *
 * `dxcompiler.dll` and `dxil.dll` are the DirectX shader compiler Chromium's WebGPU backend needs (about 26 MB
 * unpacked, 10 MB in the installer). Nothing in Keres asks for WebGPU: the only GPU consumer is CanvasKit (Skia's
 * WASM build, used by the graphs), which draws through WebGL, and WebGL on Windows goes through ANGLE with
 * `d3dcompiler_47.dll`, which stays. The software fallback (`vk_swiftshader.dll`, `vulkan-1.dll`) stays too: it is what
 * WebGL runs on in a machine without a usable GPU.
 *
 * Checked by rendering the graph screens with and without these files, on the GPU and with `--disable-gpu` /
 * SwiftShader: same pictures.
 */
export const UNUSED_WINDOWS_LIBRARIES = ['dxcompiler.dll', 'dxil.dll'];

/** The part of electron-builder's `AfterPackContext` this hook reads. */
export interface PackContext {
  electronPlatformName: string;
  appOutDir: string;
}

/** Removes the libraries from the unpacked app and returns the ones that were there. */
export async function removeUnusedChromiumLibraries(context: PackContext): Promise<string[]> {
  if (context.electronPlatformName !== 'win32') return [];
  const removed: string[] = [];
  for (const library of UNUSED_WINDOWS_LIBRARIES) {
    const file = path.join(context.appOutDir, library);
    try {
      await fs.rm(file);
      removed.push(library);
    } catch (error: unknown) {
      // Absent is fine (a later Electron may stop shipping it); anything else is a real failure.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (removed.length > 0) {
    console.log(`  • removed unused Chromium libraries: ${removed.join(', ')}`);
  }
  return removed;
}

export default removeUnusedChromiumLibraries;
