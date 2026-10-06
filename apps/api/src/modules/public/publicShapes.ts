import { FORMAT_META } from '@keres/shared';
import { t } from 'elysia';

/** The shapes and small helpers the public routes share; the routes themselves stay in `public.route.ts`. */

export function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'story'
  );
}

export const OwnerSchema = t.Object({
  username: t.String(),
  tag: t.String(),
  avatarColor: t.Nullable(t.String()),
  avatarIcon: t.Nullable(t.String()),
});

export const SnapshotSchema = t.Object({
  title: t.String(),
  description: t.Nullable(t.String()),
  genre: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
  author: t.Nullable(t.String()),
  type: t.String(),
  theme: t.Nullable(t.String()),
  // Absent on versions published before the flag existed.
  isNsfw: t.Optional(t.Boolean()),
});

export const VersionSchema = t.Object({
  id: t.String(),
  label: t.String(),
  byteSize: t.Number(),
  mediaIncluded: t.Number(),
  mediaTotal: t.Number(),
  createdAt: t.String(),
  packageIncluded: t.Boolean(),
  manuscript: t.Nullable(
    t.Object({
      format: t.String(),
      byteSize: t.Number(),
    }),
  ),
  reader: t.Nullable(t.Object({ byteSize: t.Number() })),
});

/** A version's manuscript delivery metadata, or null when the version carries no manuscript. */
export function manuscriptMetaOf(publication: {
  manuscriptFormat: string | null;
}): { extension: string; mimeType: string } | null {
  if (!publication.manuscriptFormat) {
    return null;
  }
  return (
    (FORMAT_META as Record<string, { extension: string; mimeType: string }>)[
      publication.manuscriptFormat
    ] ?? null
  );
}
