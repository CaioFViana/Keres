import {
  buildPublicationLabel,
  buildStoryZipBytes,
  CURRENT_STORY_FORMAT_VERSION,
  type PublicationLabelMode,
  type ShowcaseVisibility,
  type StoryPublicationSnapshot,
} from '@keres/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { hashPassword } from '../config/bcrypt';
import { db } from '../db';
import { stories, storyPermissions, storyPublications, storyShowcaseEntries } from '../db/schema';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { mediaStorageService } from './MediaStorageService';
import { publicationStorageService } from './PublicationStorageService';
import { showcaseSettingsService } from './ShowcaseSettingsService';
import { StoryExportImportService } from './StoryExportImportService';

/**
 * Quantas versões de uma história o servidor guarda. Publicar a sexta apaga a mais antiga,
 * pacote incluído - o histórico completo é do autor, no app; aqui é só a vitrine.
 */
export const MAX_PUBLICATIONS_PER_STORY = 5;

async function blobFromMediaStorage(hash: string): Promise<Uint8Array | null> {
  const stored = await mediaStorageService.read(hash);
  if (!stored) {
    return null;
  }
  const body = stored.body;
  const buffer =
    body instanceof Blob
      ? await body.arrayBuffer()
      : await new Response(body as ReadableStream<Uint8Array>).arrayBuffer();
  return new Uint8Array(buffer);
}

export class StoryPublicationService {
  constructor(private readonly exportImportService = new StoryExportImportService()) {}

  private async assertShowcaseEnabled(): Promise<void> {
    if (!(await showcaseSettingsService.isEnabled())) {
      throw new AppError(403, 'The showcase is disabled on this server.');
    }
  }

  /**
   * Só o dono publica. Uma permissão de `writer` não serve: publicar expõe a história ao
   * mundo, e essa é uma decisão de quem é dono dela - a mesma linha que `SyncService` traça
   * para editar/apagar a própria entidade Story.
   */
  private async assertOwnership(userId: string, storyId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId !== userId) {
      throw new AppError(403, 'Only the owner of a story can publish it.');
    }
    return story;
  }

  private snapshotOf(story: typeof stories.$inferSelect): StoryPublicationSnapshot {
    return {
      title: story.title,
      description: story.description,
      genre: story.genre,
      language: story.language,
      author: story.author,
      type: story.type,
      theme: story.theme,
    };
  }

  /**
   * Dono + todo mundo com permissão viva na história.
   *
   * O dono entra porque o evento também serve para os *outros* aparelhos dele atualizarem a
   * lista de versões - não só para avisar alguém. Quem decide se isso vira um aviso na tela é
   * o cliente, que silencia histórias das quais a pessoa é dona: ela acabou de publicar, não
   * precisa ser informada disso (ver `PublicationService.performPublicationSync`).
   */
  private async audienceFor(storyId: string, ownerUserId: string): Promise<string[]> {
    const collaborators = await db
      .select({ userId: storyPermissions.userId })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.isDeleted, false)));
    return [...new Set([ownerUserId, ...collaborators.map((row) => row.userId)])];
  }

  private async notifyAudience(storyId: string, ownerUserId: string): Promise<void> {
    for (const userId of await this.audienceFor(storyId, ownerUserId)) {
      emitUserEvent(userId, { type: 'story.published', storyId });
    }
  }

  /**
   * Roda a transação de publicação, removendo o pacote já gravado se ela não vingar.
   *
   * O .zip é gravado antes da transação de propósito (ver `publish`), então o caminho de erro
   * precisa desfazer isso explicitamente - caso contrário uma publicação recusada, por exemplo
   * por um nome de versão repetido, deixaria um arquivo que nenhuma linha referencia.
   */
  private async runPublishTransaction<T>(
    work: Parameters<typeof db.transaction<T>>[0],
    onFailure: () => Promise<void>,
  ): Promise<T> {
    try {
      return await db.transaction(work);
    } catch (error) {
      await onFailure().catch(() => undefined);
      throw error;
    }
  }

  async publish(
    userId: string,
    storyId: string,
    clientOperationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
  ) {
    await this.assertShowcaseEnabled();
    const story = await this.assertOwnership(userId, storyId);

    // O cliente também barra o botão, mas quem decide é o servidor: publicar uma história com
    // mudança local pendente geraria um pacote que não corresponde ao que existe em lugar
    // nenhum - nem no aparelho, nem aqui.
    if (clientOperationVersion !== story.lastOperationVersion) {
      throw new AppError(
        409,
        `This story is not in sync with the server (server is at ${story.lastOperationVersion}, you are at ${clientOperationVersion}). Sync it first, then publish.`,
      );
    }

    if (visibility === 'password' && !password) {
      throw new AppError(400, 'A password is required for password-protected stories.');
    }

    const storyExport = await this.exportImportService.exportStory(storyId, userId);
    const publicationId = ulid();
    const zip = await buildStoryZipBytes(storyExport, (item) => blobFromMediaStorage(item.hash));

    // Bytes antes da linha: uma linha sem blob é um download quebrado exposto no site, enquanto
    // um blob sem linha é invisível. Se a transação abaixo falhar, o arquivo é removido no
    // `catch` - sem isso, cada publicação recusada deixaria um .zip órfão ocupando disco.
    await publicationStorageService.store(storyId, publicationId, zip.bytes);

    const passwordHash = visibility === 'password' ? await hashPassword(password!) : null;

    const prunedIds = await this.runPublishTransaction(
      async (tx) => {
        const existing = await tx
          .select({ label: storyPublications.label })
          .from(storyPublications)
          .where(eq(storyPublications.storyId, storyId));

        // A visibilidade é gravada em toda publicação, não só quando muda: ela faz parte do que
        // a pessoa escolheu *nesta* publicação. Sem reescrever, publicar com o cadeado desligado
        // deixaria silenciosamente uma história que já estava protegida como estava - a ação
        // pareceria não ter efeito nenhum.
        await tx
          .insert(storyShowcaseEntries)
          .values({ storyId, ownerUserId: userId, labelMode, visibility, passwordHash })
          .onConflictDoUpdate({
            target: storyShowcaseEntries.storyId,
            set: { labelMode, visibility, passwordHash, updatedAt: new Date() },
          });

        await tx.insert(storyPublications).values({
          id: publicationId,
          storyId,
          ownerUserId: userId,
          label: buildPublicationLabel(
            labelMode,
            story.lastOperationVersion,
            new Date(),
            existing.map((row) => row.label),
          ),
          operationVersion: story.lastOperationVersion,
          formatVersion: CURRENT_STORY_FORMAT_VERSION,
          byteSize: zip.bytes.byteLength,
          mediaIncluded: zip.includedCount,
          mediaTotal: zip.totalCount,
          snapshot: this.snapshotOf(story),
        });

        // O corte é feito aqui e não no SQL porque `OFFSET` sem `LIMIT` é inválido no SQLite,
        // e são no máximo seis linhas por história - não vale um `LIMIT` artificial só por isso.
        const existingIds = await tx
          .select({ id: storyPublications.id })
          .from(storyPublications)
          .where(eq(storyPublications.storyId, storyId))
          .orderBy(desc(storyPublications.createdAt), desc(storyPublications.id));
        const surplus = existingIds.slice(MAX_PUBLICATIONS_PER_STORY);

        if (surplus.length > 0) {
          const ids = surplus.map((row) => row.id);
          await tx.delete(storyPublications).where(inArray(storyPublications.id, ids));
          return ids;
        }
        return [];
      },
      () => publicationStorageService.delete(storyId, publicationId),
    );

    // Depois do commit: se um delete de blob falhar, o pior caso é um arquivo órfão, não uma
    // versão listada no site cujo download não existe mais.
    for (const id of prunedIds) {
      await publicationStorageService.delete(storyId, id).catch(() => undefined);
    }

    await this.notifyAudience(storyId, userId);
    return this.getPublication(storyId, publicationId);
  }

  async getPublication(storyId: string, publicationId: string) {
    return db.query.storyPublications.findFirst({
      where: and(eq(storyPublications.id, publicationId), eq(storyPublications.storyId, storyId)),
    });
  }

  async listForStory(userId: string, storyId: string) {
    await this.assertOwnership(userId, storyId);
    const entry = await db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
    const publications = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, storyId))
      .orderBy(desc(storyPublications.createdAt));

    return {
      visibility: (entry?.visibility ?? 'public') as ShowcaseVisibility,
      labelMode: (entry?.labelMode ?? 'both') as PublicationLabelMode,
      // Só se existe uma senha, nunca qual - o app precisa disso para dizer "protegida por
      // senha" e oferecer trocá-la, e nada além disso.
      hasPassword: !!entry?.passwordHash,
      isPublished: !!entry,
      publications,
    };
  }

  /**
   * Todas as publicações das histórias que a pessoa pode ler - dela e das compartilhadas com
   * ela. É o que o app usa para descobrir, na reconexão, o que foi publicado enquanto ele
   * estava fora: o barramento de eventos é em memória e não reenvia nada.
   */
  async listVisibleTo(userId: string) {
    const owned = await db
      .select({ storyId: stories.id })
      .from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    const shared = await db
      .select({ storyId: storyPermissions.storyId })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.userId, userId), eq(storyPermissions.isDeleted, false)));

    const storyIds = [...new Set([...owned, ...shared].map((row) => row.storyId))];
    if (storyIds.length === 0) {
      return [];
    }

    return db
      .select()
      .from(storyPublications)
      .where(inArray(storyPublications.storyId, storyIds))
      .orderBy(desc(storyPublications.createdAt));
  }

  async setVisibility(
    userId: string,
    storyId: string,
    visibility: ShowcaseVisibility,
    password?: string,
  ) {
    await this.assertShowcaseEnabled();
    await this.assertOwnership(userId, storyId);

    const entry = await db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
    if (!entry) {
      throw new AppError(404, 'This story is not published.');
    }
    if (visibility === 'password' && !password) {
      throw new AppError(400, 'A password is required for password-protected stories.');
    }

    const [updated] = await db
      .update(storyShowcaseEntries)
      .set({
        visibility,
        passwordHash: visibility === 'password' ? await hashPassword(password!) : null,
        updatedAt: new Date(),
      })
      .where(eq(storyShowcaseEntries.storyId, storyId))
      .returning();

    // O hash não volta nem para o dono: ele não tem uso nenhum do lado de fora, e o que não
    // sai daqui não pode acabar num log ou numa aba de rede aberta.
    return {
      storyId: updated.storyId,
      ownerUserId: updated.ownerUserId,
      visibility: updated.visibility,
      labelMode: updated.labelMode,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      hasPassword: visibility === 'password',
    };
  }

  async deletePublication(userId: string, storyId: string, publicationId: string): Promise<void> {
    await this.assertOwnership(userId, storyId);
    const publication = await this.getPublication(storyId, publicationId);
    if (!publication) {
      throw new AppError(404, 'Publication not found.');
    }

    await db.transaction(async (tx) => {
      await tx.delete(storyPublications).where(eq(storyPublications.id, publicationId));
      const left = await tx
        .select({ id: storyPublications.id })
        .from(storyPublications)
        .where(eq(storyPublications.storyId, storyId));
      // Sem versão nenhuma não há o que mostrar: a história sai da vitrine junto.
      if (left.length === 0) {
        await tx.delete(storyShowcaseEntries).where(eq(storyShowcaseEntries.storyId, storyId));
      } else {
        await tx
          .update(storyShowcaseEntries)
          .set({ updatedAt: new Date() })
          .where(eq(storyShowcaseEntries.storyId, storyId));
      }
    });

    await publicationStorageService.delete(storyId, publicationId).catch(() => undefined);
    await this.notifyAudience(storyId, userId);
  }

  async unpublish(userId: string, storyId: string): Promise<void> {
    await this.assertOwnership(userId, storyId);

    const removed = await db.transaction(async (tx) => {
      const publications = await tx
        .select({ id: storyPublications.id })
        .from(storyPublications)
        .where(eq(storyPublications.storyId, storyId));
      await tx.delete(storyPublications).where(eq(storyPublications.storyId, storyId));
      await tx.delete(storyShowcaseEntries).where(eq(storyShowcaseEntries.storyId, storyId));
      return publications.map((row) => row.id);
    });

    for (const id of removed) {
      await publicationStorageService.delete(storyId, id).catch(() => undefined);
    }
    await this.notifyAudience(storyId, userId);
  }
}

export const storyPublicationService = new StoryPublicationService();
