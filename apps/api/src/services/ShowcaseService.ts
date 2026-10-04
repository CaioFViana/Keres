import type {
  ManuscriptFormat,
  ShowcaseOwner,
  ShowcaseStoryCard,
  ShowcaseStoryDetail,
  ShowcaseVersion,
  StoryPublicationSnapshot,
} from '@keres/shared';
import { comparePassword } from '../config/bcrypt';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { stories, storyPublications, storyShowcaseEntries, users } from '../db/schema';

/**
 * The public site's anonymous reads.
 *
 * Everything that comes out of here is already content somebody chose to publish. No user id, no
 * email, no permission row and no story without a publication - and nothing, not even the title, about
 * a password-protected story before the unlock.
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
      packageIncluded: row.packageIncluded,
      manuscript:
        row.manuscriptFormat && row.manuscriptByteSize != null
          ? {
              format: row.manuscriptFormat as ManuscriptFormat,
              byteSize: row.manuscriptByteSize,
            }
          : null,
      reader: row.readerByteSize != null ? { byteSize: row.readerByteSize } : null,
    };
  }

  /**
   * The listing's signature, for the site's `If-None-Match`. A count plus the most recent instant covers
   * publishing, deleting a version and unpublishing without needing a dedicated column. Computed over
   * exactly what the viewer class may see, and tagged with that class: an NSFW publication must never
   * validate an anonymous cached copy, nor the reverse.
   */
  async listEtag(includeNsfw: boolean): Promise<string> {
    const [row] = await db
      .select({
        count: count(),
        latest: sql<string | null>`max(${storyShowcaseEntries.updatedAt})`,
      })
      .from(storyShowcaseEntries)
      .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(
        and(
          eq(storyShowcaseEntries.visibility, 'public'),
          eq(stories.isDeleted, false),
          eq(users.isDeleted, false),
          ...(includeNsfw ? [] : [eq(stories.isNsfw, false)]),
        ),
      );
    const viewerClass = includeNsfw ? 'verified' : 'safe';
    return `W/"showcase-${viewerClass}-${row?.count ?? 0}-${row?.latest ?? 'empty'}"`;
  }

  /**
   * Public stories only. A password-protected one never shows up here. A story whose owner was
   * deactivated never shows up either (shadowban: it answers as if unpublished), and neither does
   * an NSFW story for anyone but a signed-in age-verified viewer. NSFW-ness follows the story's
   * live flag, not the frozen snapshot, so flagging is effective immediately.
   */
  async listPublicStories(includeNsfw: boolean): Promise<ShowcaseStoryCard[]> {
    const entries = await db
      .select({
        storyId: storyShowcaseEntries.storyId,
        updatedAt: storyShowcaseEntries.updatedAt,
        username: users.username,
        tag: users.tag,
        avatarColor: users.avatarColor,
        avatarIcon: users.avatarIcon,
        isNsfw: stories.isNsfw,
      })
      .from(storyShowcaseEntries)
      .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(
        and(
          eq(storyShowcaseEntries.visibility, 'public'),
          eq(stories.isDeleted, false),
          eq(users.isDeleted, false),
          ...(includeNsfw ? [] : [eq(stories.isNsfw, false)]),
        ),
      )
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
        isNsfw: entry.isNsfw,
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

  /**
   * Whether the session (already resolved by the global derive, from Bearer or cookie) belongs to
   * a live age-verified adult. Anything else - anonymous, stale token, unverified - sees only the
   * safe catalog. Never throws: a bad token is exactly like no token.
   */
  async viewerIncludesNsfw(user: { userId?: string } | null): Promise<boolean> {
    if (!user?.userId) {
      return false;
    }
    const row = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { isDeleted: true, isAdultVerified: true },
    });
    return !!row && !row.isDeleted && row.isAdultVerified;
  }

  /** The story's live NSFW flag (false when the story is gone - callers 404 on that anyway). */
  async isNsfwStory(storyId: string): Promise<boolean> {
    const [row] = await db
      .select({ isNsfw: stories.isNsfw })
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1);
    return row?.isNsfw === true;
  }

  /**
   * Whether a published story may be served to this viewer class at all: hidden (null) when the
   * story or its owner is gone, or when it is NSFW and the viewer is not a verified adult. Callers
   * answer 404 either way, so a shadowbanned or gated story is indistinguishable from unpublished.
   */
  async isVisibleTo(storyId: string, includeNsfw: boolean): Promise<boolean> {
    const [row] = await db
      .select({
        storyId: storyShowcaseEntries.storyId,
        isNsfw: stories.isNsfw,
        storyDeleted: stories.isDeleted,
        ownerDeleted: users.isDeleted,
      })
      .from(storyShowcaseEntries)
      .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(eq(storyShowcaseEntries.storyId, storyId))
      .limit(1);
    if (!row || row.storyDeleted || row.ownerDeleted) {
      return false;
    }
    return includeNsfw || !row.isNsfw;
  }

  async getStoryDetail(storyId: string, includeNsfw: boolean): Promise<ShowcaseStoryDetail | null> {
    if (!(await this.isVisibleTo(storyId, includeNsfw))) {
      return null;
    }
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
   * Checks a protected story's password.
   *
   * It always runs a bcrypt, even when the story does not exist or is not protected: without that,
   * response time would separate "does not exist" from "wrong password", and the endpoint would become an
   * existence oracle - exactly what the generic 401 response avoids.
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

/** The hash of a password nobody has, just so the failure path costs the same as the success path. */
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export const showcaseService = new ShowcaseService();
