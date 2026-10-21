import type {
  ManuscriptFormat,
  ShowcaseOwner,
  ShowcaseVersion,
  StoryPublicationSnapshot,
} from '@keres/shared';
import type { storyPublications } from '@/db/schema';

/** What a cover may be to be served to a page: raster images only, nothing that runs. */
export const COVER_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** The publisher as the anonymous site sees them: no internal id, no email. */
export function ownerOf(row: {
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

/** A published version as the site lists it. */
export function versionOf(row: typeof storyPublications.$inferSelect): ShowcaseVersion {
  const snapshot = row.snapshot as StoryPublicationSnapshot;
  return {
    id: row.id,
    // A release of one work names it as it stood then; null is a version of the whole universe.
    arc: row.arcId ? (snapshot.arc ?? null) : null,
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
