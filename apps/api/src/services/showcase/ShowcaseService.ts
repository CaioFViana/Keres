import { createHash } from 'node:crypto';
import type {
  ShowcaseFacets,
  ShowcaseSearchQuery,
  ShowcaseStoryCard,
  ShowcaseStoryDetail,
  StoryPublicationSnapshot,
} from '@keres/shared';
import { comparePassword } from '@/config/bcrypt';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { effectiveAdultVerified } from '@/services/age-verification/ageVerificationMode';
import {
  galleries,
  stories,
  storyArcs,
  storyPublications,
  storyShowcaseEntries,
  users,
} from '@/db/schema';
import { loadCatalog, visibleEntry } from './showcaseCatalog';
import { facetsOf, searchCatalog } from './showcaseSearch';
import { COVER_MIME_TYPES, ownerOf, versionOf } from './showcaseShapes';

/**
 * The public site's anonymous reads.
 *
 * Everything that comes out of here is already content somebody chose to publish. No user id, no
 * email, no permission row and no story without a publication - and nothing, not even the title, about
 * a password-protected story before the unlock.
 */
export class ShowcaseService {
  /**
   * The picture that is the cover of a story, when it has a usable one: a live image of the story's own Gallery,
   * in a format a browser draws without running anything. The site shows the cover as it is now, not as it was in a
   * version: a cover is the story's face, not part of a release.
   */
  async coverOf(storyId: string): Promise<{ hash: string; mimeType: string } | null> {
    const [row] = await db
      .select({ hash: galleries.hash, mimeType: galleries.mimeType })
      .from(stories)
      .innerJoin(galleries, eq(galleries.id, stories.coverGalleryId))
      .where(
        and(
          eq(stories.id, storyId),
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
          eq(galleries.mediaType, 'image'),
        ),
      )
      .limit(1);
    return row && COVER_MIME_TYPES.has(row.mimeType) ? row : null;
  }

  /**
   * The listing's signature, for the site's `If-None-Match`. A count plus the most recent instant covers
   * publishing, deleting a version and unpublishing without needing a dedicated column. Computed over
   * exactly what the viewer class may see, and tagged with that class: an NSFW publication must never
   * validate an anonymous cached copy, nor the reverse.
   */
  async listEtag(includeNsfw: boolean, querySignature = ''): Promise<string> {
    const [row] = await db
      .select({
        count: count(),
        latest: sql<string | null>`max(${storyShowcaseEntries.updatedAt})`,
      })
      .from(storyShowcaseEntries)
      .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(visibleEntry(includeNsfw));
    const viewerClass = includeNsfw ? 'verified' : 'safe';
    // The same catalog answers differently to a different question: a filtered or paged listing is its own tag.
    const asked = querySignature
      ? `-${createHash('sha1').update(querySignature).digest('hex').slice(0, 12)}`
      : '';
    return `W/"showcase-${viewerClass}-${row?.count ?? 0}-${row?.latest ?? 'empty'}${asked}"`;
  }

  /**
   * Public stories only. A password-protected one never shows up here. A story whose owner was
   * deactivated never shows up either (shadowban: it answers as if unpublished), and neither does
   * an NSFW story for anyone but a signed-in age-verified viewer. NSFW-ness follows the story's
   * live flag, not the frozen snapshot, so flagging is effective immediately.
   */
  async listPublicStories(includeNsfw: boolean): Promise<ShowcaseStoryCard[]> {
    return (await loadCatalog(includeNsfw)).map((entry) => entry.card);
  }

  /** The listing, filtered and ordered as asked, and how many matched before the page was cut. */
  async searchStories(
    includeNsfw: boolean,
    query: ShowcaseSearchQuery,
  ): Promise<{ items: ShowcaseStoryCard[]; total: number }> {
    const { items, total } = searchCatalog(await loadCatalog(includeNsfw), query);
    return { items: items.map((entry) => entry.card), total };
  }

  /** What the listing can be filtered by, counted over what this viewer may see. */
  async facets(includeNsfw: boolean): Promise<ShowcaseFacets> {
    return facetsOf(await loadCatalog(includeNsfw));
  }

  async getEntry(storyId: string) {
    return db.query.storyShowcaseEntries.findFirst({
      where: eq(storyShowcaseEntries.storyId, storyId),
    });
  }

  /**
   * Whether the session (already resolved by the global derive, from Bearer or cookie) belongs to
   * a live age-verified adult who has chosen to see adults-only stories in the public showcase
   * (`showNsfw`, the owner's private preference). Anything else - anonymous, stale token, unverified,
   * or verified but opted out - sees only the safe catalog. Never throws: a bad token is exactly like
   * no token. Collaboration on +18 stories does not read this: it keeps depending on verification alone.
   */
  async viewerIncludesNsfw(user: { userId?: string } | null): Promise<boolean> {
    if (!user?.userId) {
      return false;
    }
    const row = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
      columns: { isDeleted: true, isAdultVerified: true, showNsfw: true },
    });
    return (
      !!row &&
      !row.isDeleted &&
      effectiveAdultVerified(row.isAdultVerified) &&
      row.showNsfw === true
    );
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
        ownerStatus: users.verificationStatus,
      })
      .from(storyShowcaseEntries)
      .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
      .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
      .where(eq(storyShowcaseEntries.storyId, storyId))
      .limit(1);
    if (!row || row.storyDeleted || row.ownerDeleted || row.ownerStatus !== 'active') {
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

    const releasedWorks = [...new Set(versions.flatMap((version) => version.arcId ?? []))];

    return {
      storyId,
      snapshot: versions[0].snapshot as StoryPublicationSnapshot,
      owner: ownerOf(entry),
      versions: versions.map(versionOf),
      hasCover: (await this.coverOf(storyId)) !== null,
      workCovers: await this.workCoverIds(storyId, releasedWorks),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  /**
   * The arc ids, out of those given, whose work has a cover the site can show: a live image of the story's own
   * Gallery, in a format a browser draws without running anything - the same rule as the story's cover. Shown as it
   * is now, like that cover. A work that was deleted after its release has none.
   */
  async workCoverIds(storyId: string, arcIds: readonly string[]): Promise<string[]> {
    if (arcIds.length === 0) {
      return [];
    }
    const rows = await db
      .select({ arcId: storyArcs.id, mimeType: galleries.mimeType })
      .from(storyArcs)
      .innerJoin(galleries, eq(galleries.id, storyArcs.coverGalleryId))
      .where(
        and(
          eq(storyArcs.storyId, storyId),
          inArray(storyArcs.id, [...arcIds]),
          eq(storyArcs.isDeleted, false),
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
          eq(galleries.mediaType, 'image'),
        ),
      );
    return rows.filter((row) => COVER_MIME_TYPES.has(row.mimeType)).map((row) => row.arcId);
  }

  /** The picture of a released work (an arc with at least one version published), when it has a usable one. */
  async coverOfWork(
    storyId: string,
    arcId: string,
  ): Promise<{ hash: string; mimeType: string } | null> {
    const [released] = await db
      .select({ id: storyPublications.id })
      .from(storyPublications)
      .where(and(eq(storyPublications.storyId, storyId), eq(storyPublications.arcId, arcId)))
      .limit(1);
    if (!released) {
      return null;
    }
    const [row] = await db
      .select({ hash: galleries.hash, mimeType: galleries.mimeType })
      .from(storyArcs)
      .innerJoin(galleries, eq(galleries.id, storyArcs.coverGalleryId))
      .where(
        and(
          eq(storyArcs.id, arcId),
          eq(storyArcs.storyId, storyId),
          eq(storyArcs.isDeleted, false),
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
          eq(galleries.mediaType, 'image'),
        ),
      )
      .limit(1);
    return row && COVER_MIME_TYPES.has(row.mimeType) ? row : null;
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
