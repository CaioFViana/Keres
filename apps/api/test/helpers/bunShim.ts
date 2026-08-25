import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';

/**
 * A minimal adapter for the Bun APIs the media layer uses.
 *
 * The API runs in production under Bun, but the suites run in Node - `Bun.CryptoHasher` (which
 * recomputes every upload's hash) and `Bun.write`/`Bun.file` (the local blob backend) do not exist
 * there. Without this, every upload route fails with `Bun is not defined` and returns 400, hiding the
 * behaviour we meant to test.
 *
 * The same approach already used in `test/services/media-storage/LocalFilesystemBlobStorage.test.ts`,
 * centralised here so the integration suites share a single version.
 */
export function installBunShim(): void {
  if ((globalThis as { Bun?: unknown }).Bun) {
    return;
  }

  (globalThis as { Bun?: unknown }).Bun = {
    CryptoHasher: class {
      private readonly hash: ReturnType<typeof createHash>;

      constructor(algorithm: string) {
        this.hash = createHash(algorithm);
      }

      update(bytes: ArrayBuffer | Uint8Array | string) {
        this.hash.update(typeof bytes === 'string' ? bytes : Buffer.from(bytes as ArrayBuffer));
        return this;
      }

      digest(encoding: 'hex') {
        return this.hash.digest(encoding);
      }
    },
    write: (filePath: string, bytes: ArrayBuffer) => writeFile(filePath, new Uint8Array(bytes)),
    file: (filePath: string) => ({
      exists: async () =>
        access(filePath)
          .then(() => true)
          .catch(() => false),
      text: async () => readFile(filePath, 'utf8'),
      arrayBuffer: async () => {
        const buffer = await readFile(filePath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      },
    }),
  };
}
