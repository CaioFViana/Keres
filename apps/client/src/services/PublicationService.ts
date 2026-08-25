import { stories } from '@/src/db/schemas/stories';
import type {
  StoryPublicationInsert,
  StoryPublicationSelect,
} from '@/src/db/schemas/storyPublications';
import { storyPublications } from '@/src/db/schemas/storyPublications';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { useNotificationStore } from '../state/notificationStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import { isOfflineError } from './apiClient';
import { publicationApiService } from './PublicationApiService';

/**
 * O espelho local das versões públicas, e o aviso de que alguma apareceu.
 *
 * O desenho é o mesmo de `FriendshipService.performFriendshipSync`, e pelo mesmo motivo: o
 * servidor manda `story.published` pelo WebSocket, mas o barramento dele é em memória e não
 * reenvia nada para quem estava fora do ar. Então o aviso não nasce do evento - nasce da
 * *diferença* entre o que este aparelho já tinha e o que o servidor responde, e o app refaz
 * essa consulta em toda reconexão. Quem ficou uma semana offline recebe o aviso ao voltar.
 */

// Reconexão e evento podem pedir a mesma atualização quase ao mesmo tempo, e o SQLite do Expo
// não roda duas transações de escrita ao mesmo tempo. Mesma proteção que amizade já usa.
const publicationSyncInFlight = new Map<string, Promise<void>>();

export const createPublicationService = (db: AppDrizzleClient) => new PublicationService(db);

export class PublicationService {
  constructor(private db: AppDrizzleClient) {}

  async getPublicationsForStory(storyId: string): Promise<StoryPublicationSelect[]> {
    return this.db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, storyId))
      .orderBy(desc(storyPublications.createdAt))
      .all();
  }

  async syncPublicationsWithServer(server: ServerSelect): Promise<void> {
    const inFlight = publicationSyncInFlight.get(server.id);
    if (inFlight) {
      return inFlight;
    }
    const sync = this.performPublicationSync(server);
    publicationSyncInFlight.set(server.id, sync);
    sync
      .finally(() => publicationSyncInFlight.delete(server.id))
      .catch(() => {
        // A promessa original é devolvida a quem chamou, que trata o erro. Este catch existe
        // só para o encadeamento do finally não virar uma rejeição não tratada.
      });
    return sync;
  }

  private async performPublicationSync(server: ServerSelect): Promise<void> {
    let remote: Awaited<ReturnType<typeof publicationApiService.listVisible>>;
    try {
      // Antes da transação: uma ida à rede dentro dela seguraria o banco pelo caminho todo.
      remote = await publicationApiService.listVisible(server);
    } catch (error) {
      if (isOfflineError(error)) {
        return;
      }
      throw error;
    }

    const stories = await this.localStories(remote.map((publication) => publication.storyId));
    const notifications: string[] = [];

    await this.db.transaction(async (tx) => {
      const local = await tx
        .select()
        .from(storyPublications)
        .where(eq(storyPublications.serverId, server.id))
        .all();
      const localById = new Map(local.map((row) => [row.id, row]));

      // Uma versão apagada pelo dono some daqui também - o espelho reflete o servidor.
      const remoteIds = new Set(remote.map((publication) => publication.id));
      const goneIds = local.filter((row) => !remoteIds.has(row.id)).map((row) => row.id);
      if (goneIds.length > 0) {
        await tx.delete(storyPublications).where(inArray(storyPublications.id, goneIds)).run();
      }

      // Primeira sincronização deste servidor: tudo que existe já existia antes deste aparelho
      // saber que a funcionalidade existe. Gravar como já avisado, senão a pessoa levaria uma
      // enxurrada de avisos sobre versões antigas.
      const firstSync = local.length === 0;

      for (const publication of remote) {
        const known = localById.get(publication.id);
        const isNew = !known;
        const row: StoryPublicationInsert = {
          id: publication.id,
          serverId: server.id,
          storyId: publication.storyId,
          label: publication.label,
          operationVersion: publication.operationVersion,
          byteSize: publication.byteSize,
          createdAt: new Date(publication.createdAt),
          notified: isNew ? firstSync : known.notified,
        };

        await tx
          .insert(storyPublications)
          .values(row)
          .onConflictDoUpdate({ target: storyPublications.id, set: row })
          .run();

        if (isNew && !firstSync) {
          const story = stories.get(publication.storyId);
          // Quem publica é o dono, então avisá-lo do que ele mesmo acabou de fazer é ruído. O
          // evento continua chegando aos aparelhos dele - é o que mantém esta lista em dia -,
          // mas o aviso na tela é só para quem lê ou escreve a história de outra pessoa.
          if (story?.myRole !== 'owner') {
            notifications.push(
              i18n.t('story_version_published', {
                title: story?.title ?? i18n.t('a_story'),
                label: publication.label,
              }),
            );
          }
          await tx
            .update(storyPublications)
            .set({ notified: true })
            .where(eq(storyPublications.id, publication.id))
            .run();
        }
      }
    });

    // Fora da transação: mostrar um aviso não pode ser motivo para desfazer a escrita.
    const showNotification = useNotificationStore.getState().showNotification;
    for (const message of notifications) {
      showNotification(message, 'info');
    }
    entityEventEmitter.emit('publications_changed');
  }

  /**
   * As histórias citadas, como este aparelho as conhece: o título (para o aviso não dizer só um
   * id) e o papel da pessoa nelas (para o dono não ser avisado da própria publicação).
   */
  private async localStories(
    storyIds: string[],
  ): Promise<Map<string, { title: string; myRole: string | null }>> {
    const unique = [...new Set(storyIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ id: stories.id, title: stories.title, myRole: stories.myRole })
      .from(stories)
      .where(and(inArray(stories.id, unique), eq(stories.isDeleted, false)))
      .all();
    return new Map(rows.map((row) => [row.id, { title: row.title, myRole: row.myRole }]));
  }
}
