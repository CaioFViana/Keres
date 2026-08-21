import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { ulid } from 'ulid';
import type { BlobStorage } from './BlobStorage';

/**
 * Armazenamento local para instalações pequenas. Arquivos passam por `tmp/` e só aparecem
 * no caminho definitivo após uma troca atômica dentro do mesmo volume.
 */
export class LocalFilesystemBlobStorage implements BlobStorage {
  private readonly root: string;
  private readonly temporaryRoot: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.temporaryRoot = path.join(this.root, 'tmp');
  }

  private absolutePath(key: string): string {
    const absolutePath = path.resolve(this.root, key);
    const relativePath = path.relative(this.root, absolutePath);
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(`Invalid media storage key: ${key}`);
    }
    return absolutePath;
  }

  async has(key: string): Promise<boolean> {
    return Bun.file(this.absolutePath(key)).exists();
  }

  async put(key: string, bytes: ArrayBuffer, mimeType: string): Promise<void> {
    // A interface preserva o MIME para o backend S3; no sistema de arquivos ele já é salvo
    // no banco, então não há metadado adicional a gravar ao lado do blob.
    void mimeType;
    const destination = this.absolutePath(key);
    const temporaryPath = path.join(this.temporaryRoot, `${ulid()}.part`);
    await mkdir(this.temporaryRoot, { recursive: true });
    await Bun.write(temporaryPath, bytes);
    await mkdir(path.dirname(destination), { recursive: true });

    // O hash torna o destino imutável: se outro upload igual já venceu a corrida, basta
    // descartar o temporário. Nunca sobrescrevemos um blob pronto.
    if (await Bun.file(destination).exists()) {
      await unlink(temporaryPath);
      return;
    }

    try {
      await rename(temporaryPath, destination);
    } catch (error: any) {
      // Em alguns sistemas (especialmente Windows), a corrida acima se manifesta como erro
      // de rename. Se o vencedor deixou o mesmo destino pronto, ainda é sucesso.
      if (await Bun.file(destination).exists()) {
        await unlink(temporaryPath).catch(() => undefined);
        return;
      }
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async get(key: string): Promise<Blob | null> {
    const file = Bun.file(this.absolutePath(key));
    return (await file.exists()) ? file : null;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.absolutePath(key));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async cleanupTemporaryFiles(olderThanMs: number): Promise<number> {
    let entries: string[];
    try {
      entries = await readdir(this.temporaryRoot);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }

    const cutoff = Date.now() - olderThanMs;
    let removed = 0;
    for (const entry of entries) {
      const filePath = path.join(this.temporaryRoot, entry);
      const info = await stat(filePath);
      if (info.isFile() && info.mtimeMs < cutoff) {
        await unlink(filePath);
        removed++;
      }
    }
    return removed;
  }
}
