import {
  PackContentSchema,
  summarizePackContent,
  type PackContentType,
  type PackVisibility,
  type ShowcaseOwner,
  type ShowcasePackCard,
  type ShowcasePackDetail,
} from '@keres/shared';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { packs, users } from '../db/schema';
import { AppError } from '../utils/errors';

/**
 * Shared packs.
 *
 * The whole service is four operations over one table, and that is the point: a pack has no sync
 * state, no optimistic concurrency and no operation log, so sharing one is ordinary REST rather than
 * the publication machinery a story needs. See `apps/api/src/db/schema/tables/packs.ts`.
 *
 * The payload is validated on the way in and never inspected again: listing reads the metadata
 * columns, and fetching returns the stored JSON whole.
 */

export interface PackListEntry {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  visibility: PackVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadPackInput {
  id: string;
  name: string;
  description?: string | null;
  language?: string | null;
  authorName?: string | null;
  version?: number;
  visibility?: PackVisibility;
  content: unknown;
}

const LIST_LIMIT = 200;

interface PackWithOwnerRow {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  content: PackContentType;
  updatedAt: Date;
  username: string;
  tag: string;
  avatarColor: string | null;
  avatarIcon: string | null;
}

const ownerOf = (row: PackWithOwnerRow): ShowcaseOwner => ({
  username: row.username,
  tag: row.tag,
  avatarColor: row.avatarColor,
  avatarIcon: row.avatarIcon,
});

const cardOf = (row: PackWithOwnerRow): ShowcasePackCard => ({
  id: row.id,
  name: row.name,
  description: row.description,
  language: row.language,
  authorName: row.authorName,
  version: row.version,
  owner: ownerOf(row),
  summary: summarizePackContent(row.content),
  updatedAt: row.updatedAt.toISOString(),
});

export const packService = {
  /** Metadata only - no payload is parsed, which is the reason the columns exist. */
  async list(): Promise<PackListEntry[]> {
    return db
      .select({
        id: packs.id,
        ownerId: packs.ownerId,
        name: packs.name,
        description: packs.description,
        language: packs.language,
        authorName: packs.authorName,
        version: packs.version,
        visibility: packs.visibility,
        createdAt: packs.createdAt,
        updatedAt: packs.updatedAt,
      })
      .from(packs)
      .orderBy(desc(packs.updatedAt))
      .limit(LIST_LIMIT);
  },

  /**
   * The packs offered on the public Showcase.
   *
   * Only `public` ones, the same rule the story listing follows: a pack shared with this server is
   * not thereby published, and the author raises that flag deliberately.
   *
   * Unlike `list`, this one joins the owner and counts the payload, because the page it feeds has
   * no account behind it: a visitor has no other way of learning who is offering the pack or what
   * is inside it. `ownerId` is deliberately *not* among what comes out - it identifies an account
   * to an anonymous reader and buys the page nothing.
   */
  async listPublic(): Promise<ShowcasePackCard[]> {
    const rows = await db
      .select({
        id: packs.id,
        name: packs.name,
        description: packs.description,
        language: packs.language,
        authorName: packs.authorName,
        version: packs.version,
        content: packs.content,
        updatedAt: packs.updatedAt,
        username: users.username,
        tag: users.tag,
        avatarColor: users.avatarColor,
        avatarIcon: users.avatarIcon,
      })
      .from(packs)
      .innerJoin(users, eq(packs.ownerId, users.id))
      .where(eq(packs.visibility, 'public'))
      .orderBy(desc(packs.updatedAt))
      .limit(LIST_LIMIT);

    return rows.map((row) => cardOf(row));
  },

  /** One public pack, whole. A private one is a 404 here rather than a 403: it is not on offer. */
  async getPublicById(packId: string): Promise<ShowcasePackDetail | null> {
    const [row] = await db
      .select({
        id: packs.id,
        name: packs.name,
        description: packs.description,
        language: packs.language,
        authorName: packs.authorName,
        version: packs.version,
        visibility: packs.visibility,
        content: packs.content,
        updatedAt: packs.updatedAt,
        username: users.username,
        tag: users.tag,
        avatarColor: users.avatarColor,
        avatarIcon: users.avatarIcon,
      })
      .from(packs)
      .innerJoin(users, eq(packs.ownerId, users.id))
      .where(eq(packs.id, packId))
      .limit(1);
    if (!row || row.visibility !== 'public') return null;
    return { ...cardOf(row), content: row.content };
  },

  async getById(packId: string): Promise<PackListEntry & { content: PackContentType }> {
    const [pack] = await db.select().from(packs).where(eq(packs.id, packId)).limit(1);
    if (!pack) throw new AppError(404, 'Pack not found.');
    return pack as PackListEntry & { content: PackContentType };
  },

  /**
   * Uploads a pack, or replaces one this user already owns.
   *
   * Re-uploading the same id is how a new version is shared: a pack at a given version is
   * immutable, so there is nothing to merge - the row is simply replaced by its author.
   */
  async upload(ownerId: string, input: UploadPackInput): Promise<PackListEntry> {
    const parsed = PackContentSchema.safeParse(input.content);
    if (!parsed.success) {
      throw new AppError(422, `Pack content is not valid: ${parsed.error.message}`);
    }

    const [existing] = await db.select().from(packs).where(eq(packs.id, input.id)).limit(1);
    if (existing && existing.ownerId !== ownerId) {
      throw new AppError(403, 'This pack belongs to somebody else.');
    }

    const row = {
      id: input.id,
      ownerId,
      name: input.name,
      description: input.description ?? null,
      language: input.language ?? null,
      authorName: input.authorName ?? null,
      version: input.version ?? 1,
      visibility: input.visibility ?? 'private',
      content: parsed.data,
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db.update(packs).set(row).where(eq(packs.id, input.id)).returning();
      return updated as PackListEntry;
    }
    const [created] = await db.insert(packs).values(row).returning();
    return created as PackListEntry;
  },

  /** Physical: there is no sync to tell about a tombstone, and nothing that could resurrect it. */
  async remove(ownerId: string, packId: string): Promise<void> {
    const [pack] = await db.select().from(packs).where(eq(packs.id, packId)).limit(1);
    if (!pack) throw new AppError(404, 'Pack not found.');
    if (pack.ownerId !== ownerId) throw new AppError(403, 'This pack belongs to somebody else.');
    await db.delete(packs).where(eq(packs.id, packId));
  },
};
