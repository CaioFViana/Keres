import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';

/**
 * Adaptador mínimo das APIs do Bun usadas pela camada de mídia.
 *
 * A API roda em produção sob o Bun, mas as suítes rodam em Node - `Bun.CryptoHasher` (que
 * recalcula o hash de todo upload) e `Bun.write`/`Bun.file` (o backend local de blobs) não
 * existem lá. Sem isto, toda rota de upload falha por `Bun is not defined` e devolve 400,
 * escondendo o comportamento que se queria testar.
 *
 * Mesma abordagem já usada em `test/services/media-storage/LocalFilesystemBlobStorage.test.ts`,
 * centralizada aqui para as suítes de integração compartilharem uma única versão.
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
