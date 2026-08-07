import { and, eq } from 'drizzle-orm';
import { mkdir, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import { db } from '../db';
import { galleries, mediaBlobs, stories } from '../db/schema';
import { env } from '../config/env';

/**
 * Armazenamento de mídia endereçado por conteúdo.
 *
 * O arquivo é gravado em `<raiz>/<2 primeiros dígitos do hash>/<hash>`. O prefixo existe
 * só para não deixar dezenas de milhares de arquivos num diretório único, o que degrada
 * listagem em vários sistemas de arquivos.
 *
 * Dedupe é consequência direta do endereçamento: subir a mesma imagem em duas histórias
 * grava um arquivo só. A autorização não mora aqui - quem decide se um usuário pode ler um
 * hash é a rota, cruzando permissão da história com as linhas de `galleries`.
 */
export class MediaStorageService {
  private readonly root: string;

  constructor(root: string = env.MEDIA_STORAGE_PATH) {
    this.root = path.resolve(root);
  }

  /**
   * Caminho relativo do blob. O hash já vem validado como 32 dígitos hex pelo schema, mas
   * a checagem é repetida aqui porque esta função constrói um caminho de arquivo: um hash
   * com `..` ou barra escaparia da raiz de armazenamento.
   */
  private relativePathFor(hash: string): string {
    if (!/^[a-f0-9]{32}$/.test(hash)) {
      throw new Error(`Invalid media hash: ${hash}`);
    }
    return path.join(hash.slice(0, 2), hash);
  }

  private absolutePathFor(hash: string): string {
    return path.join(this.root, this.relativePathFor(hash));
  }

  async has(hash: string): Promise<boolean> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return false;
    }
    // A linha pode existir sem o arquivo se o disco foi trocado ou limpo; nesse caso o
    // cliente precisa reenviar, então respondemos "não tenho".
    return Bun.file(path.join(this.root, record.storagePath)).exists();
  }

  /** Quais destes hashes o servidor já tem, em uma só ida ao banco. */
  async filterPresent(hashes: string[]): Promise<{ present: string[]; missing: string[] }> {
    const present: string[] = [];
    const missing: string[] = [];
    for (const hash of hashes) {
      if (await this.has(hash)) {
        present.push(hash);
      } else {
        missing.push(hash);
      }
    }
    return { present, missing };
  }

  /**
   * Grava os bytes e registra o blob.
   *
   * O `expectedHash` é conferido contra o hash recalculado dos bytes recebidos: é isso que
   * impede um cliente de registrar um conteúdo sob o endereço de outro.
   */
  async store(expectedHash: string, mimeType: string, bytes: ArrayBuffer): Promise<{ hash: string; sizeBytes: number }> {
    const actualHash = new Bun.CryptoHasher('md5').update(bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`Media hash mismatch: declared ${expectedHash}, received content hashes to ${actualHash}.`);
    }

    const relativePath = this.relativePathFor(actualHash);
    const absolutePath = path.join(this.root, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await Bun.write(absolutePath, bytes);

    await db.insert(mediaBlobs)
      .values({
        hash: actualHash,
        mimeType,
        sizeBytes: bytes.byteLength,
        storagePath: relativePath,
        createdAt: new Date(),
      })
      // Reenviar um blob que já existe é normal (dois clientes com a mesma foto, um retry
      // depois de resposta perdida) e não é erro: os bytes são idênticos por definição.
      .onConflictDoNothing();

    return { hash: actualHash, sizeBytes: bytes.byteLength };
  }

  /** O arquivo pronto para ser devolvido na resposta, ou `null` se não existir. */
  async read(hash: string): Promise<{ file: ReturnType<typeof Bun.file>; mimeType: string; sizeBytes: number } | null> {
    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return null;
    }
    const file = Bun.file(path.join(this.root, record.storagePath));
    if (!(await file.exists())) {
      return null;
    }
    return { file, mimeType: record.mimeType, sizeBytes: record.sizeBytes };
  }

  /**
   * Remove o blob de `hash` se nenhuma Gallery viva em nenhuma história ainda precisar dele.
   *
   * "Viva" exige duas coisas: a própria linha de `galleries` não estar excluída, *e* a
   * história dela também não estar excluída - o tombstone de uma história não se propaga
   * para suas Galleries (cada entidade sincroniza o próprio tombstone independentemente, ver
   * `StorySyncHandler`), então um hash pode ficar órfão por qualquer um dos dois caminhos.
   *
   * Chamada depois de excluir uma Gallery e depois de excluir uma História, para cada hash
   * que a exclusão pode ter deixado sem nenhuma referência restante. Sem isto, o armazenamento
   * dedupado globalmente só cresce: nada nunca some.
   */
  async deleteBlobIfUnreferenced(hash: string): Promise<void> {
    const stillReferenced = await db.select({ id: galleries.id })
      .from(galleries)
      .innerJoin(stories, eq(galleries.storyId, stories.id))
      .where(and(
        eq(galleries.hash, hash),
        eq(galleries.isDeleted, false),
        eq(stories.isDeleted, false)
      ))
      .limit(1);

    if (stillReferenced.length > 0) {
      return;
    }

    const record = await db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
    if (!record) {
      return;
    }

    try {
      await unlink(path.join(this.root, record.storagePath));
    } catch (error: any) {
      // Já sumiu do disco (troca/limpeza de volume) - o objetivo é não ter mais o registro
      // nem o arquivo, então isso ainda conta como sucesso.
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await db.delete(mediaBlobs).where(eq(mediaBlobs.hash, hash));
  }
}

export const mediaStorageService = new MediaStorageService();
