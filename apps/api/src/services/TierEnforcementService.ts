import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { galleries, registrationSettings, stories, tiers, users } from '../db/schema';
import { syncService } from './SyncService';

/**
 * Recusa de uma operação por ter estourado o teto do plano do usuário. Cada ponto de
 * chamada decide como traduzir isto para o formato de erro apropriado (SyncConflictError
 * no pipeline de sync, AppError na importação, um 403 simples no upload de mídia).
 */
export class TierLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TierLimitExceededError';
  }
}

type TierRow = typeof tiers.$inferSelect;

/**
 * Servidor é a fonte da verdade dos tetos de plano. As checagens aqui são feitas por
 * contagem simples (`SELECT COUNT ...` seguido de comparação), sem lock nem transação
 * dedicada - existe uma janela de corrida onde duas escritas concorrentes bem no limite
 * podem ambas passar e estourar o teto em 1. Isto é uma escolha deliberada: é um teto de
 * plano, não um limite financeiro/de integridade, e o resto do schema não usa nenhum lock
 * otimista/pessimista para nada parecido. Se o rigor estrito vier a ser
 * necessário, a correção é um `SELECT ... FOR UPDATE` por usuário, não infraestrutura nova.
 */
export class TierEnforcementService {
  /** Tier do usuário; se nenhum, o tier padrão de cadastro; se nenhum, ilimitado (`null`). */
  async getEffectiveTier(userId: string): Promise<TierRow | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { tierId: true },
    });
    if (user?.tierId) {
      const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, user.tierId) });
      if (tier) {
        return tier;
      }
    }

    const settings = await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.id, 'singleton'),
    });
    if (settings?.defaultTierId) {
      const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, settings.defaultTierId) });
      if (tier) {
        return tier;
      }
    }

    return null;
  }

  async assertCanCreateStory(userId: string): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxStories === null) {
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    if (count >= tier.maxStories) {
      throw new TierLimitExceededError(`Story limit reached for your plan (${tier.maxStories}).`);
    }
  }

  /** `storyId` é a história em que a entidade está sendo criada; usado para o teto por-história. */
  async assertCanCreateEntity(userId: string, storyId: string): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxEntitiesPerStory === null && tier.maxEntitiesTotal === null)) {
      return;
    }

    const handlers = [...syncService.getEntityHandlers().values()]
      // Favorite e Comment são metadados/anotações pessoais, não conteúdo da história - não
      // devem consumir nem ser bloqueados pelo limite de entidades do tier.
      .filter(
        (h) =>
          h.entityName !== 'Story' && h.entityName !== 'Favorite' && h.entityName !== 'Comment',
      );

    if (tier.maxEntitiesPerStory !== null) {
      const counts = await Promise.all(handlers.map((h) => h.countForStoryIds([storyId])));
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (total >= tier.maxEntitiesPerStory) {
        throw new TierLimitExceededError(
          `Entity limit for this story reached for your plan (${tier.maxEntitiesPerStory}).`,
        );
      }
    }

    if (tier.maxEntitiesTotal !== null) {
      const userStories = await db.query.stories.findMany({
        where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
        columns: { id: true },
      });
      const storyIds = userStories.map((s) => s.id);
      const counts = await Promise.all(handlers.map((h) => h.countForStoryIds(storyIds)));
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (total >= tier.maxEntitiesTotal) {
        throw new TierLimitExceededError(
          `Total entity limit reached for your plan (${tier.maxEntitiesTotal}).`,
        );
      }
    }
  }

  /**
   * Soma `galleries.sizeBytes` (não `mediaBlobs.sizeBytes`): o blob é deduplicado
   * globalmente, então duas histórias referenciando o mesmo hash devem contar os bytes
   * uma vez para cada uma (é o que elas "usam"), não uma vez só no total do servidor.
   */
  async assertCanUploadMedia(
    userId: string,
    storyId: string,
    incomingBytes: number,
  ): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxStorageBytesPerStory === null && tier.maxStorageBytesTotal === null)) {
      return;
    }

    if (tier.maxStorageBytesPerStory !== null) {
      // `::int` here would raise "integer out of range" (Postgres doesn't silently wrap a
      // CAST) the moment a story's total crosses ~2.1GB, breaking every upload to that story
      // with an opaque 500 - not hypothetical, since a single tier's *limit* is capped there
      // by the column type, but actual usage isn't (e.g. an unlimited tier, or a story that
      // predates a tightened limit). Postgres returns bigint as a string, hence `Number(...)`.
      const [{ used }] = await db
        .select({ used: sql<string>`coalesce(sum(${galleries.sizeBytes}), 0)::bigint` })
        .from(galleries)
        .where(and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)));
      if (Number(used) + incomingBytes > tier.maxStorageBytesPerStory) {
        throw new TierLimitExceededError(
          `Storage limit for this story reached for your plan (${tier.maxStorageBytesPerStory} bytes).`,
        );
      }
    }

    if (tier.maxStorageBytesTotal !== null) {
      const [{ used }] = await db
        .select({ used: sql<string>`coalesce(sum(${galleries.sizeBytes}), 0)::bigint` })
        .from(galleries)
        .innerJoin(stories, eq(galleries.storyId, stories.id))
        .where(and(eq(stories.userId, userId), eq(galleries.isDeleted, false)));
      if (Number(used) + incomingBytes > tier.maxStorageBytesTotal) {
        throw new TierLimitExceededError(
          `Total storage limit reached for your plan (${tier.maxStorageBytesTotal} bytes).`,
        );
      }
    }
  }
}

export const tierEnforcementService = new TierEnforcementService();
