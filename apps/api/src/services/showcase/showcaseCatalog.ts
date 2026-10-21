import type { ShowcaseStoryCard, StoryPublicationSnapshot } from '@keres/shared';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { galleries, stories, storyPublications, storyShowcaseEntries, users } from '@/db/schema';
import { ACTIVE_ACCOUNT } from '@/services/accounts/UserService';
import { COVER_MIME_TYPES, ownerOf, versionOf } from './showcaseShapes';

/**
 * One published story as the public site holds it, with what the search needs beside the card it
 * becomes. Never leaves the server as it is.
 */
export interface CatalogEntry {
  card: ShowcaseStoryCard;
  ownerUserId: string;
  /** The mediums of the works released from this story. */
  mediums: ReadonlySet<string>;
  /** The titles of those works, so a search finds a story by the work inside it. */
  workTitles: readonly string[];
}

/**
 * What the public listing may show, once: public (a password story is never listed), the story and its owner
 * alive, the owner's account active, and - unless the viewer is a verified adult who chose to see it - nothing
 * flagged adults-only. NSFW-ness follows the story's live flag, not the frozen snapshot. Expects the entry, the
 * story and the user joined.
 */
export function visibleEntry(includeNsfw: boolean): SQL {
  return and(
    eq(storyShowcaseEntries.visibility, 'public'),
    eq(stories.isDeleted, false),
    eq(users.isDeleted, false),
    ACTIVE_ACCOUNT,
    ...(includeNsfw ? [] : [eq(stories.isNsfw, false)]),
  ) as SQL;
}

/**
 * Every story this viewer class may see, newest first, in three queries however many there are (the entries,
 * their versions, their covers). `ownerUsername` narrows it to one author's.
 */
export async function loadCatalog(
  includeNsfw: boolean,
  filter: { ownerUsername?: string } = {},
): Promise<CatalogEntry[]> {
  const visible = and(
    visibleEntry(includeNsfw),
    filter.ownerUsername ? eq(users.username, filter.ownerUsername) : undefined,
  ) as SQL;

  const entries = await db
    .select({
      storyId: storyShowcaseEntries.storyId,
      ownerUserId: storyShowcaseEntries.ownerUserId,
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
    .where(visible)
    .orderBy(desc(storyShowcaseEntries.updatedAt));
  if (entries.length === 0) {
    return [];
  }

  const publicationRows = await db
    .select({ publication: storyPublications })
    .from(storyPublications)
    .innerJoin(storyShowcaseEntries, eq(storyShowcaseEntries.storyId, storyPublications.storyId))
    .innerJoin(stories, eq(stories.id, storyShowcaseEntries.storyId))
    .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
    .where(visible)
    .orderBy(desc(storyPublications.createdAt));
  const versionsByStory = new Map<string, Array<typeof storyPublications.$inferSelect>>();
  for (const { publication } of publicationRows) {
    const versions = versionsByStory.get(publication.storyId) ?? [];
    versions.push(publication);
    versionsByStory.set(publication.storyId, versions);
  }

  const coverRows = await db
    .select({ storyId: stories.id, mimeType: galleries.mimeType })
    .from(stories)
    .innerJoin(galleries, eq(galleries.id, stories.coverGalleryId))
    .innerJoin(storyShowcaseEntries, eq(storyShowcaseEntries.storyId, stories.id))
    .innerJoin(users, eq(storyShowcaseEntries.ownerUserId, users.id))
    .where(
      and(
        visible,
        eq(galleries.storyId, stories.id),
        eq(galleries.isDeleted, false),
        eq(galleries.mediaType, 'image'),
      ),
    );
  const withCover = new Set(
    coverRows.filter((row) => COVER_MIME_TYPES.has(row.mimeType)).map((row) => row.storyId),
  );

  const catalog: CatalogEntry[] = [];
  for (const entry of entries) {
    const versions = versionsByStory.get(entry.storyId) ?? [];
    const [latest] = versions;
    // An entry with no version is not a reachable state, but the listing never shows an empty card.
    if (!latest) {
      continue;
    }
    const works = versions
      .map((version) => (version.snapshot as StoryPublicationSnapshot).arc)
      .filter((arc): arc is NonNullable<typeof arc> => Boolean(arc));
    catalog.push({
      ownerUserId: entry.ownerUserId,
      mediums: new Set(works.map((arc) => arc.medium)),
      workTitles: [...new Set(works.map((arc) => arc.title))],
      card: {
        storyId: entry.storyId,
        isNsfw: entry.isNsfw,
        snapshot: latest.snapshot as StoryPublicationSnapshot,
        owner: ownerOf(entry),
        versionCount: versions.length,
        latestVersion: versionOf(latest),
        hasCover: withCover.has(entry.storyId),
        updatedAt: entry.updatedAt.toISOString(),
      },
    });
  }
  return catalog;
}
