import type {
  ShowcaseOwner,
  ShowcaseStoryCard,
  ShowcaseStoryDetail,
  ShowcaseVersion,
  StoryPublicationSnapshot,
} from '@keres/shared';
import { comparePassword } from '../config/bcrypt';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { storyPublications, storyShowcaseEntries, users } from '../db/schema';

/**
 * As leituras anônimas do site público.
 *
 * Tudo o que sai daqui já é conteúdo que alguém escolheu publicar. Nada de id de usuário,
 * e-mail, linha de permissão ou história sem publicação - e nada, nem o título, sobre uma
 * história protegida por senha antes do unlock.
 */
export class ShowcaseService {
  private ownerOf(row: {
    username: string;
    tag: string;
    avatarColor: string | null;
    avatarIcon: string | null;
  }): ShowcaseOwner {
    return {
      username: row.username,
      tag: row.tag,
      avatarColor: row.avatarColor,
      avatarIcon: row.avatarIcon,
    };
  }

  private versionOf(row: typeof storyPublications.$inferSelect): ShowcaseVersion {
    return {
      id: row.id,
      label: row.label,
      byteSize: row.byteSize,
      mediaIncluded: row.mediaIncluded,
      mediaTotal: row.mediaTotal,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Assinatura da listagem, para o `If-None-Match` do site. Contagem + instante mais recente
   * cobre publicar, apagar versão e despublicar sem precisar de uma coluna dedicada.
   */
  async listEtag(): Promise<string> {
    const [row] = await db
      .select({
        count: count(),
        latest: sql<string | null>`max(${storyShowcaseEntries.updatedAt})`,
      })
      .from(storyShowcaseEntries)
      .where(eq(storyShowcaseEntries.visibility, 'public'));
    return `W/"showcase-${row?.count ?? 0}-${row?.latest ?? 'empty'}"`;
  }

  /** Só histórias públicas. Uma protegida por senha nunca aparece aqui. */
  async listPublicStories(): Promise<ShowcaseStoryCard[]> {
    const entries = await db
      .select({
        storyId: storyShowcaseEntries.storyId,
        updatedAt: storyShowcaseEntries.updatedAt,
        username: users.username,
        tag: users.tag,
        avatarColor: users.avatarColor,
        avatarIcon: users.avatarIcon,
      })
      .from(storyShowcaseEntries)
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(eq(storyShowcaseEntries.visibility, 'public'))
      .orderBy(desc(storyShowcaseEntries.updatedAt));

    const cards: ShowcaseStoryCard[] = [];
    for (const entry of entries) {
      const versions = await db
        .select()
        .from(storyPublications)
        .where(eq(storyPublications.storyId, entry.storyId))
        .orderBy(desc(storyPublications.createdAt));
      if (versions.length === 0) {
        continue;
      }
      cards.push({
        storyId: entry.storyId,
        snapshot: versions[0].snapshot as StoryPublicationSnapshot,
        owner: this.ownerOf(entry),
        versionCount: versions.length,
        latestVersion: this.versionOf(versions[0]),
        updatedAt: entry.updatedAt.toISOString(),
      });
    }
    return cards;
  }

  async getEntry(storyId: string) {
    return db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
  }

  async getStoryDetail(storyId: string): Promise<ShowcaseStoryDetail | null> {
    const [entry] = await db
      .select({
        storyId: storyShowcaseEntries.storyId,
        updatedAt: storyShowcaseEntries.updatedAt,
        username: users.username,
        tag: users.tag,
        avatarColor: users.avatarColor,
        avatarIcon: users.avatarIcon,
      })
      .from(storyShowcaseEntries)
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(eq(storyShowcaseEntries.storyId, storyId))
      .limit(1);
    if (!entry) {
      return null;
    }

    const versions = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, storyId))
      .orderBy(desc(storyPublications.createdAt));
    if (versions.length === 0) {
      return null;
    }

    return {
      storyId,
      snapshot: versions[0].snapshot as StoryPublicationSnapshot,
      owner: this.ownerOf(entry),
      versions: versions.map((version) => this.versionOf(version)),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  /**
   * Confere a senha de uma história protegida.
   *
   * Sempre roda um bcrypt, mesmo quando a história não existe ou não é protegida: sem isso, o
   * tempo de resposta separaria "não existe" de "senha errada", e o endpoint viraria um oráculo
   * de existência - exatamente o que a resposta genérica de 401 evita.
   */
  async verifyPassword(storyId: string, password: string): Promise<boolean> {
    const entry = await this.getEntry(storyId);
    const hash =
      entry?.visibility === 'password' && entry.passwordHash
        ? entry.passwordHash
        : DUMMY_BCRYPT_HASH;
    const matches = await comparePassword(password, hash);
    return matches && entry?.visibility === 'password';
  }

  async getPublication(storyId: string, publicationId: string) {
    const publication = await db.query.storyPublications.findFirst({
      where: eq(storyPublications.id, publicationId),
    });
    return publication && publication.storyId === storyId ? publication : null;
  }
}

/** Hash de uma senha que ninguém tem, só para o caminho de falha custar o mesmo do de sucesso. */
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export const showcaseService = new ShowcaseService();
